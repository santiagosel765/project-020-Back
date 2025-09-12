import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class FirmaCuadroDto {

    @IsNotEmpty()
    userId: string;

    @IsNotEmpty()
    @IsString()
    nombreUsuario: string;
    
    @IsNotEmpty()
    cuadroFirmaId: string;
    
    @IsNotEmpty()
    responsabilidadId: string;

    @IsNotEmpty()
    @IsString()
    nombreResponsabilidad: string;

}