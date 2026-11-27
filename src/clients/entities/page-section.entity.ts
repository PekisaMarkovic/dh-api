import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/clients/entities/page.entity';
import { Section } from '@/clients/entities/section.entity';

/** A section on a page: where it is and whether it is shown. The order and the visibility are per page */
@Entity({ name: 'page_sections' })
export class PageSection {
  @ApiProperty()
  @PrimaryColumn({ name: 'page_id' })
  pageId: number;

  @ApiProperty()
  @PrimaryColumn({ name: 'section_id' })
  sectionId: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  position: number;

  @ApiProperty()
  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible: boolean;

  @ManyToOne(() => Page, (page) => page.pageSections, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'page_id',
    foreignKeyConstraintName: 'FK_page_sections_page',
  })
  page: Page;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'section_id',
    foreignKeyConstraintName: 'FK_page_sections_section',
  })
  section: Section;
}
