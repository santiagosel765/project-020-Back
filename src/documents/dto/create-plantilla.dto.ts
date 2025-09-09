import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreatePlantillaDto {
  @IsString()
  @IsNotEmpty()
  color: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsNumber()
  @IsNotEmpty()
  idEmpresa: number;
}
