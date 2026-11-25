import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Image } from '@/storage/entities/image.entity';
import { ImagesService } from '@/storage/services/images.service';
import { StorageService } from '@/storage/services/storage.service';

describe('ImagesService', () => {
  let service: ImagesService;
  let repository: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let storage: { upload: jest.Mock; delete: jest.Mock; publicUrl: jest.Mock };

  const image = {
    buffer: Buffer.from('webp'),
    mimeType: 'image/webp' as const,
    size: 4,
    width: 800,
    height: 600,
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((e: Partial<Image>) => e),
      save: jest.fn((e: Partial<Image>) =>
        Promise.resolve({ imageId: 1, ...e }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      publicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
    };

    const module = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: getRepositoryToken(Image), useValue: repository },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(ImagesService);
  });

  it('should upload the file and save everything about it', async () => {
    const result = await service.create({
      companyId: 3,
      folder: 'local/company-a-3/drinks/12',
      image,
      altText: '  Fanta ',
    });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^local\/company-a-3\/drinks\/12\/\d+\.webp$/),
      image.buffer,
      'image/webp',
    );
    expect(result).toEqual(
      expect.objectContaining({
        companyId: 3,
        mimeType: 'image/webp',
        size: 4,
        width: 800,
        height: 600,
        altText: 'Fanta',
        url: expect.stringMatching(/^https:\/\/cdn\.test\/local\//),
      }),
    );
  });

  it('should delete the file when the row can not be saved', async () => {
    repository.save.mockRejectedValue(new Error('db'));

    await expect(
      service.create({ companyId: 3, folder: 'local/x', image }),
    ).rejects.toThrow('db');
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('should delete the row and the file', async () => {
    await service.remove({ imageId: 5, key: 'local/a.webp' });

    expect(repository.delete).toHaveBeenCalledWith({ imageId: 5 });
    expect(storage.delete).toHaveBeenCalledWith('local/a.webp');
  });
});
