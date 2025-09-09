import { Module } from '@nestjs/common';
import { PdfLibRepository } from './infrastructure/pdf-lib.repository';
import { PDF_REPOSITORY } from './domain/repositories/pdf.repository';
import { PDF_GENERATION_REPOSITORY } from './domain/repositories/pdf-generation.repository';
import { PDFPuppeteerRepository } from './infrastructure/pdf-pupeteer.repository';

@Module({
	providers: [
		{
			provide: PDF_REPOSITORY,
			useClass: PdfLibRepository,
		},
		{
			provide: PDF_GENERATION_REPOSITORY,
			useClass: PDFPuppeteerRepository
		},
		PdfLibRepository,
		PDFPuppeteerRepository,
	],
	exports: [PDF_REPOSITORY, PDF_GENERATION_REPOSITORY],
})
export class PdfModule {}
