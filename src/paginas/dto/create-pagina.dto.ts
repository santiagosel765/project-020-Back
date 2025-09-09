import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePaginaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
