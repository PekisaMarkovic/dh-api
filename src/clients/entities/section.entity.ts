import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Client } from '@/clients/entities/client.entity';
import { SectionContent, SectionType } from '@/clients/website.types';
import { Image } from '@/storage/entities/image.entity';

/** A part of a page of a site (hero, recommended drinks, story, info). The same section can be on more pages */
@Entity({ name: 'sections' })
export class Section {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'section_id' })
  sectionId: number;

  @ApiProperty({ enum: SectionType })
  @Column({ type: 'varchar', length: 20 })
  type: SectionType;

  @ApiProperty({
    example: 'Hero',
    description: 'The name in the dashboard, not shown on the site',
  })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({
    description: 'The texts of the section, see website.types.ts',
  })
  @Column({ type: 'jsonb', default: () => "'{}'" })
  content: SectionContent;

  @Column({ name: 'image_id', type: 'int', nullable: true })
  imageId: number | null;

  @ManyToOne(() => Image, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'image_id',
    foreignKeyConstraintName: 'FK_sections_image',
  })
  image: Image | null;

  @Index('IDX_sections_client_id')
  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'client_id',
    foreignKeyConstraintName: 'FK_sections_client',
  })
  client: Client;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
