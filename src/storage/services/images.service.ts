import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from '@/storage/entities/image.entity';
import { StorageService } from '@/storage/services/storage.service';
import { OptimizedImage } from '@/storage/services/image-optimizer.service';

/** Keeps the file in the bucket and its row in the `images` table together */
@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    private readonly storageService: StorageService,
  ) {}

  /** Uploads the file to `<folder>/<time>.webp` and saves its row, nothing stays behind if the row fails */
  async create(input: {
    companyId: number;
    folder: string;
    image: OptimizedImage;
    altText?: string | null;
  }): Promise<Image> {
    const { companyId, folder, image, altText } = input;
    const key = `${folder}/${Date.now()}.webp`;

    await this.storageService.upload(key, image.buffer, image.mimeType);

    try {
      return await this.imageRepository.save(
        this.imageRepository.create({
          key,
          url: this.storageService.publicUrl(key) as string,
          companyId,
          mimeType: image.mimeType,
          size: image.size,
          width: image.width,
          height: image.height,
          altText: altText?.trim() || null,
        }),
      );
    } catch (error) {
      await this.storageService.delete(key);
      throw error;
    }
  }

  /** Deletes the row and the file */
  async remove(image: Pick<Image, 'imageId' | 'key'>) {
    await this.imageRepository.delete({ imageId: image.imageId });
    await this.storageService.delete(image.key);
  }
}
