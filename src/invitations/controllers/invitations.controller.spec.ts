import { Test, TestingModule } from '@nestjs/testing';
import { ADMINS, isPublic, rolesOf } from '@/common/testing/controller.helpers';
import { InvitationsController } from '@/invitations/controllers/invitations.controller';
import { InvitationsService } from '@/invitations/services/invitations.service';
import { User } from '@/users/entities/user.entity';

describe('InvitationsController', () => {
  let controller: InvitationsController;
  let service: Record<
    'invite' | 'findByCompany' | 'resend' | 'isValid',
    jest.Mock
  >;

  const user = { userId: 7, companyId: 1 } as User;

  beforeEach(async () => {
    service = {
      invite: jest.fn().mockResolvedValue({ invitationId: 'abc' }),
      findByCompany: jest.fn(),
      resend: jest.fn(),
      isValid: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [{ provide: InvitationsService, useValue: service }],
    }).compile();

    controller = module.get(InvitationsController);
  });

  it('should invite the email and only say that it worked, without the invitation', async () => {
    await expect(
      controller.invite({ email: 'novi@drinkhouse.rs' }, user),
    ).resolves.toBe(true);
    expect(service.invite).toHaveBeenCalledWith('novi@drinkhouse.rs', user);
  });

  it('should return a page of the invitations of the company of the user', async () => {
    const query = { page: 1, limit: 10 };

    await controller.findAll(user, query);

    expect(service.findByCompany).toHaveBeenCalledWith(1, query);
  });

  it('should send an invitation again', async () => {
    await controller.resend('abc', user);

    expect(service.resend).toHaveBeenCalledWith('abc', user);
  });

  it('should tell whether an invitation can be used', async () => {
    service.isValid.mockResolvedValue(true);

    await expect(controller.isValid('abc')).resolves.toBe(true);
    expect(service.isValid).toHaveBeenCalledWith('abc');
  });

  describe('who can do what', () => {
    it.each(['invite', 'findAll', 'resend'] as const)(
      'should let only admins call %s',
      (method) => {
        expect(rolesOf(InvitationsController.prototype[method])).toEqual(
          ADMINS,
        );
        expect(isPublic(InvitationsController.prototype[method])).toBe(false);
      },
    );

    it('should let anyone check an invitation, the person is not logged in yet', () => {
      expect(isPublic(InvitationsController.prototype.isValid)).toBe(true);
    });
  });
});
