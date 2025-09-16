import { Injectable, Logger } from '@nestjs/common';
import { PdfRepository } from '../domain/repositories/pdf.repository';
import { SignaturePosition } from '../domain/value-objects/signature-position.vo';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { findPlaceholderCoordinates, pdfExtractText } from '../helpers';
import { Signature } from 'src/documents/dto/sign-document.dto';
import { formatCurrentDate } from 'src/helpers/formatDate';

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
    placeholder: string,
    position: SignaturePosition,
  ): Promise<Buffer | null> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const res = await findPlaceholderCoordinates(pdfBuffer, placeholder);

    if (!res) {
      return null;
    }

    const signatureImage =
      signatureBuffer[0] === 0xff && signatureBuffer[1] === 0xd8
        ? await pdfDoc.embedJpg(signatureBuffer)
        : await pdfDoc.embedPng(signatureBuffer);
    const page = pdfDoc.getPage(res.page);

    const coordsX = res.x - 120;
    const coordsY = res.y - 25;
    if (res) {
      this.logger.log(`Coordenadas para la firma: (${coordsX}, ${coordsY})`);
      page.drawImage(signatureImage, {
        x: coordsX,
        y: coordsY,
        width: 100,
        height: 40,
      });

      page.drawRectangle({
        x: res.x,
        y: res.y - 12,
        width: 80, // Ajusta el ancho según el largo del placeholder
        height: 22, // Ajusta la altura según el tamaño de la fuente
        color: rgb(1, 1, 1), // Blanco
        borderColor: rgb(1, 1, 1),
        borderWidth: 0,
      });

      page.drawText(formatCurrentDate(), {
        x: res.x,
        y: res.y,
        size: 7,
        color: rgb(0, 0, 0),
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
      const signatureImage =
        signature.signature[0] === 0xff && signature.signature[1] === 0xd8
          ? await pdfDoc.embedJpg(signature.signature)
          : await pdfDoc.embedPng(signature.signature);
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

  async fillTextAnchors(
    pdfBuffer: Buffer,
    replacements: Record<string, string>,
  ): Promise<Buffer> {
    if (!pdfBuffer?.length) {
      return pdfBuffer;
    }

    const entries = Object.entries(replacements ?? {}).filter(
      ([anchor]) => !!anchor,
    );

    if (!entries.length) {
      return pdfBuffer;
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let modified = false;

    for (const [anchor, rawValue] of entries) {
      try {
        const coords = await findPlaceholderCoordinates(pdfBuffer, anchor);
        if (!coords) {
          this.logger.warn(
            `[fillTextAnchors] Placeholder de texto no encontrado: ${anchor}`,
          );
          continue;
        }

        const page = pdfDoc.getPage(coords.page);
        const fontSize = 7;
        const value = (rawValue ?? '').trim();
        const placeholderWidth = font.widthOfTextAtSize(anchor, fontSize);
        const textWidth = value ? font.widthOfTextAtSize(value, fontSize) : 0;
        const rectWidth = Math.max(placeholderWidth, textWidth) + 4;
        const rectHeight = fontSize + 8;
        const rectY = coords.y - fontSize;

        page.drawRectangle({
          x: coords.x,
          y: rectY,
          width: rectWidth,
          height: rectHeight,
          color: rgb(1, 1, 1),
          borderColor: rgb(1, 1, 1),
          borderWidth: 0,
        });

        if (value) {
          page.drawText(value, {
            x: coords.x,
            y: coords.y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }

        modified = true;
      } catch (error) {
        this.logger.error(
          `[fillTextAnchors] Error al reemplazar placeholder "${anchor}": ${error}`,
        );
      }
    }

    if (!modified) {
      return pdfBuffer;
    }

    return Buffer.from(await pdfDoc.save());
  }
}
