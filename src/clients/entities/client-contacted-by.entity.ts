import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AuditEntity } from '@/common/entities/audit.entity';
import { Client } from '@/clients/entities/client.entity';

/** A message that a visitor of a white label site sent through its contact form */
@Entity({ name: 'clients_contacted_by' })
export class ClientContactedBy extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'contact_id' })
  contactId: number;

  @ApiProperty({
    format: 'uuid',
    description: 'The site the message came from',
  })
  @Index()
  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @ApiProperty({ example: 'Petar Petrović' })
  @Column({ length: 150 })
  name: string;

  @ApiProperty({ example: '+381 64 123 4567' })
  @Column({ length: 30 })
  phone: string;

  @ApiProperty({ nullable: true, type: String })
  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The message, what the visitor needs',
  })
  @Column({ type: 'text', nullable: true })
  message: string | null;
}
