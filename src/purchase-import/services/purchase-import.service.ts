import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { paginate, Pagination } from 'nestjs-typeorm-paginate';
import { PaginationQueryDto } from '@/common/dto';
import { toLikePattern } from '@/common/helpers';
import { User } from '@/users/entities/user.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';
import { CompaniesService } from '@/companies/services/companies.service';
import { AiService } from '@/ai/ai.service';
import { AI_MODEL } from '@/ai/ai.constants';
import { findBestMatch } from '@/purchase-import/helpers/match.helpers';
import { ApplyPurchaseDto } from '@/purchase-import/dto/purchase-import.dto';
import { PurchaseImport } from '@/purchase-import/entities/purchase-import.entity';
import { PurchaseImportItem } from '@/purchase-import/entities/purchase-import-item.entity';
import { PurchaseImportStatusEnums } from '@/purchase-import/enums/purchase-import-status.enum';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

@Injectable()
export class PurchaseImportService {
  constructor(
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    @InjectRepository(PurchaseImport)
    private readonly importRepository: Repository<PurchaseImport>,
    @InjectRepository(PurchaseImportItem)
    private readonly itemRepository: Repository<PurchaseImportItem>,
    private readonly warehousesService: WarehousesService,
    private readonly companiesService: CompaniesService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Reads the document and matches every line to a drink of the warehouse.
   * The stock is not changed, the user checks the result first (see apply).
   * The document itself is not kept. Every upload is remembered, also the ones that
   * failed: who sent it, the answer of the AI (JSON) and what was added to the stock.
   */
  async parse(warehouseId: number, file: Express.Multer.File, user: User) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only an image (jpg, png, webp) or a PDF');
    }

    // checks the warehouse belongs to the user's company
    const warehouse = await this.warehousesService.findOne(warehouseId, user);

    const record = await this.importRepository.save(
      this.importRepository.create({
        companyId: warehouse.companyId,
        warehouseId,
        userId: user.userId,
        fileName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash: createHash('sha256').update(file.buffer).digest('hex'),
        status: PurchaseImportStatusEnums.PARSING,
        model: AI_MODEL,
      }),
    );

    const startedAt = Date.now();

    try {
      // the drinks as they are now go to the AI, so it matches the lines to them
      const drinks = await this.drinkRepository.find({
        where: { warehouseId },
        order: { name: 'ASC' },
      });
      const extraction = await this.aiService.extractPurchaseItems(
        file,
        drinks.map(({ drinkId, name }) => ({ drinkId, name })),
      );

      const items = await this.itemRepository.save(
        extraction.items.map((line) =>
          this.itemRepository.create({
            purchaseImportId: record.purchaseImportId,
            nameOnDocument: line.name.slice(0, 255),
            quantity: line.quantity,
            // the match of the AI, else the closest name
            suggestedDrinkId:
              line.drinkId ?? findBestMatch(line.name, drinks)?.drinkId ?? null,
          }),
        ),
      );

      await this.importRepository.update(record.purchaseImportId, {
        status: PurchaseImportStatusEnums.PARSED,
        durationMs: Date.now() - startedAt,
        title: extraction.title?.slice(0, 255) ?? null,
        aiResponse: extraction.raw as object,
      });

      return {
        purchaseImportId: record.purchaseImportId,
        items: items.map((item) => ({
          purchaseImportItemId: item.purchaseImportItemId,
          name: item.nameOnDocument,
          quantity: item.quantity,
          drinkId: item.suggestedDrinkId,
        })),
        drinks: drinks.map(({ drinkId, name }) => ({ drinkId, name })),
      };
    } catch (error) {
      await this.importRepository.update(record.purchaseImportId, {
        status: PurchaseImportStatusEnums.FAILED,
        durationMs: Date.now() - startedAt,
        errorMessage: (error instanceof Error
          ? error.message
          : String(error)
        ).slice(0, 2000),
      });

      throw error;
    }
  }

  /**
   * Adds the checked quantities to the stock of the drinks, all or nothing,
   * and remembers what was added for every line of the document.
   * A document can be added in parts: the lines that were left out can be added later.
   * @throws ConflictException if a line was already added to the stock
   * @throws NotFoundException if a drink or a line is not of this import
   */
  async apply(dto: ApplyPurchaseDto, user: User) {
    const record = await this.findImport(dto.purchaseImportId, user);

    if (
      record.status !== PurchaseImportStatusEnums.PARSED &&
      record.status !== PurchaseImportStatusEnums.APPLIED
    ) {
      throw new BadRequestException('The document was not read');
    }

    // the same drink on two lines is added once
    const quantities = new Map<number, number>();
    for (const { drinkId, quantity } of dto.items) {
      quantities.set(drinkId, (quantities.get(drinkId) ?? 0) + quantity);
    }

    return this.importRepository.manager.transaction(async (manager) => {
      const drinks = await manager.find(Drink, {
        where: {
          drinkId: In([...quantities.keys()]),
          warehouseId: record.warehouseId,
        },
      });

      if (drinks.length !== quantities.size) {
        throw new NotFoundException('A drink is not in this warehouse');
      }

      const lines = await manager.find(PurchaseImportItem, {
        where: {
          purchaseImportId: record.purchaseImportId,
          purchaseImportItemId: In(
            dto.items.map((item) => item.purchaseImportItemId),
          ),
        },
      });

      if (
        lines.length !==
        new Set(dto.items.map((i) => i.purchaseImportItemId)).size
      ) {
        throw new NotFoundException('A line is not of this document');
      }

      // a line is added only once, otherwise the stock would be counted twice
      if (lines.some((line) => line.appliedDrinkId !== null)) {
        throw new ConflictException('A line was already added to the stock');
      }

      for (const drink of drinks) {
        await manager.increment(
          Drink,
          { drinkId: drink.drinkId },
          'quantity',
          quantities.get(drink.drinkId)!,
        );
      }

      for (const item of dto.items) {
        await manager.update(
          PurchaseImportItem,
          { purchaseImportItemId: item.purchaseImportItemId },
          { appliedDrinkId: item.drinkId, appliedQuantity: item.quantity },
        );
      }

      await manager.update(PurchaseImport, record.purchaseImportId, {
        status: PurchaseImportStatusEnums.APPLIED,
        appliedAt: new Date(),
      });

      return { updated: drinks.length };
    });
  }

  /** A page of the uploads of the company, newest first, searched by the title or the file name */
  async findAll(user: User, query: PaginationQueryDto) {
    if (user.companyId) {
      this.companiesService.assertCanAccess(user, user.companyId);
    }

    const pattern = toLikePattern(query.search);
    const base = user.companyId ? { companyId: user.companyId } : {};

    const page = await paginate(this.importRepository, query, {
      where: pattern
        ? [
            { ...base, title: ILike(pattern) },
            { ...base, fileName: ILike(pattern) },
          ]
        : base,
      relations: ['user', 'warehouse'],
      order: { createdAt: 'DESC', purchaseImportId: 'DESC' },
    });

    const counts = page.items.length
      ? await this.itemRepository
          .createQueryBuilder('item')
          .select('item.purchaseImportId', 'purchaseImportId')
          .addSelect('COUNT(*)', 'lines')
          .addSelect('COUNT(item.appliedDrinkId)', 'applied')
          .where('item.purchaseImportId IN (:...ids)', {
            ids: page.items.map((r) => r.purchaseImportId),
          })
          .groupBy('item.purchaseImportId')
          .getRawMany<{
            purchaseImportId: number;
            lines: string;
            applied: string;
          }>()
      : [];
    const byId = new Map(counts.map((c) => [Number(c.purchaseImportId), c]));

    return new Pagination(
      page.items.map((record) => ({
        purchaseImportId: record.purchaseImportId,
        createdAt: record.createdAt,
        appliedAt: record.appliedAt,
        title: record.title,
        fileName: record.fileName,
        fileSize: record.fileSize,
        status: record.status,
        model: record.model,
        durationMs: record.durationMs,
        errorMessage: record.errorMessage,
        warehouseName: record.warehouse?.name ?? '',
        userName: record.user
          ? `${record.user.firstName} ${record.user.lastName}`.trim()
          : '',
        linesCount: Number(byId.get(record.purchaseImportId)?.lines ?? 0),
        appliedCount: Number(byId.get(record.purchaseImportId)?.applied ?? 0),
      })),
      page.meta,
    );
  }

  /**
   * One upload with all its lines and the drinks of its warehouse,
   * so the lines that were left out can be checked and added later
   */
  async findOne(purchaseImportId: number, user: User) {
    const record = await this.findImport(purchaseImportId, user, [
      'items',
      'user',
      'warehouse',
    ]);

    const drinks = await this.drinkRepository.find({
      where: { warehouseId: record.warehouseId },
      order: { name: 'ASC' },
    });

    return {
      purchaseImportId: record.purchaseImportId,
      createdAt: record.createdAt,
      appliedAt: record.appliedAt,
      title: record.title,
      fileName: record.fileName,
      mimeType: record.mimeType,
      status: record.status,
      errorMessage: record.errorMessage,
      warehouseId: record.warehouseId,
      warehouseName: record.warehouse?.name ?? '',
      userName: record.user
        ? `${record.user.firstName} ${record.user.lastName}`.trim()
        : '',
      items: [...record.items]
        .sort((a, b) => a.purchaseImportItemId - b.purchaseImportItemId)
        .map((item) => ({
          purchaseImportItemId: item.purchaseImportItemId,
          name: item.nameOnDocument,
          quantity: item.quantity,
          suggestedDrinkId: item.suggestedDrinkId,
          appliedDrinkId: item.appliedDrinkId,
          appliedQuantity: item.appliedQuantity,
        })),
      drinks: drinks.map(({ drinkId, name }) => ({ drinkId, name })),
    };
  }

  /**
   * Removes the document from the history (soft delete).
   * The stock that was already added stays as it is, it is not taken back.
   */
  async remove(purchaseImportId: number, user: User) {
    await this.findImport(purchaseImportId, user);
    await this.importRepository.softDelete({ purchaseImportId });

    return true;
  }

  private async findImport(
    purchaseImportId: number,
    user: User,
    relations: string[] = [],
  ) {
    const record = await this.importRepository.findOne({
      where: { purchaseImportId },
      relations,
    });

    if (!record) {
      throw new NotFoundException('Import not found');
    }

    this.companiesService.assertCanAccess(user, record.companyId);

    return record;
  }
}
