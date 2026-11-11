import { paginate, Pagination } from 'nestjs-typeorm-paginate';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { toLikePattern } from '@/common/helpers';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Repository } from 'typeorm';
import { Invitation } from '@/invitations/entities/invitation.entity';
import { MailerService } from '@/mailer/services/mailer.service';
import { UsersService } from '@/users/services/users.service';
import { Nullable } from '@/common/interface';
import { User } from '@/users/entities/user.entity';
import { CompaniesService } from '@/companies/services/companies.service';

const INVITATION_TTL_DAYS = 7;
const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    private readonly usersService: UsersService,
    private readonly mailerService: MailerService,
    private readonly companiesService: CompaniesService,
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
        lastSentAt: new Date(),
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

  private toListItem(invitation: Invitation) {
    return {
      invitationId: invitation.invitationId,
      email: invitation.email,
      createdAt: invitation.createdAt,
      // when the email went out last, the same as createdAt until it is sent again
      sentAt: invitation.lastSentAt ?? invitation.createdAt,
      expiresAt: new Date(Number(invitation.expirationDate)),
      acceptedAt: invitation.acceptedAt,
      status: invitation.acceptedAt
        ? 'accepted'
        : Number(invitation.expirationDate) < Date.now()
          ? 'expired'
          : 'pending',
    };
  }

  /**
   * A page of the invitations of a company with a computed status, newest first
   */
  async findByCompany(companyId: number, query: PaginationQueryDto) {
    const pattern = toLikePattern(query.search);

    const page = await paginate(this.invitationRepository, query, {
      where: { companyId, ...(pattern && { email: ILike(pattern) }) },
      order: { createdAt: 'DESC', invitationId: 'ASC' },
    });

    return new Pagination(
      page.items.map((invitation) => this.toListItem(invitation)),
      page.meta,
    );
  }

  /**
   * Send the email of an invitation again and start its expiry again (7 days from now).
   * The invitation keeps its id, so the link of the first email works again too.
   * @throws NotFoundException if there is no such invitation
   * @throws ConflictException if it was already used, or the person has an account now
   */
  async resend(invitationId: string, user: User) {
    // not a uuid -> postgres would throw, treat as not found
    const invitation = /^[0-9a-f-]{36}$/i.test(invitationId)
      ? await this.invitationRepository.findOne({ where: { invitationId } })
      : null;

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    this.companiesService.assertCanAccess(user, invitation.companyId);

    if (invitation.acceptedAt) {
      throw new ConflictException('Invitation was already used');
    }

    if (await this.usersService.getUserByEmail(invitation.email)) {
      throw new ConflictException('User with this email already exists');
    }

    const previous = {
      expirationDate: invitation.expirationDate,
      lastSentAt: invitation.lastSentAt,
    };

    invitation.expirationDate = Date.now() + INVITATION_TTL_MS;
    invitation.lastSentAt = new Date();
    await this.invitationRepository.save(invitation);

    try {
      await this.mailerService.sendInvitationMail({
        data: {
          invitationId: invitation.invitationId,
          validDays: String(INVITATION_TTL_DAYS),
        },
        recipients: [{ name: '', address: invitation.email }],
      });
    } catch (error) {
      // the email did not go out, so the invitation keeps its old expiry
      await this.invitationRepository.update(
        { invitationId: invitation.invitationId },
        previous,
      );

      throw error;
    }

    return this.toListItem(invitation);
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
