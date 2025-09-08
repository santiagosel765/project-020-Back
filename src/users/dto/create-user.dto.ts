import { IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'primer_nombre must be a string' })
  primer_nombre: string;

  @IsString({ message: 'primer_apellido must be a string' })
  primer_apellido: string;

  @IsEmail({}, { message: 'correo_institucional must be a valid email' })
  correo_institucional: string;

  @IsString({ message: 'codigo_empleado must be a string' })
  codigo_empleado: string;

  @IsString({ message: 'password must be a string' })
  password: string;
}
