import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Proforma } from '@/proformas/entities/proforma.entity';
import { ProformaItem } from '@/proformas/entities/proforma-item.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { User } from '@/users/entities/user.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';
import { CustomersService } from '@/customers/services/customers.service';
import {
  StockAlertsService,
  StockChange,
} from '@/stock-alerts/services/stock-alerts.service';
import { CompaniesService } from '@/companies/services/companies.service';
import { ProformaStatusEnums } from '@/proformas/enums/proforma-status.enum';
import { PdfService } from '@/pdf/services/pdf.service';
import { CreateProformaDto } from '@/proformas/dto/proforma.dto';
import { lineTotalCents, vatSummary } from '@/common/helpers/money.helpers';

// money is calculated in cents so 0.1 + 0.2 style errors never reach the total
const fromCents = (cents: number) => cents / 100;

const withNumber = (proforma: Proforma) => ({
  ...proforma,
  number: `PR-${String(proforma.proformaId).padStart(6, '0')}`,
});

@Injectable()
export class ProformasService {
  private readonly logger = new Logger(ProformasService.name);

  constructor(
    @InjectRepository(Proforma)
    private readonly proformaRepository: Repository<Proforma>,
    private readonly warehousesService: WarehousesService,
    private readonly customersService: CustomersService,
    private readonly companiesService: CompaniesService,
    private readonly stockAlertsService: StockAlertsService,
    private readonly pdfService: PdfService,
  ) {}

  /**
   * Create a proforma from drinks of ONE warehouse.
   * The quantity can not be higher than the stock, and it is taken off the stock.
   */
  async create(dto: CreateProformaDto, user: User) {
    // 404 / 403 if the warehouse is missing or belongs to another company
    const warehouse = await this.warehousesService.findOne(
      dto.warehouseId,
      user,
    );

    // 404 / 403 if the customer is missing or belongs to another company
    const customer = dto.customerId
      ? await this.customersService.findOne(dto.customerId, user)
      : null;

    const drinkIds = dto.items.map((item) => item.drinkId);

    if (new Set(drinkIds).size !== drinkIds.length) {
      throw new BadRequestException('Each drink can be added only once');
    }

    // what the stock of every drink was and is, to tell the employees when it gets low
    const stockChanges: StockChange[] = [];

    const saved = await this.proformaRepository.manager.transaction(
      async (manager) => {
        // lock the drinks, so two proformas at the same time can not sell the same stock
        const drinks = await manager.find(Drink, {
          where: { drinkId: In(drinkIds), warehouseId: warehouse.warehouseId },
          order: { drinkId: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        const drinkById = new Map(
          drinks.map((drink) => [drink.drinkId, drink]),
        );

        let totalCents = 0;
        const items = dto.items.map((line) => {
          const drink = drinkById.get(line.drinkId);

          if (!drink) {
            throw new BadRequestException(
              `Drink ${line.drinkId} is not in this warehouse`,
            );
          }

          if (line.quantity > drink.quantity) {
            throw new BadRequestException(
              `Not enough "${drink.name}" in stock, available: ${drink.quantity}`,
            );
          }

          // the price can be changed for this proforma, the drink itself keeps its price
          const unitPrice = line.unitPrice ?? drink.price;
          const discountPercent = line.discountPercent ?? 0;
          const lineCents = lineTotalCents(
            unitPrice,
            line.quantity,
            discountPercent,
          );
          totalCents += lineCents;

          return Object.assign(new ProformaItem(), {
            drinkId: drink.drinkId,
            code: drink.code,
            name: drink.name,
            unitPrice,
            quantity: line.quantity,
            discountPercent,
            lineTotal: fromCents(lineCents),
          });
        });

        for (const line of dto.items) {
          await manager.decrement(
            Drink,
            { drinkId: line.drinkId },
            'quantity',
            line.quantity,
          );

          // the drinks were locked and read before the decrement, so they still have the old quantity
          const drink = drinkById.get(line.drinkId);
          const levels = {
            warningQuantity: drink.warningQuantity,
            criticalQuantity: drink.criticalQuantity,
          };

          stockChanges.push({
            companyId: drink.companyId,
            warehouseId: drink.warehouseId,
            drinkName: drink.name,
            drinkCode: drink.code,
            before: { quantity: drink.quantity, ...levels },
            after: { quantity: drink.quantity - line.quantity, ...levels },
          });
        }

        return manager.save(
          manager.create(Proforma, {
            companyId: warehouse.companyId,
            warehouseId: warehouse.warehouseId,
            createdById: user.userId,
            customerId: customer?.customerId ?? null,
            customerName: customer?.name ?? null,
            total: fromCents(totalCents),
            status: ProformaStatusEnums.ACTIVE,
            items,
          }),
        );
      },
    );

    // only now, when the proforma is really saved, the employees hear about the low stock
    stockChanges.forEach((change) =>
      this.stockAlertsService.notifyIfWorse(change),
    );

    return this.findOne(saved.proformaId, user);
  }

  /**
   * Proformas of the company of the user, newest first (without items)
   */
  async findAll(user: User) {
    const proformas = await this.proformaRepository.find({
      where: { companyId: user.companyId ?? -1 },
      relations: ['items', 'warehouse', 'createdBy'],
      order: { createdAt: 'DESC', proformaId: 'DESC' },
    });

    return proformas.map((proforma) => {
      const { createdBy, warehouse, items, ...rest } = withNumber(proforma);

      return {
        ...rest,
        ...vatSummary(items.map((item) => item.lineTotal)),
        warehouseName: warehouse?.name ?? '',
        createdByName: createdBy
          ? `${createdBy.firstName} ${createdBy.lastName}`
          : '',
      };
    });
  }

  async findOne(proformaId: number, user: User) {
    const proforma = await this.proformaRepository.findOne({
      where: { proformaId },
      relations: ['items', 'warehouse', 'createdBy'],
    });

    if (!proforma) {
      throw new NotFoundException('Proforma not found');
    }

    this.companiesService.assertCanAccess(user, proforma.companyId);

    const { warehouse, createdBy, ...rest } = withNumber(proforma);

    rest.items.sort((a, b) => a.proformaItemId - b.proformaItemId);

    return {
      ...rest,
      ...vatSummary(rest.items.map((item) => item.lineTotal)),
      warehouseName: warehouse?.name ?? '',
      createdByName: createdBy
        ? `${createdBy.firstName} ${createdBy.lastName}`
        : '',
    };
  }

  /**
   * Puts the drinks of a proforma back on the stock, e.g. when it was made by mistake.
   * Can be done only once. Drinks that were deleted in the meantime are skipped.
   */
  async returnToStock(proformaId: number, user: User) {
    await this.proformaRepository.manager.transaction(async (manager) => {
      // lock the proforma so it can not be returned twice at the same time
      const proforma = await manager.findOne(Proforma, {
        where: { proformaId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!proforma) {
        throw new NotFoundException('Proforma not found');
      }

      this.companiesService.assertCanAccess(user, proforma.companyId);

      if (proforma.status === ProformaStatusEnums.RETURNED) {
        throw new ConflictException('Proforma is already returned to stock');
      }

      const items = await manager.find(ProformaItem, { where: { proformaId } });

      for (const item of items) {
        if (item.drinkId === null) continue;

        await manager.increment(
          Drink,
          { drinkId: item.drinkId },
          'quantity',
          item.quantity,
        );
      }

      await manager.update(
        Proforma,
        { proformaId },
        {
          status: ProformaStatusEnums.RETURNED,
          returnedAt: new Date(),
          returnedById: user.userId,
        },
      );
    });

    return this.findOne(proformaId, user);
  }

  /**
   * The proforma as a PDF file
   */
  async createPdf(proformaId: number, user: User) {
    const proforma = await this.findOne(proformaId, user);

    try {
      const buffer = await this.pdfService.renderProforma({
        // TODO: a counter that restarts every year, now it is "<proformaId>/<yy>" like 40/26
        documentNumber: `${proforma.proformaId}/${String(new Date(proforma.createdAt).getFullYear()).slice(-2)}`,
        createdAt: proforma.createdAt,
        warehouseId: proforma.warehouseId,
        warehouseName: proforma.warehouseName,
        customerName: proforma.customerName,
        createdByName: proforma.createdByName,
        total: proforma.total,
        items: proforma.items,
      });

      return { buffer, filename: `${proforma.number}.pdf` };
    } catch (error) {
      // say what went wrong instead of an empty "Internal server error"
      this.logger.error(
        `Could not create the PDF of proforma ${proformaId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        `Could not create the PDF: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
