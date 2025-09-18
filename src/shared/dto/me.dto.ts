import { PageDto } from './page.dto';

export interface MeResponseDto {
  id: number;
  nombre: string;
  correo: string;
  pages: PageDto[];
  roles: string[];
  signatureUrl: string | null;
  hasSignature: boolean;
  avatarUrl: string | null;
}
