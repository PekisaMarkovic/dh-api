import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Company } from '@/companies/entities/company.entity';

/** One file in the Cloudflare R2 bucket, everything that has a picture points to a row of this table */
@Entity({ name: 'images' })
export class Image {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'image_id' })
  imageId: number;

  @ApiProperty({
    description: 'Path of the file in the bucket',
    example: 'production/company-knez-bar-3/drinks/12/1764100000000.webp',
  })
  @Index({ unique: true })
  @Column({ length: 500 })
  key: string;

  @ApiProperty({ description: 'Public address of the file' })
  @Column({ length: 1000 })
  url: string;

  @ApiProperty({ description: 'The company that owns the image' })
  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty({ example: 'image/webp' })
  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @ApiProperty({ description: 'Size of the stored file in bytes' })
  @Column({ type: 'int' })
  size: number;

  @ApiProperty({ description: 'Width in pixels' })
  @Column({ type: 'int' })
  width: number;

  @ApiProperty({ description: 'Height in pixels' })
  @Column({ type: 'int' })
  height: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Text for the alt attribute (accessibility and SEO)',
  })
  @Column({ name: 'alt_text', type: 'varchar', length: 255, nullable: true })
  altText: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
