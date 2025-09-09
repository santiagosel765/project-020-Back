export const PDF_GENERATION_REPOSITORY = Symbol('PDF_GENERATION_REPOSITORY');

export interface PdfGenerationRepository {
  generatePDFFromHTML(
    htmlContent: string,
  ): Promise<string>;

  replacePlaceholders( htmlContent: string, placeholders: { [key: string]: string } ): string;
} 
