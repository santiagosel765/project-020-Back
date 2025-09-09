import { IsString, IsOptional, IsUUID, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsString()
  primer_nombre: string;

  @IsOptional()
  @IsString()
  segundo_nombre?: string;

  @IsOptional()
  @IsString()
  tercer_nombre?: string;

  @IsString()
  primer_apellido: string;

  @IsOptional()
  @IsString()
  segundo_apellido?: string;

  @IsOptional()
  @IsString()
  apellido_casada?: string;

  @IsString()
  codigo_empleado: string;

  @IsUUID()
  posicion_id: string;

  @IsUUID()
  gerencia_id: string;

  @IsEmail()
  correo_institucional: string;

  @IsString()
  telefono: string;

  @IsOptional()
  @IsString()
  created_by?: string;

  @IsOptional()
  @IsString()
  add_date?: string;

  @IsOptional()
  @IsString()
  updated_at?: string;

  @IsOptional()
  foto_perfil?: string; // si lo manejás como URL o base64

  @IsOptional()
  imagen_firma?: string; // si lo manejás como URL o base64
}
    