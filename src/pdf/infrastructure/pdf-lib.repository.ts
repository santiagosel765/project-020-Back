import { Injectable, Logger } from '@nestjs/common';
import {
  PdfRepository,
  RelativeField,
  TextAnchorFill,
} from '../domain/repositories/pdf.repository';
import { SignaturePosition } from '../domain/value-objects/signature-position.vo';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import { findPlaceholderCoordinates, pdfExtractText } from '../helpers';
import { Signature } from 'src/documents/dto/sign-document.dto';
import { formatCurrentDate } from 'src/helpers/formatDate';

// ? Basado en la doc: https://pdf-lib.js.org/ - Ejemplo Fill Form
@Injectable()
export class PdfLibRepository implements PdfRepository {
  logger = new Logger('PdfLibRepository');

  private readonly defaultFontSize = 8;
  private readonly defaultRectPadding = 2;
  private readonly defaultRectExtraHeight = 8;
  private readonly defaultRectYOffset = 4;

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
    items: TextAnchorFill[],
  ): Promise<Buffer> {
    if (!pdfBuffer?.length) {
      return pdfBuffer;
    }

    const targets = (items ?? []).filter((item) => item?.token?.trim());

    if (!targets.length) {
      return pdfBuffer;
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let modified = false;

    for (const item of targets) {
      const token = item.token.trim();

      try {
        const coords = await findPlaceholderCoordinates(pdfBuffer, token);
        if (!coords) {
          this.logger.warn(
            `[fillTextAnchors] Placeholder de texto no encontrado: ${token}`,
          );
          continue;
        }

        const page = pdfDoc.getPage(coords.page);
        const fontSize = item.fontSize ?? this.defaultFontSize;
        const padding = item.rectPadding ?? this.defaultRectPadding;
        const rawValue = (item.text ?? '').trim();
        const value = item.maxWidth
          ? this.truncateText(font, rawValue, fontSize, item.maxWidth)
          : rawValue;
        const placeholderWidth = font.widthOfTextAtSize(token, fontSize);
        const textWidth = value
          ? font.widthOfTextAtSize(value, fontSize)
          : 0;
        const targetWidth = Math.max(
          placeholderWidth,
          item.maxWidth ?? 0,
          textWidth,
        );
        const rectWidth = targetWidth + padding * 2;
        const rectHeight = fontSize + this.defaultRectExtraHeight;
        const rectX = coords.x - padding;
        const rectY = coords.y - fontSize - this.defaultRectYOffset;

        page.drawRectangle({
          x: rectX,
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

        this.logger.log(
          `[fillTextAnchors] token=${token} coords=(${coords.x.toFixed(
            2,
          )}, ${coords.y.toFixed(2)}) fontSize=${fontSize} maxWidth=${
            item.maxWidth ?? 'auto'
          } rectWidth=${rectWidth.toFixed(2)}`,
        );

        modified = true;
      } catch (error) {
        this.logger.error(
          `[fillTextAnchors] Error al reemplazar placeholder "${token}": ${error}`,
        );
      }
    }

    if (!modified) {
      return pdfBuffer;
    }

    return Buffer.from(await pdfDoc.save());
  }

  async fillRelativeToAnchor(
    pdfBuffer: Buffer,
    anchorToken: string,
    values: Record<'NOMBRE' | 'PUESTO' | 'GERENCIA' | 'FECHA', string>,
    fields: RelativeField[],
    signature?: { buffer: Buffer; dx: number; dy: number; width: number; height: number },
  ): Promise<Buffer> {
    if (!pdfBuffer?.length || !anchorToken) {
      return pdfBuffer;
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let modified = false;

    const anchor = await findPlaceholderCoordinates(pdfBuffer, anchorToken);
    if (!anchor) {
      this.logger.warn(
        `[fillRelativeToAnchor] Placeholder ancla no encontrado: ${anchorToken}`,
      );
      return pdfBuffer;
    }

    const page = pdfDoc.getPage(anchor.page);
    for (const field of fields ?? []) {
      if (!field) continue;

      const targetX = anchor.x + (field.dx ?? 0);
      const targetY = anchor.y + (field.dy ?? 0);

      if (field.rectWidth && field.rectHeight) {
        const rectY =
          targetY -
          field.rectHeight +
          (field.fontSize ?? this.defaultFontSize) +
          this.defaultRectYOffset;
        page.drawRectangle({
          x: targetX,
          y: rectY,
          width: field.rectWidth,
          height: field.rectHeight,
          color: rgb(1, 1, 1),
          borderColor: rgb(1, 1, 1),
          borderWidth: 0,
        });
        modified = true;
      }

      if (field.key === 'FIRMA_BOX') {
        this.logger.log(
          `[fillRelativeToAnchor] Limpieza de celda de firma en (${targetX.toFixed(
            2,
          )}, ${targetY.toFixed(2)}) tamaño=${field.rectWidth ?? 0}x${
            field.rectHeight ?? 0
          }`,
        );
        continue;
      }

      const rawValue = (values[field.key] ?? '').trim();
      const fontSize = field.fontSize ?? this.defaultFontSize;
      const value = field.maxWidth
        ? this.truncateText(font, rawValue, fontSize, field.maxWidth)
        : rawValue;

      if (value) {
        page.drawText(value, {
          x: targetX,
          y: targetY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }

      this.logger.log(
        `[fillRelativeToAnchor] ${field.key} -> coords=(${targetX.toFixed(
          2,
        )}, ${targetY.toFixed(2)}) fontSize=${fontSize} maxWidth=${
          field.maxWidth ?? 'auto'
        } rect=${field.rectWidth ?? 0}x${field.rectHeight ?? 0}`,
      );

      modified = true;
    }

    if (signature?.buffer?.length) {
      const signatureImage =
        signature.buffer[0] === 0xff && signature.buffer[1] === 0xd8
          ? await pdfDoc.embedJpg(signature.buffer)
          : await pdfDoc.embedPng(signature.buffer);

      const sigX = anchor.x + signature.dx;
      const sigY = anchor.y + signature.dy;

      page.drawImage(signatureImage, {
        x: sigX,
        y: sigY,
        width: signature.width,
        height: signature.height,
      });

      this.logger.log(
        `[fillRelativeToAnchor] Firma dibujada en (${sigX.toFixed(
          2,
        )}, ${sigY.toFixed(2)}) tamaño=${signature.width}x${
          signature.height
        } bufferSize=${signature.buffer.length}`,
      );

      modified = true;
    }

    if (!modified) {
      return pdfBuffer;
    }

    return Buffer.from(await pdfDoc.save());
  }

  private truncateText(
    font: PDFFont,
    text: string,
    fontSize: number,
    maxWidth: number,
  ): string {
    const value = text?.trim?.() ?? '';
    if (!value || !maxWidth) {
      return value;
    }

    if (font.widthOfTextAtSize(value, fontSize) <= maxWidth) {
      return value;
    }

    const ellipsis = '...';
    const ellipsisWidth = font.widthOfTextAtSize(ellipsis, fontSize);
    if (ellipsisWidth >= maxWidth) {
      return ellipsis;
    }

    let result = '';
    for (const char of value) {
      const next = result + char;
      if (
        font.widthOfTextAtSize(next, fontSize) + ellipsisWidth >
        maxWidth
      ) {
        break;
      }
      result = next;
    }

    return result ? `${result}${ellipsis}` : ellipsis;
  }
}
