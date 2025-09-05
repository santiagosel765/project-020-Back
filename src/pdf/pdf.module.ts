import { Module } from '@nestjs/common';
import { PdfLibRepository } from './infrastructure/pdf-lib.repository';
import { PDF_REPOSITORY } from './domain/repositories/pdf.repository';

@Module({
	providers: [
		{
			provide: PDF_REPOSITORY,
			useClass: PdfLibRepository,
		},
		PdfLibRepository,
	],
	exports: [PDF_REPOSITORY],
})
export class PdfModule {}
