import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AuditEntity } from '@/common/entities/audit.entity';
import { Company } from '@/companies/entities/company.entity';
import { Image } from '@/storage/entities/image.entity';
import { ClientSections } from '@/clients/website.types';
import { ClientStatus } from '@/clients/client-status.enum';

/**
 * A white label client side (a public Next.js site) of a company.
 * The id is a GUID, it is put in the env of the site so the site and the api know which client it is.
 */
@Entity({ name: 'clients' })
export class Client extends AuditEntity {
  @ApiProperty({
    format: 'uuid',
    example: '0b6f3a52-6c5e-4a53-9a43-5f1f0d6a7e11',
  })
  // gen_random_uuid() is built into Postgres 13+, no extension is needed
  @PrimaryColumn({
    name: 'client_id',
    type: 'uuid',
    default: () => 'gen_random_uuid()',
  })
  clientId: string;

  @ApiProperty({ example: 'KNEZ BAR web' })
  @Column({ length: 150 })
  name: string;

  @ApiProperty({
    enum: ClientStatus,
    description:
      'draft until it is published, a draft site shows a "coming soon" page',
  })
  @Column({ type: 'varchar', length: 20, default: ClientStatus.DRAFT })
  status: ClientStatus;

  @ApiProperty({ nullable: true, type: Date })
  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  // ---- general info of the site ----

  @ApiProperty({ nullable: true, type: String, example: 'Loznica' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Filipa Kljajića 82' })
  @Column({ type: 'varchar', length: 150, nullable: true })
  address: string | null;

  @ApiProperty({ nullable: true, type: String })
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Address of the Instagram page',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  instagram: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'One day per line, shown as it is written',
    example: 'Ponedeljak: 07:00-19:00, Utorak: 07:00-19:00',
  })
  @Column({ name: 'working_hours', type: 'text', nullable: true })
  workingHours: string | null;

  // ---- the texts of the sections (hero, featured, story, promo) ----

  @ApiProperty({
    description: 'The texts of the sections, see website.types.ts',
  })
  @Column({ type: 'jsonb', default: () => "'{}'" })
  sections: ClientSections;

  // ---- the pictures, every one is a row of `images` (the file is in the bucket) ----

  @Column({ name: 'logo_image_id', type: 'int', nullable: true })
  logoImageId: number | null;

  @ManyToOne(() => Image, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'logo_image_id' })
  logoImage: Image | null;

  @Column({ name: 'hero_image_id', type: 'int', nullable: true })
  heroImageId: number | null;

  @ManyToOne(() => Image, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hero_image_id' })
  heroImage: Image | null;

  @Column({ name: 'story_image_id', type: 'int', nullable: true })
  storyImageId: number | null;

  @ManyToOne(() => Image, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'story_image_id' })
  storyImage: Image | null;

  @Column({ name: 'promo_image_id', type: 'int', nullable: true })
  promoImageId: number | null;

  @ManyToOne(() => Image, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'promo_image_id' })
  promoImage: Image | null;

  @Column({ name: 'og_image_id', type: 'int', nullable: true })
  ogImageId: number | null;

  @ManyToOne(() => Image, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'og_image_id' })
  ogImage: Image | null;

  @ApiProperty()
  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, (company) => company.clients, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
