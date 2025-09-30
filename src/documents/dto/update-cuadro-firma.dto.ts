import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { CreateCuadroFirmaDto } from './create-cuadro-firma.dto';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCuadroFirmaDto extends PartialType(CreateCuadroFirmaDto) {
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    idUser?: number;

    @IsOptional()
    @IsString()
    observaciones: string;
}
