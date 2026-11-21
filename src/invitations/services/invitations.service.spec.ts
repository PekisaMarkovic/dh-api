import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { CompaniesService } from '@/companies/services/companies.service';
import { Invitation } from '@/invitations/entities/invitation.entity';
import { InvitationsService } from '@/invitations/services/invitations.service';
import { MailerService } from '@/mailer/services/mailer.service';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/services/users.service';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;
const UUID = '0b8f3c8e-5a0e-4d57-9b9c-0d1f5a3c7a11';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let invitationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
  let usersService: { getUserByEmail: jest.Mock };
  let mailerService: { sendInvitationMail: jest.Mock };
  let companiesService: { assertCanAccess: jest.Mock };

  const inviter = { userId: 7, companyId: 1, roles: [] } as unknown as User;

  const storedInvitation = (overrides: Partial<Invitation> = {}) =>
    ({
      invitationId: UUID,
      email: 'novi@drinkhouse.rs',
      companyId: 1,
      expirationDate: Date.now() + 3 * DAY,
      acceptedAt: null,
      createdAt: new Date('2026-11-01'),
      lastSentAt: null,
      ...overrides,
    }) as unknown as Invitation;

  beforeEach(async () => {
    invitationRepository = {
      create: jest.fn((entity: Partial<Invitation>) => entity),
      save: jest.fn((entity: Partial<Invitation>) =>
        Promise.resolve({ invitationId: UUID, ...entity }),
      ),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    usersService = { getUserByEmail: jest.fn().mockResolvedValue(null) };
    mailerService = {
      sendInvitationMail: jest.fn().mockResolvedValue(undefined),
    };
    companiesService = { assertCanAccess: jest.fn() };
    (paginate as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: getRepositoryToken(Invitation),
          useValue: invitationRepository,
        },
        { provide: UsersService, useValue: usersService },
        { provide: MailerService, useValue: mailerService },
        { provide: CompaniesService, useValue: companiesService },
      ],
    }).compile();

    service = module.get(InvitationsService);
  });

  describe('invite', () => {
    it('should throw BadRequestException when the inviter has no company', async () => {
      await expect(
        service.invite('novi@drinkhouse.rs', {
          ...inviter,
          companyId: null,
        } as unknown as User),
      ).rejects.toThrow(BadRequestException);
      expect(mailerService.sendInvitationMail).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when a user with the email exists', async () => {
      usersService.getUserByEmail.mockResolvedValue({ userId: 3 });

      await expect(
        service.invite('novi@drinkhouse.rs', inviter),
      ).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );
      expect(invitationRepository.save).not.toHaveBeenCalled();
    });

    it('should save the invitation of the company of the inviter for 7 days, with the email trimmed and in lower case', async () => {
      const before = Date.now();

      await service.invite('  Novi@DrinkHouse.rs ', inviter);

      expect(usersService.getUserByEmail).toHaveBeenCalledWith(
        'novi@drinkhouse.rs',
      );
      const created = invitationRepository.create.mock.calls[0][0] as {
        email: string;
        companyId: number;
        expirationDate: number;
        lastSentAt: Date;
      };
      expect(created.email).toBe('novi@drinkhouse.rs');
      expect(created.companyId).toBe(1);
      expect(created.expirationDate).toBeGreaterThanOrEqual(before + 7 * DAY);
      expect(created.expirationDate).toBeLessThanOrEqual(Date.now() + 7 * DAY);
      expect(created.lastSentAt).toBeInstanceOf(Date);
    });

    it('should replace a pending invitation of the same email', async () => {
      await service.invite('novi@drinkhouse.rs', inviter);

      expect(invitationRepository.delete).toHaveBeenCalledWith({
        email: 'novi@drinkhouse.rs',
        acceptedAt: expect.anything(),
      });
    });

    it('should send the mail with the id of the invitation and the days it is valid', async () => {
      await service.invite('novi@drinkhouse.rs', inviter);

      expect(mailerService.sendInvitationMail).toHaveBeenCalledWith({
        data: { invitationId: UUID, validDays: '7' },
        recipients: [{ name: '', address: 'novi@drinkhouse.rs' }],
      });
    });

    it('should remove the invitation and throw the error again when the mail can not be sent', async () => {
      const error = new Error('smtp down');
      mailerService.sendInvitationMail.mockRejectedValue(error);

      await expect(service.invite('novi@drinkhouse.rs', inviter)).rejects.toBe(
        error,
      );

      expect(invitationRepository.delete).toHaveBeenLastCalledWith({
        invitationId: UUID,
      });
    });
  });

  describe('findByCompany', () => {
    const meta = {
      totalItems: 3,
      itemCount: 3,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    };
    const query = { page: 1, limit: 10 };

    it('should return the invitations of the company with their status', async () => {
      (paginate as jest.Mock).mockResolvedValue({
        items: [
          storedInvitation({ invitationId: 'a' }),
          storedInvitation({
            invitationId: 'b',
            expirationDate: Date.now() - DAY,
          }),
          storedInvitation({ invitationId: 'c', acceptedAt: new Date() }),
        ],
        meta,
      });

      const result = await service.findByCompany(1, query);

      expect(result.items.map((item) => item.status)).toEqual([
        'pending',
        'expired',
        'accepted',
      ]);
      expect(result.meta).toBe(meta);
    });

    it('should call an invitation that was accepted accepted, even when it is expired', async () => {
      (paginate as jest.Mock).mockResolvedValue({
        items: [
          storedInvitation({
            acceptedAt: new Date(),
            expirationDate: Date.now() - DAY,
          }),
        ],
        meta,
      });

      const result = await service.findByCompany(1, query);

      expect(result.items[0].status).toBe('accepted');
    });

    it('should show when the mail went out last, or when it was created', async () => {
      const sentAt = new Date('2026-11-05');
      (paginate as jest.Mock).mockResolvedValue({
        items: [
          storedInvitation({ lastSentAt: sentAt }),
          storedInvitation({ lastSentAt: null }),
        ],
        meta,
      });

      const result = await service.findByCompany(1, query);

      expect(result.items[0].sentAt).toBe(sentAt);
      expect(result.items[1].sentAt).toEqual(new Date('2026-11-01'));
    });

    it('should show the expiry as a date', async () => {
      const expirationDate = Date.now() + DAY;
      (paginate as jest.Mock).mockResolvedValue({
        items: [storedInvitation({ expirationDate })],
        meta,
      });

      const result = await service.findByCompany(1, query);

      expect(result.items[0].expiresAt).toEqual(new Date(expirationDate));
    });

    it('should search by the email, newest first', async () => {
      (paginate as jest.Mock).mockResolvedValue({ items: [], meta });

      await service.findByCompany(1, { ...query, search: 'novi' });

      expect(paginate).toHaveBeenCalledWith(
        invitationRepository,
        expect.anything(),
        expect.objectContaining({
          where: { companyId: 1, email: expect.anything() },
          order: { createdAt: 'DESC', invitationId: 'ASC' },
        }),
      );
    });

    it('should not search when there is no text', async () => {
      (paginate as jest.Mock).mockResolvedValue({ items: [], meta });

      await service.findByCompany(1, query);

      expect((paginate as jest.Mock).mock.calls[0][2].where).toEqual({
        companyId: 1,
      });
    });
  });

  describe('resend', () => {
    it('should throw NotFoundException for an id that is not a uuid, without asking the database', async () => {
      await expect(service.resend('12', inviter)).rejects.toThrow(
        NotFoundException,
      );
      expect(invitationRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when there is no such invitation', async () => {
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(service.resend(UUID, inviter)).rejects.toThrow(
        new NotFoundException('Invitation not found'),
      );
    });

    it('should not resend the invitation of another company', async () => {
      invitationRepository.findOne.mockResolvedValue(storedInvitation());
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.resend(UUID, inviter)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mailerService.sendInvitationMail).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the invitation was already used', async () => {
      invitationRepository.findOne.mockResolvedValue(
        storedInvitation({ acceptedAt: new Date() }),
      );

      await expect(service.resend(UUID, inviter)).rejects.toThrow(
        new ConflictException('Invitation was already used'),
      );
    });

    it('should throw ConflictException when the person has an account now', async () => {
      invitationRepository.findOne.mockResolvedValue(storedInvitation());
      usersService.getUserByEmail.mockResolvedValue({ userId: 3 });

      await expect(service.resend(UUID, inviter)).rejects.toThrow(
        ConflictException,
      );
      expect(mailerService.sendInvitationMail).not.toHaveBeenCalled();
    });

    it('should start the 7 days again, keep the id and send the mail', async () => {
      const invitation = storedInvitation({ expirationDate: Date.now() + DAY });
      invitationRepository.findOne.mockResolvedValue(invitation);
      const before = Date.now();

      const result = await service.resend(UUID, inviter);

      expect(invitation.expirationDate).toBeGreaterThanOrEqual(
        before + 7 * DAY,
      );
      expect(invitationRepository.save).toHaveBeenCalledWith(invitation);
      expect(mailerService.sendInvitationMail).toHaveBeenCalledWith({
        data: { invitationId: UUID, validDays: '7' },
        recipients: [{ name: '', address: 'novi@drinkhouse.rs' }],
      });
      expect(result.status).toBe('pending');
    });

    it('should bring back the old expiry and throw the error again when the mail can not be sent', async () => {
      const oldExpiry = Date.now() + DAY;
      invitationRepository.findOne.mockResolvedValue(
        storedInvitation({ expirationDate: oldExpiry, lastSentAt: null }),
      );
      const error = new Error('smtp down');
      mailerService.sendInvitationMail.mockRejectedValue(error);

      await expect(service.resend(UUID, inviter)).rejects.toBe(error);

      expect(invitationRepository.update).toHaveBeenCalledWith(
        { invitationId: UUID },
        { expirationDate: oldExpiry, lastSentAt: null },
      );
    });
  });

  describe('findUsable', () => {
    it('should return null for an id that is not a uuid, without asking the database', async () => {
      await expect(service.findUsable('abc')).resolves.toBeNull();
      expect(invitationRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return the invitation that can be used', async () => {
      const invitation = storedInvitation();
      invitationRepository.findOne.mockResolvedValue(invitation);

      await expect(service.findUsable(UUID)).resolves.toBe(invitation);
    });

    it('should return null when there is no such invitation', async () => {
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(service.findUsable(UUID)).resolves.toBeNull();
    });

    it('should return null when it was accepted', async () => {
      invitationRepository.findOne.mockResolvedValue(
        storedInvitation({ acceptedAt: new Date() }),
      );

      await expect(service.findUsable(UUID)).resolves.toBeNull();
    });

    it('should return null when it is expired', async () => {
      invitationRepository.findOne.mockResolvedValue(
        storedInvitation({ expirationDate: Date.now() - 1 }),
      );

      await expect(service.findUsable(UUID)).resolves.toBeNull();
    });

    it('should read the expiry of the database, which comes as a string', async () => {
      invitationRepository.findOne.mockResolvedValue(
        storedInvitation({
          expirationDate: String(Date.now() + DAY) as unknown as number,
        }),
      );

      await expect(service.findUsable(UUID)).resolves.not.toBeNull();
    });
  });

  describe('isValid', () => {
    it('should be true for an invitation that can be used and false for the rest', async () => {
      invitationRepository.findOne.mockResolvedValueOnce(storedInvitation());
      await expect(service.isValid(UUID)).resolves.toBe(true);

      invitationRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.isValid(UUID)).resolves.toBe(false);
    });
  });

  describe('markAccepted', () => {
    it('should save the time the invitation was accepted', async () => {
      const invitation = storedInvitation();

      await service.markAccepted(invitation);

      expect(invitation.acceptedAt).toBeInstanceOf(Date);
      expect(invitationRepository.save).toHaveBeenCalledWith(invitation);
    });
  });
});
