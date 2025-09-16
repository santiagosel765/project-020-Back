import { Injectable, Logger } from '@nestjs/common';
import {
  FillRowByColumnsOptions,
  FillRowByColumnsResult,
  OFFSETS_DEFAULT,
  PdfRepository,
  RelativeField,
  SIGNATURE_DEFAULT,
  SignatureTableColumns,
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
    options?: { writeDate?: boolean; drawSignature?: boolean },
  ): Promise<Buffer | null> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const res = await findPlaceholderCoordinates(pdfBuffer, placeholder);

    if (!res) {
      return null;
    }

    const page = pdfDoc.getPage(res.page);

    const signatureShouldDraw = options?.drawSignature !== false;

    const columns = await this.locateSignatureTableColumns(pdfBuffer, res.page);

    let mode: 'columns' | 'fallback' = 'fallback';
    if (columns) {
      mode = 'columns';
      this.logger.log(
        `[insertSignature] columnas detectadas: ${Object.entries(columns)
          .map(([key, value]) => `${key}=(x:${value.x.toFixed(2)},w:${value.w.toFixed(2)})`)
          .join(', ')}`,
      );
    }

    let signatureImage: any = null;
    if (signatureShouldDraw && signatureBuffer?.length) {
      signatureImage =
        signatureBuffer[0] === 0xff && signatureBuffer[1] === 0xd8
          ? await pdfDoc.embedJpg(signatureBuffer)
          : await pdfDoc.embedPng(signatureBuffer);
    }

    let signatureWidth = SIGNATURE_DEFAULT.width;
    let signatureHeight = SIGNATURE_DEFAULT.height;
    let signatureX = res.x - 120;
    let signatureY = res.y - 25;
    let appliedScale = 1;

    if (columns && signatureImage) {
      const availableWidth = Math.max(columns.firma.w - 6, 1);
      const rawWidth = signatureImage.width;
      const rawHeight = signatureImage.height;
      appliedScale = rawWidth > 0 ? Math.min(1, availableWidth / rawWidth) : 1;
      signatureWidth = rawWidth * appliedScale;
      signatureHeight = rawHeight * appliedScale;
      signatureX = columns.firma.x + (columns.firma.w - signatureWidth) / 2;
      signatureY = res.y - 25;

      const cleanupHeight = Math.max(signatureHeight + 12, 50);
      const cleanupY = signatureY - 6;
      page.drawRectangle({
        x: columns.firma.x,
        y: cleanupY,
        width: columns.firma.w,
        height: cleanupHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(1, 1, 1),
        borderWidth: 0,
      });
    }

    if (signatureImage && signatureShouldDraw) {
      this.logger.log(
        `[insertSignature] modo=${mode} firma (${signatureWidth.toFixed(2)}x${signatureHeight.toFixed(
          2,
        )}) escala=${appliedScale.toFixed(3)} coords=(${signatureX.toFixed(2)}, ${signatureY.toFixed(2)})`,
      );
      page.drawImage(signatureImage, {
        x: signatureX,
        y: signatureY,
        width: signatureWidth,
        height: signatureHeight,
      });
    } else {
      this.logger.log(
        `[insertSignature] modo=${mode} firma omitida (drawSignature=${signatureShouldDraw})`,
      );
    }

    const shouldWriteDate = options?.writeDate !== false;

    if (shouldWriteDate) {
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 7;
      const padding = this.defaultRectPadding;
      const rectHeight = fontSize + this.defaultRectExtraHeight;
      const rectY = res.y - fontSize - this.defaultRectYOffset;

      const dateX = columns ? columns.fecha.x : res.x;
      const dateWidth = columns ? columns.fecha.w : 80;
      const textX = dateX + padding;
      const maxWidth = Math.max(dateWidth - padding * 2, 0);
      const dateValue = this.truncateText(
        font,
        formatCurrentDate(),
        fontSize,
        maxWidth,
      );

      page.drawRectangle({
        x: dateX,
        y: rectY,
        width: dateWidth,
        height: rectHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(1, 1, 1),
        borderWidth: 0,
      });

      if (dateValue) {
        page.drawText(dateValue, {
          x: textX,
          y: res.y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    } else {
      this.logger.log('[insertSignature] escritura de fecha omitida');
    }

    return Buffer.from(await pdfDoc.save());
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

  async locateSignatureTableColumns(
    pdfBuffer: Buffer,
    page: number,
  ): Promise<SignatureTableColumns | null> {
    const headers = [
      { key: 'nombre', label: 'Nombre' },
      { key: 'puesto', label: 'Puesto' },
      { key: 'gerencia', label: 'Gerencia' },
      { key: 'firma', label: 'Firma' },
      { key: 'fecha', label: 'Fecha' },
    ] as const;

    const coordinates: { key: typeof headers[number]['key']; x: number }[] = [];

    for (const header of headers) {
      const coords = await findPlaceholderCoordinates(pdfBuffer, header.label);
      if (!coords || coords.page !== page) {
        this.logger.warn(
          `[locateSignatureTableColumns] encabezado "${header.label}" no encontrado en página ${page + 1}`,
        );
        return null;
      }
      coordinates.push({ key: header.key, x: coords.x });
    }

    const sorted = [...coordinates].sort((a, b) => a.x - b.x);

    const gutter = 6;
    const columns: Partial<Record<typeof headers[number]['key'], SignatureTableColumns[keyof SignatureTableColumns]>> =
      {};

    for (let index = 0; index < sorted.length; index++) {
      const current = sorted[index];
      const next = sorted[index + 1];
      let width = next ? next.x - current.x - gutter : 100;
      if (index === sorted.length - 1) {
        width = Math.max(Math.min(width, 110), 90);
      }
      width = Math.max(width, 60);

      const original = coordinates.find((c) => c.key === current.key);
      if (!original) {
        return null;
      }

      columns[current.key] = { x: original.x, w: width };
    }

    const resolved = columns as SignatureTableColumns;

    this.logger.log(
      `[locateSignatureTableColumns] página ${page + 1} -> ${Object.entries(resolved)
        .map(([key, value]) => `${key}=(x:${value.x.toFixed(2)},w:${value.w.toFixed(2)})`)
        .join(', ')}`,
    );

    return resolved;
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

  async fillRowByColumns(
    pdfBuffer: Buffer,
    anchorToken: string,
    values: Record<'NOMBRE' | 'PUESTO' | 'GERENCIA' | 'FECHA', string>,
    options?: FillRowByColumnsOptions,
  ): Promise<FillRowByColumnsResult> {
    if (!pdfBuffer?.length || !anchorToken) {
      return { buffer: pdfBuffer, mode: 'fallback' };
    }

    const anchor = await findPlaceholderCoordinates(pdfBuffer, anchorToken);
    if (!anchor) {
      this.logger.warn(
        `[fillRowByColumns] Placeholder ancla no encontrado: ${anchorToken}`,
      );
      const fallback = await this.fillRelativeToAnchor(
        pdfBuffer,
        anchorToken,
        values,
        OFFSETS_DEFAULT,
        options?.signatureBuffer?.length
          ? { buffer: options.signatureBuffer, ...SIGNATURE_DEFAULT }
          : undefined,
      );
      return { buffer: fallback, mode: 'fallback' };
    }

    const columns = await this.locateSignatureTableColumns(pdfBuffer, anchor.page);
    if (!columns) {
      const fallback = await this.fillRelativeToAnchor(
        pdfBuffer,
        anchorToken,
        values,
        OFFSETS_DEFAULT,
        options?.signatureBuffer?.length
          ? { buffer: options.signatureBuffer, ...SIGNATURE_DEFAULT }
          : undefined,
      );
      this.logger.log('[fillRowByColumns] columnas no detectadas, usando offsets');
      return { buffer: fallback, mode: 'fallback' };
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPage(anchor.page);

    const columnOrder: Array<keyof SignatureTableColumns> = [
      'nombre',
      'puesto',
      'gerencia',
      'firma',
      'fecha',
    ];

    const valueMap: Record<keyof SignatureTableColumns, keyof typeof values | null> = {
      nombre: 'NOMBRE',
      puesto: 'PUESTO',
      gerencia: 'GERENCIA',
      firma: null,
      fecha: 'FECHA',
    } as const;

    const padding = this.defaultRectPadding;
    const baselineY = anchor.y;

    for (const key of columnOrder) {
      const col = columns[key];
      if (!col) continue;

      if (key === 'firma') {
        continue;
      }

      const fontSize = key === 'fecha' ? 7 : this.defaultFontSize;
      const rectHeight = fontSize + this.defaultRectExtraHeight;
      const rectX = col.x;
      const rectY = baselineY - fontSize - this.defaultRectYOffset;

      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: col.w,
        height: rectHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(1, 1, 1),
        borderWidth: 0,
      });

      if (key === 'fecha' && options?.writeDate === false) {
        continue;
      }

      const valueKey = valueMap[key];
      if (!valueKey) continue;
      const rawValue = (values[valueKey] ?? '').trim();
      if (!rawValue) continue;

      const maxWidth = Math.max(col.w - padding * 2, 0);
      const value = this.truncateText(font, rawValue, fontSize, maxWidth);
      if (!value) continue;

      page.drawText(value, {
        x: col.x + padding,
        y: baselineY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    let appliedScale = 1;
    let signatureWidth = SIGNATURE_DEFAULT.width;
    let signatureHeight = SIGNATURE_DEFAULT.height;

    if (options?.signatureBuffer?.length) {
      const signatureImage =
        options.signatureBuffer[0] === 0xff && options.signatureBuffer[1] === 0xd8
          ? await pdfDoc.embedJpg(options.signatureBuffer)
          : await pdfDoc.embedPng(options.signatureBuffer);

      const availableWidth = Math.max(columns.firma.w - 6, 1);
      const rawWidth = signatureImage.width;
      const rawHeight = signatureImage.height;
      appliedScale = rawWidth > 0 ? Math.min(1, availableWidth / rawWidth) : 1;
      signatureWidth = rawWidth * appliedScale;
      signatureHeight = rawHeight * appliedScale;

      const sigX = columns.firma.x + (columns.firma.w - signatureWidth) / 2;
      const sigY = baselineY - 25;
      const cleanupHeight = Math.max(signatureHeight + 12, 50);
      const cleanupY = sigY - 6;

      page.drawRectangle({
        x: columns.firma.x,
        y: cleanupY,
        width: columns.firma.w,
        height: cleanupHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(1, 1, 1),
        borderWidth: 0,
      });

      page.drawImage(signatureImage, {
        x: sigX,
        y: sigY,
        width: signatureWidth,
        height: signatureHeight,
      });

      this.logger.log(
        `[fillRowByColumns] firma ${signatureWidth.toFixed(2)}x${signatureHeight.toFixed(2)} escala=${appliedScale.toFixed(3)} columna=${columns.firma.x.toFixed(2)} ancho=${columns.firma.w.toFixed(2)}`,
      );
    }

    const buffer = Buffer.from(await pdfDoc.save());
    this.logger.log('[fillRowByColumns] modo columnas aplicado');
    return { buffer, mode: 'columns' };
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
