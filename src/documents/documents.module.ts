import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PdfModule } from 'src/pdf/pdf.module';
import { AiModule } from 'src/ai/ai.module';

@Module({
  imports: [PdfModule, AiModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
