import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '@/users/controllers/users.controller';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/services/users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { getUsers: jest.Mock; patchUserProfile: jest.Mock };

  const user = { userId: 7, email: 'ana@drinkhouse.rs' } as User;

  beforeEach(async () => {
    usersService = { getUsers: jest.fn(), patchUserProfile: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  it('should return all the users', async () => {
    const users = [user];
    usersService.getUsers.mockResolvedValue(users);

    await expect(controller.getUsers()).resolves.toBe(users);
  });

  it('should return the user that is logged in', () => {
    expect(controller.getProfile(user)).toBe(user);
  });

  it('should change the profile of the user that is logged in', async () => {
    const dto = { phoneNumber: '064123456' };
    usersService.patchUserProfile.mockResolvedValue({ ...user, ...dto });

    await expect(controller.patchUserProfile(user, dto)).resolves.toEqual(
      expect.objectContaining(dto),
    );
    expect(usersService.patchUserProfile).toHaveBeenCalledWith(
      'ana@drinkhouse.rs',
      dto,
    );
  });
});
