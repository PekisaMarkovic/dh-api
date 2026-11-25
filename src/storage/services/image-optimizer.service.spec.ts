import { BadRequestException } from '@nestjs/common';
import * as sharp from 'sharp';
import { ImageOptimizerService } from '@/storage/services/image-optimizer.service';
import { IMAGE_MAX_SIDE } from '@/storage/storage.constants';

const png = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 30, b: 30 },
    },
  })
    .png()
    .toBuffer();

describe('ImageOptimizerService', () => {
  const service = new ImageOptimizerService();

  it('should make a big image a smaller WebP that keeps the proportions', async () => {
    const result = await service.toWebp(await png(2000, 1000));
    const meta = await sharp(result.buffer).metadata();

    expect(meta.format).toBe('webp');
    expect(result.mimeType).toBe('image/webp');
    expect(result.width).toBe(IMAGE_MAX_SIDE);
    expect(result.height).toBe(IMAGE_MAX_SIDE / 2);
    expect(result.size).toBe(result.buffer.length);
  });

  it('should not make a small image bigger', async () => {
    const result = await service.toWebp(await png(300, 200));

    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });

  it('should reject a file that is not an image', async () => {
    await expect(service.toWebp(Buffer.from('not an image'))).rejects.toThrow(
      BadRequestException,
    );
  });
});
