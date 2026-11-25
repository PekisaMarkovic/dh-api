import { WebsiteController } from '@/clients/controllers/website.controller';
import { WebsiteService } from '@/clients/services/website.service';
import { ClientRoleEnums } from '@/auth/enums';
import { rolesOf } from '@/common/testing/controller.helpers';
import { User } from '@/users/entities/user.entity';

describe('WebsiteController', () => {
  const service = {
    findOne: jest.fn().mockReturnValue('site'),
    update: jest.fn().mockReturnValue('updated'),
    setImage: jest.fn().mockReturnValue('image'),
    removeImage: jest.fn().mockReturnValue('removed'),
    findContacts: jest.fn().mockReturnValue('contacts'),
    publish: jest.fn().mockReturnValue('published'),
    unpublish: jest.fn().mockReturnValue('draft'),
  };
  const controller = new WebsiteController(
    service as unknown as WebsiteService,
  );
  const user = { userId: 1 } as User;

  it('should be only for the admins', () => {
    expect(rolesOf(WebsiteController)).toEqual([
      ClientRoleEnums.SUPER_ADMIN,
      ClientRoleEnums.ADMIN,
    ]);
  });

  it('should hand everything to the service with the user', () => {
    const file = {} as Express.Multer.File;

    expect(controller.findOne(user)).toBe('site');
    expect(controller.update({ city: 'x' }, user)).toBe('updated');
    expect(controller.setImage('hero', file, 'alt', user)).toBe('image');
    expect(service.setImage).toHaveBeenCalledWith(user, 'hero', file, 'alt');
    expect(controller.removeImage('hero', user)).toBe('removed');
    expect(controller.findContacts(user, { page: 1, limit: 10 })).toBe(
      'contacts',
    );
  });
});
