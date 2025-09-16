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
  CELL,
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

  // Devuelve [primerNombre, primerApellido]
  private firstNameAndFirstLast(value: string): [string, string] {
    const [firstName = '', firstLast = ''] = (value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return [firstName, firstLast];
  }

  private drawCenteredText(
    page: any,
    font: PDFFont,
    text: string,
    x: number, // borde izquierdo de la celda
    y: number, // baseline
    width: number, // ancho de la celda
    fontSize: number,
  ) {
    const w = font.widthOfTextAtSize(text, fontSize);
    const startX = x + (width - w) / 2;
    const boundedX = Math.max(x, Math.min(startX, x + Math.max(0, width - w)));
    page.drawText(text, { x: boundedX, y, size: fontSize, font, color: rgb(0, 0, 0) });
  }

  // Dibuja dos líneas (si la segunda está vacía, solo dibuja la primera)
  private drawTwoLines(
    page: any,
    font: PDFFont,
    line1: string,
    line2: string,
    x: number,
    y: number,
    width: number,
    fontSize: number,
  ) {
    const gap = 2;
    const line1Y = y + fontSize + gap;
    const line2Y = y;
    const l1 = this.truncateText(font, line1 || '', fontSize, width);
    if (l1) {
      this.drawTextLeft(page, font, l1, x, line1Y, fontSize);
    }
    const l2 = this.truncateText(font, line2 || '', fontSize, width);
    if (l2) {
      this.drawTextLeft(page, font, l2, x, line2Y, fontSize);
    }
  }

  private drawTextLeft(
    page: any,
    font: PDFFont,
    text: string,
    x: number,
    y: number,
    fontSize: number,
  ) {
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
  }

  // Centra y escala una imagen dentro de una caja (sin salirse)
  private drawImageFitAndCenter(
    page: any,
    img: any,
    box: { x: number; y: number; w: number; h: number },
  ) {
    const iw = img.width,
      ih = img.height;
    const scale = Math.min(box.w / iw, box.h / ih, 1); // nunca crecer
    const w = iw * scale;
    const h = ih * scale;
    const x = box.x + (box.w - w) / 2;
    const y = box.y + (box.h - h) / 2;
    page.drawImage(img, { x, y, width: w, height: h });
  }

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
    let firmaBox: { x: number; y: number; w: number; h: number } | null = null;

    for (const field of fields ?? []) {
      if (!field) continue;

      const targetX = anchor.x + (field.dx ?? 0);
      const targetY = anchor.y + (field.dy ?? 0);
      const rectWidth = field.rectWidth ?? 0;
      const rectHeight = field.rectHeight ?? 0;
      const fontSize = field.fontSize ?? this.defaultFontSize;

      let rectY: number | null = null;
      if (rectWidth && rectHeight) {
        rectY = targetY - rectHeight + fontSize;
        page.drawRectangle({
          x: targetX,
          y: rectY,
          width: rectWidth,
          height: rectHeight,
          color: rgb(1, 1, 1),
          borderColor: rgb(1, 1, 1),
          borderWidth: 0,
        });
        modified = true;
      }

      if (field.key === 'FIRMA_BOX') {
        const boxWidth = rectWidth || signature?.width || 0;
        const boxHeight = rectHeight || signature?.height || 0;
        const boxY =
          rectY ??
          (targetY - boxHeight + fontSize);
        firmaBox = {
          x: targetX,
          y: boxY,
          w: boxWidth,
          h: boxHeight,
        };
        this.logger.log(
          `[fillRelativeToAnchor] FIRMA_BOX -> box=(${firmaBox.x.toFixed(
            2,
          )}, ${firmaBox.y.toFixed(2)}) size=${firmaBox.w.toFixed(2)}x${
            firmaBox.h.toFixed(2)
          }`,
        );
        continue;
      }

      const rawValue = (values[field.key] ?? '').trim();
      const cellWidth = rectWidth || field.maxWidth || 0;
      const textWidth = cellWidth > 0 ? Math.max(cellWidth - 4, 1) : 0;
      const leftX = targetX + 2;

      if (field.key === 'NOMBRE' && field.multiline) {
        const [firstName, firstLast] = this.firstNameAndFirstLast(rawValue);
        if (firstName || firstLast) {
          this.drawTwoLines(
            page,
            font,
            firstName,
            firstLast,
            leftX,
            targetY,
            textWidth,
            fontSize,
          );
          modified = true;
        }

        this.logger.log(
          `[fillRelativeToAnchor] ${field.key} (multiline) -> coords=(${targetX.toFixed(
            2,
          )}, ${targetY.toFixed(2)}) fontSize=${fontSize} width=${cellWidth} ` +
            `line1="${firstName}" line2="${firstLast}"`,
        );
        continue;
      }

      let text = rawValue;
      if (cellWidth > 0) {
        text = this.truncateText(font, rawValue, fontSize, textWidth);
      }

      if (text) {
        if (field.align === 'center' && cellWidth > 0) {
          this.drawCenteredText(page, font, text, targetX, targetY, cellWidth, fontSize);
        } else {
          this.drawTextLeft(page, font, text, leftX, targetY, fontSize);
        }
        modified = true;
      }

      this.logger.log(
        `[fillRelativeToAnchor] ${field.key} -> coords=(${targetX.toFixed(
          2,
        )}, ${targetY.toFixed(2)}) fontSize=${fontSize} width=${cellWidth} align=${
          field.align ?? 'left'
        } text="${text}"`,
      );
    }

    if (!firmaBox && signature) {
      firmaBox = {
        x: anchor.x + signature.dx,
        y: anchor.y + signature.dy,
        w: signature.width,
        h: signature.height,
      };
    }

    if (firmaBox && signature?.buffer?.length) {
      const signatureImage =
        signature.buffer[0] === 0xff && signature.buffer[1] === 0xd8
          ? await pdfDoc.embedJpg(signature.buffer)
          : await pdfDoc.embedPng(signature.buffer);

      this.drawImageFitAndCenter(page, signatureImage, firmaBox);

      this.logger.log(
        `[fillRelativeToAnchor] Firma dibujada centrada en (${firmaBox.x.toFixed(
          2,
        )}, ${firmaBox.y.toFixed(2)}) caja=${firmaBox.w.toFixed(2)}x${
          firmaBox.h.toFixed(2)
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

    this.logger.log(
      `[fillRowByColumns] anchor=(${anchor.x.toFixed(2)}, ${anchor.y.toFixed(2)})`,
    );

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPage(anchor.page);

    this.logger.log(`[fillRowByColumns] cols=` + JSON.stringify(columns));

    const baselineY = anchor.y;
    const padding = this.defaultRectPadding;
    const rowHeight = CELL.height + 8; // altura un poco mayor para limpiar bien

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

    // --- Limpieza de toda la fila (borra placeholders que quedan detrás)
    const xs = Object.values(columns).map((c) => c.x);
    const rights = Object.values(columns).map((c) => c.x + c.w);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...rights);
    const totalWidth = x1 - x0;

    page.drawRectangle({
      x: x0,
      y: baselineY - rowHeight,
      width: totalWidth,
      height: rowHeight + 6, // un poco extra
      color: rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1),
      borderWidth: 0,
    });

    // --- Pintar valores por columna (nombre en dos líneas, fecha centrada)
    for (const key of columnOrder) {
      const col = columns[key];
      if (!col || key === 'firma') continue;

      const fontSize = key === 'fecha' ? 7 : this.defaultFontSize;
      if (key === 'fecha' && options?.writeDate === false) continue;

      const vk = valueMap[key];
      if (!vk) continue;

      const raw = (values[vk] ?? '').trim();
      if (!raw) continue;

      const maxW = Math.max(col.w - padding * 2, 0);

      if (key === 'nombre') {
        const [firstName, firstLast] = this.firstNameAndFirstLast(raw);
        this.drawTwoLines(
          page,
          font,
          firstName,
          firstLast,
          col.x + padding,
          baselineY,
          maxW,
          fontSize,
        );
        continue;
      }

      const text = this.truncateText(font, raw, fontSize, maxW);

      if (key === 'fecha') {
        this.drawCenteredText(page, font, text, col.x, baselineY, col.w, fontSize);
      } else {
        page.drawText(text, {
          x: col.x + padding,
          y: baselineY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }

    // --- Firma: escalar y centrar en X e Y dentro de su celda
    if (options?.signatureBuffer?.length) {
      const img =
        options.signatureBuffer[0] === 0xff && options.signatureBuffer[1] === 0xd8
          ? await pdfDoc.embedJpg(options.signatureBuffer)
          : await pdfDoc.embedPng(options.signatureBuffer);

      const availW = Math.max(columns.firma.w - 12, 1);
      const availH = rowHeight - 4;

      const wScale = availW / img.width;
      const hScale = availH / img.height;
      const scale = Math.min(wScale, hScale, 1);

      const sigW = img.width * scale;
      const sigH = img.height * scale;

      const sigX = columns.firma.x + (columns.firma.w - sigW) / 2;
      const sigY = baselineY - rowHeight + (rowHeight - sigH) / 2 + 2;

      page.drawImage(img, { x: sigX, y: sigY, width: sigW, height: sigH });

      this.logger.log(
        `[fillRowByColumns] firma centrada ${sigW.toFixed(2)}x${sigH.toFixed(2)} en (${sigX.toFixed(2)}, ${sigY.toFixed(2)})`,
      );
    }

    const buffer = Buffer.from(await pdfDoc.save());
    this.logger.log('[fillRowByColumns] columnas aplicadas con limpieza de fila');
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
