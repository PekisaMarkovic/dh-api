import { BadRequestException, Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import {
  IMAGE_MAX_SIDE,
  IMAGE_WEBP_QUALITY,
} from '@/storage/storage.constants';

export interface OptimizedImage {
  buffer: Buffer;
  mimeType: 'image/webp';
  size: number;
  width: number;
  height: number;
}

@Injectable()
export class ImageOptimizerService {
  /**
   * Turns an uploaded image (jpg, png, webp, gif, avif...) into a WebP that fits
   * into IMAGE_MAX_SIDE x IMAGE_MAX_SIDE. The EXIF rotation is applied and the metadata is dropped.
   * @throws BadRequestException if the file is not an image
   */
  async toWebp(
    input: Buffer,
    maxSide: number = IMAGE_MAX_SIDE,
  ): Promise<OptimizedImage> {
    try {
      const { data, info } = await sharp(input)
        .rotate()
        .resize(maxSide, maxSide, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: IMAGE_WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        mimeType: 'image/webp',
        size: info.size,
        width: info.width,
        height: info.height,
      };
    } catch {
      throw new BadRequestException('The file is not a valid image.');
    }
  }
}
