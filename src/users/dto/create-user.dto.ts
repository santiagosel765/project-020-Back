import { IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  primer_nombre: string;

  @IsString()
  primer_apellido: string;

  @IsEmail()
  correo_institucional: string;

  @IsString()
  codigo_empleado: string;

  @IsString()
  password: string;
}
