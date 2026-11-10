import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Invitation } from '@/invitations/entities/invitation.entity';
import { MailerService } from '@/mailer/services/mailer.service';
import { UsersService } from '@/users/services/users.service';
import { Nullable } from '@/common/interface';
import { User } from '@/users/entities/user.entity';

const INVITATION_TTL_DAYS = 7;
const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    private readonly usersService: UsersService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Create an invitation for the email (replaces any pending one) and send the invite mail
   * @throws ConflictException if a user with that email already exists
   */
  async invite(rawEmail: string, inviter: User) {
    if (!inviter.companyId) {
      throw new BadRequestException('You do not belong to a company');
    }

    const email = rawEmail.trim().toLowerCase();

    if (await this.usersService.getUserByEmail(email)) {
      throw new ConflictException('User with this email already exists');
    }

    await this.invitationRepository.delete({ email, acceptedAt: IsNull() });

    const invitation = await this.invitationRepository.save(
      this.invitationRepository.create({
        email,
        companyId: inviter.companyId,
        expirationDate: Date.now() + INVITATION_TTL_MS,
      }),
    );

    try {
      await this.mailerService.sendInvitationMail({
        data: {
          invitationId: invitation.invitationId,
          validDays: String(INVITATION_TTL_DAYS),
        },
        recipients: [{ name: '', address: email }],
      });
    } catch (error) {
      // nobody got the link, so the invitation must not stay in the list as pending
      await this.invitationRepository.delete({
        invitationId: invitation.invitationId,
      });

      throw error;
    }

    return invitation;
  }

  /**
   * All invitations of a company with a computed status
   */
  async findByCompany(companyId: number) {
    const invitations = await this.invitationRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });

    return invitations.map((invitation) => ({
      invitationId: invitation.invitationId,
      email: invitation.email,
      createdAt: invitation.createdAt,
      expiresAt: new Date(Number(invitation.expirationDate)),
      acceptedAt: invitation.acceptedAt,
      status: invitation.acceptedAt
        ? 'accepted'
        : Number(invitation.expirationDate) < Date.now()
          ? 'expired'
          : 'pending',
    }));
  }

  /**
   * Find an invitation that can still be used (exists, not accepted, not expired)
   */
  async findUsable(invitationId: string): Promise<Nullable<Invitation>> {
    // not a uuid -> postgres would throw, treat as not found
    if (!/^[0-9a-f-]{36}$/i.test(invitationId)) {
      return null;
    }

    const invitation = await this.invitationRepository.findOne({
      where: { invitationId },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      Number(invitation.expirationDate) < Date.now()
    ) {
      return null;
    }

    return invitation;
  }

  async isValid(invitationId: string) {
    return !!(await this.findUsable(invitationId));
  }

  async markAccepted(invitation: Invitation) {
    invitation.acceptedAt = new Date();

    return this.invitationRepository.save(invitation);
  }
}
