import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Image } from '@/storage/entities/image.entity';

/** What Google and the social networks show for a page: the title, the description and the picture shown when it is shared */
@Entity({ name: 'seo' })
export class Seo {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'seo_id' })
  seoId: number;

  @ApiProperty({ nullable: true, type: String })
  @Column({ type: 'varchar', length: 70, nullable: true })
  title: string | null;

  @ApiProperty({ nullable: true, type: String })
  @Column({ type: 'varchar', length: 160, nullable: true })
  description: string | null;

  @Column({ name: 'image_id', type: 'int', nullable: true })
  imageId: number | null;

  @ManyToOne(() => Image, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'image_id', foreignKeyConstraintName: 'FK_seo_image' })
  image: Image | null;
}
