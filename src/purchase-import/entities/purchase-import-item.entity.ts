import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { PurchaseImport } from '@/purchase-import/entities/purchase-import.entity';

/** One line the AI read from the document, and what the user did with it */
@Entity({ name: 'purchase_import_items' })
export class PurchaseImportItem {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'purchase_import_item_id' })
  purchaseImportItemId: number;

  @Column({ name: 'purchase_import_id' })
  purchaseImportId: number;

  @ManyToOne(() => PurchaseImport, (parsed) => parsed.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_import_id' })
  purchaseImport: PurchaseImport;

  @ApiProperty({ description: 'The name as it is written on the document' })
  @Column({ name: 'name_on_document', length: 255 })
  nameOnDocument: string;

  @ApiProperty({ description: 'The quantity the AI read' })
  @Column({ type: 'int' })
  quantity: number;

  @ApiProperty({
    nullable: true,
    description: 'The drink we matched by the name',
  })
  @Column({ name: 'suggested_drink_id', type: 'int', nullable: true })
  suggestedDrinkId: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'The drink the user added it to, empty when the line was skipped',
  })
  @Column({ name: 'applied_drink_id', type: 'int', nullable: true })
  appliedDrinkId: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'The quantity the user added, can differ from the one the AI read',
  })
  @Column({ name: 'applied_quantity', type: 'int', nullable: true })
  appliedQuantity: number | null;
}
