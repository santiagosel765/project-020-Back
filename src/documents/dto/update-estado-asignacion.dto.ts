import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class UpdateEstadoAsignacionDto {

    @IsNumber()
    @IsNotEmpty()
    idCuadroFirma: number;

    @IsNumber()
    @IsNotEmpty()
    idEstadoFirma: number;

    @IsString()
    @IsNotEmpty()
    nombreEstadoFirma: string;

    @IsNumber()
    @IsNotEmpty()
    userId: number;

    @IsString()
    @IsNotEmpty()
    nombreUser: string;

    @IsString()
    @IsNotEmpty()
    observaciones: string;

    
}