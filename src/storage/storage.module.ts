import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Image } from '@/storage/entities/image.entity';
import { ImagesService } from '@/storage/services/images.service';
import { StorageService } from '@/storage/services/storage.service';
import { ImageOptimizerService } from '@/storage/services/image-optimizer.service';

@Module({
  imports: [TypeOrmModule.forFeature([Image])],
  providers: [StorageService, ImageOptimizerService, ImagesService],
  exports: [StorageService, ImageOptimizerService, ImagesService],
})
export class StorageModule {}
