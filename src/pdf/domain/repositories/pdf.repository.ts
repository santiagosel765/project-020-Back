import { Signature } from 'src/documents/dto/sign-document.dto';
import { SignaturePosition } from '../value-objects/signature-position.vo';

export const PDF_REPOSITORY = Symbol('PDF_REPOSITORY');

export interface PdfRepository {
  /**
   * Inserta una imagen de firma en un PDF en la posición indicada.
   * @param pdfBuffer El PDF original en buffer
   * @param signatureBuffer La imagen de la firma en buffer
   * @param position Posición de la firma en el PDF
   * @returns Buffer del PDF modificado
   */
  insertSignature(
    pdfBuffer: Buffer,
    signatureBuffer: Buffer,
    placeholder: string,
    position: SignaturePosition,
  ): Promise<Buffer | null>;
  insertMultipleSignature(
    pdfBuffer: Buffer,
    signatures: Signature[],
    position: SignaturePosition,
  ): Promise<Buffer | null>;

  extractText(pdfBuffer: Buffer): Promise<string>;

  fillTextAnchors(
    pdfBuffer: Buffer,
    replacements: Record<string, string>,
  ): Promise<Buffer>;
}
