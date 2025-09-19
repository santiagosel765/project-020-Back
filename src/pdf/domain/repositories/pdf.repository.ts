import { Signature } from 'src/documents/dto/sign-document.dto';
import { SignaturePosition } from '../value-objects/signature-position.vo';

export type SignatureTableColumn = { x: number; w: number };

export type SignatureTableColumns = {
  nombre: SignatureTableColumn;
  puesto: SignatureTableColumn;
  gerencia: SignatureTableColumn;
  firma: SignatureTableColumn;
  fecha: SignatureTableColumn;
};

export type FillRowByColumnsOptions = {
  signatureBuffer?: Buffer;
  writeDate?: boolean;
};

export type FillRowByColumnsResult = {
  buffer: Buffer;
  mode: 'columns' | 'fallback';
};

export const PDF_REPOSITORY = Symbol('PDF_REPOSITORY');

export interface TextAnchorFill {
  token: string;
  text: string;
  fontSize?: number;
  maxWidth?: number;
  rectPadding?: number;
}

export type RelativeField = {
  key: 'NOMBRE' | 'PUESTO' | 'GERENCIA' | 'FECHA' | 'FIRMA_BOX';
  dx: number;
  dy: number;
  maxWidth?: number;
  rectWidth?: number;
  rectHeight?: number;
  fontSize?: number;
  align?: 'left' | 'center';
  multiline?: boolean;
};

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
    options?: { writeDate?: boolean; drawSignature?: boolean },
  ): Promise<Buffer | null>;
  insertMultipleSignature(
    pdfBuffer: Buffer,
    signatures: Signature[],
    position: SignaturePosition,
  ): Promise<Buffer | null>;

  extractText(pdfBuffer: Buffer): Promise<string>;

  fillTextAnchors(
    pdfBuffer: Buffer,
    items: TextAnchorFill[],
  ): Promise<Buffer>;

  fillRelativeToAnchor(
    pdfBuffer: Buffer,
    anchorToken: string,
    values: Record<'NOMBRE' | 'PUESTO' | 'GERENCIA' | 'FECHA', string>,
    fields: RelativeField[],
    signature?: {
      buffer: Buffer;
      dx: number;
      dy: number;
      width: number;
      height: number;
    },
  ): Promise<Buffer>;

  locateSignatureTableColumns(
    pdfBuffer: Buffer,
    page: number,
  ): Promise<SignatureTableColumns | null>;

  fillRowByColumns(
    pdfBuffer: Buffer,
    anchorToken: string,
    values: Record<'NOMBRE' | 'PUESTO' | 'GERENCIA' | 'FECHA', string>,
    options?: FillRowByColumnsOptions,
  ): Promise<FillRowByColumnsResult>;

  mergePDFs(pdfBuffers: Buffer[]): Promise<Buffer>;
}

export const CELL = { height: 22, textSize: 8 } as const;

export const OFFSETS_DEFAULT: RelativeField[] = [
  {
    key: 'NOMBRE',
    dx: -470,
    dy: 0,
    maxWidth: 110,
    rectWidth: 110,
    rectHeight: CELL.height,
    fontSize: 7,
    align: 'left',
    multiline: true,
  },
  {
    key: 'PUESTO',
    dx: -360,
    dy: 0,
    maxWidth: 110,
    rectWidth: 110,
    rectHeight: CELL.height,
    fontSize: CELL.textSize,
    align: 'left',
  },
  {
    key: 'GERENCIA',
    dx: -250,
    dy: 0,
    maxWidth: 110,
    rectWidth: 110,
    rectHeight: CELL.height,
    fontSize: CELL.textSize,
    align: 'left',
  },
  {
    key: 'FIRMA_BOX',
    dx: -120,
    dy: 0,
    rectWidth: 150,
    rectHeight: CELL.height, // 22 px: no invade otra fila
  },
  {
    key: 'FECHA',
    dx: 0,
    dy: 0,
    maxWidth: 90,
    rectWidth: 80,
    rectHeight: 22,
    fontSize: 7,
    align: 'center',
  },
];

export const SIGNATURE_DEFAULT = {
  dx: -120,
  dy: 0,
  width: 90,
  height: 18,
} as const;
