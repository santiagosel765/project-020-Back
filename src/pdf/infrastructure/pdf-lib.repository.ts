import { Injectable, Logger } from '@nestjs/common';
import { PdfRepository } from '../domain/repositories/pdf.repository';
import { SignaturePosition } from '../domain/value-objects/signature-position.vo';
import { PDFDocument, rgb } from 'pdf-lib';
import { findPlaceholderCoordinates, pdfExtractText } from '../helpers';
import { Signature } from 'src/documents/dto/sign-document.dto';

// ? Basado en la doc: https://pdf-lib.js.org/ - Ejemplo Fill Form
@Injectable()
export class PdfLibRepository implements PdfRepository {

  logger = new Logger('PdfLibRepository');

  /**
   * Inserta una sola firma en el PDF en la posición indicada por el placeholder 'FIRMA_DIGITAL'.
   *
   * @param pdfBuffer - Buffer del archivo PDF original.
   * @param signatureBuffer - Buffer de la imagen de la firma (PNG).
   * @param position - (No utilizado actualmente) Objeto con información de posición de la firma.
   * @returns Buffer del PDF firmado o null si no se encuentra el placeholder.
   *
   * El método busca el placeholder 'FIRMA_DIGITAL' en el PDF, obtiene sus coordenadas,
   * y dibuja la firma en esa posición. Si no encuentra el placeholder, retorna null.
   */
  async insertSignature(
    pdfBuffer: Buffer,
    signatureBuffer: Buffer,
    position: SignaturePosition,
  ): Promise<Buffer | null> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const res = await findPlaceholderCoordinates(pdfBuffer, 'FIRMA_DIGITAL');

    if (!res) {
      return null;
    }

    const signatureImage = await pdfDoc.embedPng(signatureBuffer);
    const page = pdfDoc.getPage(res.page);

    if (res) {
      this.logger.log(`Coordenadas para la firma: (${res.x}, ${res.y})`);
      page.drawImage(signatureImage, {
        x: res.x,
        y: res.y,
        width: 150,
        height: 50,
      });

      return Buffer.from(await pdfDoc.save());
    }
    return null;
  }

  /**
   * Inserta múltiples firmas en un PDF en las posiciones indicadas por los placeholders.
   *
   * @param pdfBuffer - Buffer del archivo PDF original.
   * @param signatures - Arreglo de Signature.
   * @param position - (No utilizado actualmente) Objeto con información de posición de la firma.
   * @returns Buffer del PDF firmado o null si ocurre un error.
   *
   * El método busca en el PDF cada placeholder especificado, obtiene sus coordenadas,
   * y dibuja la firma correspondiente en esa posición. Si no encuentra un placeholder,
   * lanza un error. Al finalizar, retorna el PDF modificado como Buffer.
   */
  async insertMultipleSignature(
    pdfBuffer: Buffer,
    signatures: Signature[],
    position: SignaturePosition,
  ): Promise<Buffer | null> {
    let currentPdfBuffer = pdfBuffer;
    let pdfDoc = await PDFDocument.load(currentPdfBuffer);

    for (let index = 0; index < signatures.length; index++) {
      const signature = signatures[index];
      const res = await findPlaceholderCoordinates(
        currentPdfBuffer,
        signature.placeholder,
      );
      if (!res) {
        throw new Error(
          `No fue posible encontrar las coordenadas de la firma #${index} con placeholder "${signature.placeholder}"`,
        );
      }
      const signatureImage = await pdfDoc.embedPng(signature.signature);
      const page = pdfDoc.getPage(res.page);
      this.logger.log(`Coordenadas para la firma: (${res.x}, ${res.y})`);
      page.drawImage(signatureImage, {
        x: res.x,
        y: res.y,
        width: 150,
        height: 50,
      });

      // Guarda el PDF modificado y recarga para la siguiente iteración
      currentPdfBuffer = Buffer.from(await pdfDoc.save());
      pdfDoc = await PDFDocument.load(currentPdfBuffer);
    }

    return currentPdfBuffer;
  }

  extractText(pdfBuffer: Buffer): Promise<string> {
    return pdfExtractText(pdfBuffer);
  }

}
