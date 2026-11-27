import { WebsiteController } from '@/clients/controllers/website.controller';
import { SitePagesService } from '@/clients/services/site-pages.service';
import { WebsiteService } from '@/clients/services/website.service';
import { SectionType } from '@/clients/website.types';
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
  const pages = {
    createPage: jest.fn().mockReturnValue('page'),
    updatePage: jest.fn().mockReturnValue('page updated'),
    removePage: jest.fn().mockReturnValue('page removed'),
    setPageSections: jest.fn().mockReturnValue('sections set'),
    createSection: jest.fn().mockReturnValue('section'),
    updateSection: jest.fn().mockReturnValue('section updated'),
    removeSection: jest.fn().mockReturnValue('section removed'),
    setSectionImage: jest.fn().mockReturnValue('section image'),
    removeSectionImage: jest.fn().mockReturnValue('section image removed'),
    setSeoImage: jest.fn().mockReturnValue('seo image'),
    removeSeoImage: jest.fn().mockReturnValue('seo image removed'),
  };
  const controller = new WebsiteController(
    service as unknown as WebsiteService,
    pages as unknown as SitePagesService,
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
    expect(controller.setImage('map', file, 'x'.repeat(300), user)).toBe(
      'image',
    );
    // the alt text is cut to the column
    expect(service.setImage).toHaveBeenCalledWith(
      user,
      'map',
      file,
      'x'.repeat(255),
    );
    expect(controller.removeImage('logo', user)).toBe('removed');
    expect(controller.findContacts(user, { page: 1, limit: 10 })).toBe(
      'contacts',
    );
  });

  it('should hand the pages and the sections to their service with the user', () => {
    const file = {} as Express.Multer.File;

    expect(controller.createPage({ title: 'O nama' }, user)).toBe('page');
    expect(controller.updatePage(3, { title: 'x' }, user)).toBe('page updated');
    expect(pages.updatePage).toHaveBeenCalledWith(user, 3, { title: 'x' });
    expect(controller.removePage(3, user)).toBe('page removed');
    expect(controller.setPageSections(3, { sections: [] }, user)).toBe(
      'sections set',
    );
    expect(controller.createSection(3, { type: SectionType.HERO }, user)).toBe(
      'section',
    );
    expect(controller.updateSection(7, { title: 'x' }, user)).toBe(
      'section updated',
    );
    expect(controller.removeSection(7, user)).toBe('section removed');
    expect(controller.setSectionImage(7, file, undefined, user)).toBe(
      'section image',
    );
    expect(pages.setSectionImage).toHaveBeenCalledWith(
      user,
      7,
      file,
      undefined,
    );
    expect(controller.removeSectionImage(7, user)).toBe(
      'section image removed',
    );
    expect(controller.setSeoImage(3, file, 'alt', user)).toBe('seo image');
    expect(controller.removeSeoImage(3, user)).toBe('seo image removed');
  });
});
