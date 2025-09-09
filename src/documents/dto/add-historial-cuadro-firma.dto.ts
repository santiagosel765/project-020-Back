import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class AddHistorialCuadroFirmaDto {

    @IsNumber()
    @IsNotEmpty()
    cuadroFirmaId: number;

    @IsNumber()
    @IsNotEmpty()
    estadoFirmaId: number;

    @IsNumber()
    @IsNotEmpty()
    userId: number;

    @IsString()
    @IsNotEmpty()
    observaciones: string;
}