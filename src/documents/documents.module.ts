import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PdfModule } from 'src/pdf/pdf.module';
import { AiModule } from 'src/ai/ai.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AwsModule } from 'src/aws/aws.module';
import { DatabaseModule } from 'src/database/database.module';
import { WsModule } from 'src/ws/ws.module';

@Module({
  imports: [PdfModule, AiModule, PrismaModule, AwsModule, DatabaseModule, WsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
