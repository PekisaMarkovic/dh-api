import { Module } from '@nestjs/common';
import { PdfService } from '@/pdf/services/pdf.service';

@Module({
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
