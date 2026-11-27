import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { ClientContactedBy } from '@/clients/entities/client-contacted-by.entity';
import { Page } from '@/clients/entities/page.entity';
import { Section } from '@/clients/entities/section.entity';
import { WebsiteService } from '@/clients/services/website.service';
import { Drink } from '@/drinks/entities/drink.entity';
import { User } from '@/users/entities/user.entity';

describe('WebsiteService', () => {
  const user = { userId: 1, companyId: 4 } as User;
  let clientRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let drinkRepository: { count: jest.Mock; find: jest.Mock };
  let pageRepository: {
    count: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let sectionRepository: { find: jest.Mock };
  let companiesService: { findOne: jest.Mock };
  let storage: { clientFolder: jest.Mock };
  let optimizer: { toWebp: jest.Mock };
  let images: { create: jest.Mock; remove: jest.Mock };
  let revalidation: { notify: jest.Mock };
  let service: WebsiteService;

  const stored = (overrides: Partial<Client> = {}) =>
    ({
      clientId: 'abc',
      name: 'Drink House web',
      companyId: 4,
      city: 'Loznica',
      logoImage: null,
      ...overrides,
    }) as unknown as Client;

  beforeEach(() => {
    clientRepository = {
      findOne: jest.fn().mockResolvedValue(stored()),
      save: jest.fn((e: Client) => Promise.resolve(e)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    drinkRepository = {
      count: jest.fn().mockResolvedValue(2),
      find: jest.fn().mockResolvedValue([]),
    };
    pageRepository = {
      count: jest.fn().mockResolvedValue(2),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((e: unknown) => Promise.resolve(e)),
      create: jest.fn((e: unknown) => e),
    };
    sectionRepository = { find: jest.fn().mockResolvedValue([]) };
    companiesService = {
      findOne: jest
        .fn()
        .mockResolvedValue({ companyId: 4, name: 'DRINK HOUSE' }),
    };
    storage = {
      clientFolder: jest
        .fn()
        .mockReturnValue('local/company-drink-house-4/client/general'),
    };
    optimizer = {
      toWebp: jest.fn().mockResolvedValue({
        buffer: Buffer.from('w'),
        mimeType: 'image/webp',
        size: 1,
        width: 2000,
        height: 900,
      }),
    };
    images = {
      create: jest.fn().mockResolvedValue({ imageId: 9, key: 'k' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    revalidation = { notify: jest.fn().mockResolvedValue(undefined) };
    service = new WebsiteService(
      clientRepository as unknown as Repository<Client>,
      {} as Repository<ClientContactedBy>,
      drinkRepository as unknown as Repository<Drink>,
      pageRepository as unknown as Repository<Page>,
      sectionRepository as unknown as Repository<Section>,
      companiesService as never,
      storage as never,
      optimizer as never,
      images as never,
      revalidation as never,
    );
  });

  describe('findOne', () => {
    it('should find the site of the company of the user', async () => {
      await service.findOne(user);

      expect(clientRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 4 } }),
      );
    });

    it('should return every page with its SEO and its sections in order', async () => {
      pageRepository.find.mockResolvedValue([
        {
          pageId: 1,
          title: 'Početna',
          slug: '',
          status: 'published',
          position: 0,
          seo: { title: 't', description: null, image: null },
          pageSections: [
            { sectionId: 7, position: 0, isVisible: true },
            { sectionId: 8, position: 1, isVisible: false },
          ],
        },
      ]);

      const site = await service.findOne(user);

      expect(site.pages).toEqual([
        {
          pageId: 1,
          title: 'Početna',
          slug: '',
          status: 'published',
          position: 0,
          seo: { title: 't', description: null, image: null },
          sections: [
            { sectionId: 7, position: 0, isVisible: true },
            { sectionId: 8, position: 1, isVisible: false },
          ],
        },
      ]);
    });

    it('should add the names and images of the picked drinks of a section in the picked order', async () => {
      sectionRepository.find.mockResolvedValue([
        { sectionId: 3, type: 'featured', content: { drinkIds: [6, 5, 99] } },
        { sectionId: 4, type: 'hero', content: {} },
      ]);
      drinkRepository.find.mockResolvedValue([
        { drinkId: 5, name: 'FANTA', image: null },
        { drinkId: 6, name: 'COLA', image: { url: 'https://img/cola.webp' } },
      ]);

      const site = await service.findOne(user);

      expect(site.sections[0].drinks).toEqual([
        { drinkId: 6, name: 'COLA', imageUrl: 'https://img/cola.webp' },
        { drinkId: 5, name: 'FANTA', imageUrl: null },
      ]);
      expect(site.sections[1].drinks).toEqual([]);
    });

    it('should give a site without pages the home page and the menu', async () => {
      pageRepository.count.mockResolvedValue(0);

      await service.findOne(user);

      expect(pageRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          clientId: 'abc',
          slug: '',
          status: 'published',
          position: 0,
        }),
        expect.objectContaining({ slug: 'karta-pica', position: 1 }),
      ]);
    });

    it('should not add pages to a site that has them', async () => {
      await service.findOne(user);

      expect(pageRepository.save).not.toHaveBeenCalled();
    });

    it('should say 404 when the company has no site', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(user)).rejects.toThrow(NotFoundException);
    });

    it('should say 404 for a user without a company', async () => {
      await expect(
        service.findOne({ userId: 2, companyId: null } as unknown as User),
      ).rejects.toThrow(NotFoundException);
      expect(clientRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should change the general info', async () => {
      await service.update(user, { city: 'Šabac', phone: '+381 15 111 222' });

      const saved = clientRepository.save.mock.calls[0][0];
      expect(saved.city).toBe('Šabac');
      expect(saved.phone).toBe('+381 15 111 222');
    });
  });

  describe('publish', () => {
    const completeClient = () =>
      stored({
        status: 'draft',
        name: 'Drink House',
        city: 'Loznica',
        address: 'a',
        phone: '1',
        instagram: 'https://i',
        workingHours: '7',
        logoImageId: 1,
      } as unknown as Partial<Client>);

    it('should say what is missing in the site that is returned', async () => {
      const site = await service.findOne(user);

      expect(site.completeness.isComplete).toBe(false);
      expect(site.completeness.missing).toContain('general.logo');
    });

    it('should not publish a site that is not complete', async () => {
      await expect(service.publish(user)).rejects.toThrow(BadRequestException);
      expect(clientRepository.update).not.toHaveBeenCalled();
    });

    it('should publish a complete site', async () => {
      clientRepository.findOne.mockResolvedValue(completeClient());

      await service.publish(user);

      expect(clientRepository.update).toHaveBeenCalledWith(
        { clientId: 'abc' },
        { status: 'published', publishedAt: expect.any(Date) },
      );
    });

    it('should not change a site that is already published', async () => {
      clientRepository.findOne.mockResolvedValue({
        ...completeClient(),
        status: 'published',
      });

      await service.publish(user);

      expect(clientRepository.update).not.toHaveBeenCalled();
    });

    it('should take a published site back to a draft', async () => {
      clientRepository.findOne.mockResolvedValue(
        stored({ status: 'published' } as unknown as Partial<Client>),
      );

      await service.unpublish(user);

      expect(clientRepository.update).toHaveBeenCalledWith(
        { clientId: 'abc' },
        { status: 'draft' },
      );
    });
  });

  describe('telling the site', () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    it('should tell the site to drop its cache after every change', async () => {
      await service.update(user, { city: 'Beograd' });
      await service.setLogo(user, file);
      await service.removeLogo(user);
      clientRepository.findOne.mockResolvedValue({
        ...stored(),
        status: 'published',
      });
      await service.unpublish(user);

      expect(revalidation.notify).toHaveBeenCalledTimes(4);
    });

    it('should not tell the site when nothing was saved', async () => {
      await expect(service.publish(user)).rejects.toThrow(BadRequestException);

      expect(revalidation.notify).not.toHaveBeenCalled();
    });
  });

  describe('logo', () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    it('should save the logo small, in the client folder general', async () => {
      await service.setLogo(user, file);

      expect(optimizer.toWebp).toHaveBeenCalledWith(file.buffer, 600);
      expect(storage.clientFolder).toHaveBeenCalledWith(
        { companyId: 4, name: 'DRINK HOUSE' },
        'general',
      );
      expect(images.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 4,
          folder: 'local/company-drink-house-4/client/general',
        }),
      );
      expect(clientRepository.update).toHaveBeenCalledWith(
        { clientId: 'abc' },
        { logoImageId: 9 },
      );
    });

    it('should delete the old picture when it is replaced', async () => {
      const old = { imageId: 3, key: 'old' };
      clientRepository.findOne.mockResolvedValue(
        stored({ logoImage: old } as Partial<Client>),
      );

      await service.setLogo(user, file);

      expect(images.remove).toHaveBeenCalledWith(old);
    });

    it('should delete the new picture when the database fails', async () => {
      clientRepository.update.mockRejectedValue(new Error('db'));

      await expect(service.setLogo(user, file)).rejects.toThrow('db');
      expect(images.remove).toHaveBeenCalledWith(
        expect.objectContaining({ imageId: 9 }),
      );
    });

    it('should reject a request without a file', async () => {
      await expect(
        service.setLogo(user, undefined as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
      expect(images.create).not.toHaveBeenCalled();
    });

    it('should remove the logo', async () => {
      const old = { imageId: 3, key: 'old' };
      clientRepository.findOne.mockResolvedValue(
        stored({ logoImage: old } as Partial<Client>),
      );

      await service.removeLogo(user);

      expect(clientRepository.update).toHaveBeenCalledWith(
        { clientId: 'abc' },
        { logoImageId: null },
      );
      expect(images.remove).toHaveBeenCalledWith(old);
    });
  });
});
