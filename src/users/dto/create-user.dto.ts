import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'primer_nombre must be a string' })
  primer_nombre: string;

  @IsOptional()
  @IsString({ message: 'segundo_name must be a string' })
  segundo_name?: string;

  @IsOptional()
  @IsString({ message: 'tercer_nombre must be a string' })
  tercer_nombre?: string;

  @IsString({ message: 'primer_apellido must be a string' })
  primer_apellido: string;

  @IsOptional()
  @IsString({ message: 'segundo_apellido must be a string' })
  segundo_apellido?: string;

  @IsOptional()
  @IsString({ message: 'apellido_casada must be a string' })
  apellido_casada?: string;

  @IsEmail({}, { message: 'correo_institucional must be a valid email' })
  correo_institucional: string;

  @IsOptional()
  @IsString({ message: 'telefono must be a string' })
  telefono?: string;

  @IsString({ message: 'codigo_empleado must be a string' })
  codigo_empleado: string;

  @IsString({ message: 'password must be a string' })
  password: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'posicion_id must be an integer' })
  posicion_id?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'gerencia_id must be an integer' })
  gerencia_id?: number | null;
}
