import { SignaturePosition } from '../value-objects/signature-position.vo';

export class PdfDocument {
  readonly buffer: Buffer;

  constructor(buffer: Buffer) {
    if (!buffer || buffer.length === 0) {
      throw new Error('PDF buffer must not be empty');
    }
    this.buffer = buffer;
  }

  // Ejemplo de método de dominio: agregar una firma (solo definición, la lógica concreta va en infrastructure)
  addSignature(signatureBuffer: Buffer, position: SignaturePosition): PdfDocument {
    // Aquí solo defines la intención, la implementación real va en el repositorio concreto
    throw new Error('Not implemented: use repository implementation');
  }
}
