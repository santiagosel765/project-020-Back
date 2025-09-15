import { IsOptional, IsString } from 'class-validator';

export class UpdateSignatureDto {
  /**
   * dataUrl con formato: data:image/png;base64,AAAA...
   * Opcional si se envía archivo 'file' (multipart).
   */
  @IsOptional()
  @IsString()
  dataUrl?: string;
}
