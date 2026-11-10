import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'invitations' })
export class Invitation {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid', { name: 'invitation_id' })
  invitationId: string;

  @ApiProperty()
  @Column()
  email: string;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ApiProperty()
  @Column({ type: 'bigint', name: 'expiration_date' })
  expirationDate: number;

  @ApiProperty()
  @Column({ type: 'timestamp', name: 'accepted_at', nullable: true })
  acceptedAt: Date | null;

  @ApiProperty()
  @Column({ type: 'timestamp', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
