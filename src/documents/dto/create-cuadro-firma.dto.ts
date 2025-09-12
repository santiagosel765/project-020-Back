import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class FirmanteUserDto {
    @IsNumber()
    userId: number;

    @IsString()
    nombre: string;

    @IsString()
    puesto: string;

    @IsString()
    gerencia: string;

    @IsNumber()
    responsabilidadId: number;
}

export class ResponsablesFirmaDto {
    @ValidateNested()
    @Type(() => FirmanteUserDto)
    @IsOptional()
    elabora?: FirmanteUserDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FirmanteUserDto)
    @IsOptional()
    revisa?: FirmanteUserDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FirmanteUserDto)
    @IsOptional()
    aprueba?: FirmanteUserDto[];
}

export class CreateCuadroFirmaDto {
    @IsString()
    titulo: string;

    @IsString()
    descripcion: string;

    @IsString()
    version: string;

    @IsString()
    codigo: string;

    @IsString()
    empresa_id: string;

    @IsString()
    createdBy: string;

}