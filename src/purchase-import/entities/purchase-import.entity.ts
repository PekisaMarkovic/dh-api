import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AuditEntity } from '@/common/entities/audit.entity';
import { Company } from '@/companies/entities/company.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';
import { User } from '@/users/entities/user.entity';
import { PurchaseImportStatusEnums } from '@/purchase-import/enums/purchase-import-status.enum';
import { PurchaseImportItem } from '@/purchase-import/entities/purchase-import-item.entity';

/** One uploaded document: who sent it, what the AI read from it and what was added to the stock */
@Index(['companyId', 'createdAt'])
@Entity({ name: 'purchase_imports' })
export class PurchaseImport extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'purchase_import_id' })
  purchaseImportId: number;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty()
  @Column({ name: 'warehouse_id' })
  warehouseId: number;

  @ManyToOne(() => Warehouse, { nullable: false })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @ApiProperty({ description: 'Who uploaded the document' })
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({
    nullable: true,
    description:
      'The title of the document read by the AI, empty when it found none (the file name is shown then)',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @ApiProperty()
  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @ApiProperty()
  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @ApiProperty({ description: 'Bytes' })
  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @ApiProperty({
    description: 'SHA-256 of the file, the same document has the same hash',
  })
  @Column({ name: 'file_hash', length: 64 })
  @Index()
  fileHash: string;

  @ApiProperty({ enum: PurchaseImportStatusEnums })
  @Column({
    type: 'varchar',
    length: 20,
    default: PurchaseImportStatusEnums.PARSING,
  })
  status: PurchaseImportStatusEnums;

  @ApiProperty({
    nullable: true,
    description: 'The AI model that read the document',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @ApiProperty({ nullable: true, description: 'How long the AI needed' })
  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'The answer of the AI as it was returned (JSON), the document itself is not kept',
  })
  @Column({ name: 'ai_response', type: 'jsonb', nullable: true })
  aiResponse: unknown;

  @ApiProperty({ nullable: true })
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'applied_at', type: 'timestamp', nullable: true })
  appliedAt: Date | null;

  @ApiProperty({ type: () => [PurchaseImportItem] })
  @OneToMany(() => PurchaseImportItem, (item) => item.purchaseImport)
  items: PurchaseImportItem[];
}
