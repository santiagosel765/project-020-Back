import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PdfModule } from 'src/pdf/pdf.module';
import { AiModule } from 'src/ai/ai.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AWSService } from 'src/aws/aws.service';
import { AwsModule } from 'src/aws/aws.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [PdfModule, AiModule, PrismaModule, AwsModule, DatabaseModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
