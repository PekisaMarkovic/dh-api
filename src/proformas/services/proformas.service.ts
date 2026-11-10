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
import { CompaniesService } from '@/companies/services/companies.service';
import { ProformaStatusEnums } from '@/proformas/enums/proforma-status.enum';
import { PdfService } from '@/pdf/services/pdf.service';
import { CreateProformaDto } from '@/proformas/dto/proforma.dto';

// money is calculated in cents so 0.1 + 0.2 style errors never reach the total
const toCents = (value: number) => Math.round(value * 100);
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
    private readonly companiesService: CompaniesService,
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

    const drinkIds = dto.items.map((item) => item.drinkId);

    if (new Set(drinkIds).size !== drinkIds.length) {
      throw new BadRequestException('Each drink can be added only once');
    }

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

          const lineCents = toCents(drink.price) * line.quantity;
          totalCents += lineCents;

          return Object.assign(new ProformaItem(), {
            drinkId: drink.drinkId,
            name: drink.name,
            unitPrice: drink.price,
            quantity: line.quantity,
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
        }

        return manager.save(
          manager.create(Proforma, {
            companyId: warehouse.companyId,
            warehouseId: warehouse.warehouseId,
            createdById: user.userId,
            total: fromCents(totalCents),
            status: ProformaStatusEnums.ACTIVE,
            items,
          }),
        );
      },
    );

    return this.findOne(saved.proformaId, user);
  }

  /**
   * Proformas of the company of the user, newest first (without items)
   */
  async findAll(user: User) {
    const proformas = await this.proformaRepository.find({
      where: { companyId: user.companyId ?? -1 },
      relations: ['warehouse', 'createdBy'],
      order: { createdAt: 'DESC', proformaId: 'DESC' },
    });

    return proformas.map((proforma) => {
      const { createdBy, warehouse, ...rest } = withNumber(proforma);

      return {
        ...rest,
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
        number: proforma.number,
        createdAt: proforma.createdAt,
        warehouseName: proforma.warehouseName,
        createdByName: proforma.createdByName,
        total: proforma.total,
        status: proforma.status,
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
