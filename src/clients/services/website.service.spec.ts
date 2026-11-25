import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { ClientContactedBy } from '@/clients/entities/client-contacted-by.entity';
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
      sections: { hero: { title: 'Stari naslov', text: 'Tekst' } },
      heroImage: null,
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
    companiesService = {
      findOne: jest
        .fn()
        .mockResolvedValue({ companyId: 4, name: 'DRINK HOUSE' }),
    };
    storage = {
      clientFolder: jest
        .fn()
        .mockReturnValue('local/company-drink-house-4/client/hero'),
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

    it('should add the names of the picked drinks in the picked order', async () => {
      clientRepository.findOne.mockResolvedValue(
        stored({ sections: { featured: { drinkIds: [6, 5, 99] } } }),
      );
      drinkRepository.find.mockResolvedValue([
        { drinkId: 5, name: 'FANTA' },
        { drinkId: 6, name: 'COLA' },
      ]);

      const site = await service.findOne(user);

      expect(site.featuredDrinks).toEqual([
        { drinkId: 6, name: 'COLA' },
        { drinkId: 5, name: 'FANTA' },
      ]);
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

    it('should merge a section: the sent texts replace, the rest stays', async () => {
      await service.update(user, { hero: { title: 'Novi naslov' } });

      expect(clientRepository.save.mock.calls[0][0].sections.hero).toEqual({
        title: 'Novi naslov',
        text: 'Tekst',
      });
    });

    it('should save the picked drinks only when they are drinks of the company', async () => {
      await service.update(user, { featured: { drinkIds: [5, 6] } });

      expect(drinkRepository.count).toHaveBeenCalled();
      expect(clientRepository.save.mock.calls[0][0].sections.featured).toEqual({
        drinkIds: [5, 6],
      });
    });

    it('should refuse a drink of another company', async () => {
      drinkRepository.count.mockResolvedValue(1);

      await expect(
        service.update(user, { featured: { drinkIds: [5, 999] } }),
      ).rejects.toThrow(BadRequestException);
      expect(clientRepository.save).not.toHaveBeenCalled();
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
        heroImageId: 2,
        storyImageId: 3,
        promoImageId: 4,
        ogImageId: 5,
        sections: {
          hero: { title: 't', subtitle: 's', text: 'x', buttonText: 'b' },
          featured: { title: 't', buttonText: 'b', drinkIds: [1] },
          story: {
            title: 't',
            paragraph1: 'a',
            paragraph2: 'b',
            buttonText: 'c',
          },
          promo: { title: 't', text: 'x', buttonText: 'b' },
          seo: {
            title: 't',
            description: 'd',
            menuTitle: 'm',
            menuDescription: 'md',
          },
        },
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
      await service.setImage(user, 'hero', file);
      await service.removeImage(user, 'hero');
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

  describe('images', () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    it('should save the picture in the client folder of the section, with the size of the slot', async () => {
      await service.setImage(user, 'hero', file);

      expect(optimizer.toWebp).toHaveBeenCalledWith(file.buffer, 2000);
      expect(storage.clientFolder).toHaveBeenCalledWith(
        { companyId: 4, name: 'DRINK HOUSE' },
        'hero',
      );
      expect(images.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 4,
          folder: 'local/company-drink-house-4/client/hero',
        }),
      );
      expect(clientRepository.update).toHaveBeenCalledWith(
        { clientId: 'abc' },
        { heroImageId: 9 },
      );
    });

    it('should save the picture for sharing in the folder seo', async () => {
      await service.setImage(user, 'og', file);

      expect(storage.clientFolder).toHaveBeenCalledWith(
        expect.anything(),
        'seo',
      );
      expect(clientRepository.update).toHaveBeenCalledWith(
        { clientId: 'abc' },
        { ogImageId: 9 },
      );
    });

    it('should use the folder general and a small size for the logo', async () => {
      await service.setImage(user, 'logo', file);

      expect(optimizer.toWebp).toHaveBeenCalledWith(file.buffer, 600);
      expect(storage.clientFolder).toHaveBeenCalledWith(
        expect.anything(),
        'general',
      );
    });

    it('should delete the old picture when it is replaced', async () => {
      const old = { imageId: 3, key: 'old' };
      clientRepository.findOne.mockResolvedValue(
        stored({ heroImage: old } as Partial<Client>),
      );

      await service.setImage(user, 'hero', file);

      expect(images.remove).toHaveBeenCalledWith(old);
    });

    it('should delete the new picture when the database fails', async () => {
      clientRepository.update.mockRejectedValue(new Error('db'));

      await expect(service.setImage(user, 'hero', file)).rejects.toThrow('db');
      expect(images.remove).toHaveBeenCalledWith(
        expect.objectContaining({ imageId: 9 }),
      );
    });

    it('should reject a request without a file', async () => {
      await expect(
        service.setImage(
          user,
          'hero',
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should remove a picture', async () => {
      const old = { imageId: 3, key: 'old' };
      clientRepository.findOne.mockResolvedValue(
        stored({ storyImage: old } as Partial<Client>),
      );

      await service.removeImage(user, 'story');

      expect(clientRepository.update).toHaveBeenCalledWith(
        { clientId: 'abc' },
        { storyImageId: null },
      );
      expect(images.remove).toHaveBeenCalledWith(old);
    });
  });
});
