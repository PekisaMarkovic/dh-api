import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Client } from '@/clients/entities/client.entity';
import { PageSection } from '@/clients/entities/page-section.entity';
import { Seo } from '@/clients/entities/seo.entity';
import { ClientStatus } from '@/clients/client-status.enum';
import { MAX_MENU_PAGES } from '@/clients/website.constants';

/** A page of a site: its address, its SEO and its sections in order */
@Entity({ name: 'pages' })
@Unique('UQ_pages_client_slug', ['clientId', 'slug'])
export class Page {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'page_id' })
  pageId: number;

  @ApiProperty({ example: 'O nama' })
  @Column({ length: 100 })
  title: string;

  @ApiProperty({
    example: 'o-nama',
    description: 'The address of the page, empty for the home page',
  })
  @Column({ length: 100 })
  slug: string;

  @ApiProperty({
    enum: ClientStatus,
    description: 'a draft page is not on the site',
  })
  @Column({ type: 'varchar', length: 20, default: ClientStatus.DRAFT })
  status: ClientStatus;

  @ApiProperty({
    description: `In the main menu of the site (at most ${MAX_MENU_PAGES}), else in the footer`,
  })
  @Column({ name: 'is_in_menu', type: 'boolean', default: false })
  isInMenu: boolean;

  @ApiProperty({ description: 'The order of the pages in the menu' })
  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'seo_id' })
  seoId: number;

  @ApiProperty({ type: () => Seo })
  @OneToOne(() => Seo, { cascade: true, nullable: false })
  @JoinColumn({ name: 'seo_id', foreignKeyConstraintName: 'FK_pages_seo' })
  seo: Seo;

  @OneToMany(() => PageSection, (pageSection) => pageSection.page, {
    cascade: true,
  })
  pageSections: PageSection[];

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'client_id',
    foreignKeyConstraintName: 'FK_pages_client',
  })
  client: Client;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
