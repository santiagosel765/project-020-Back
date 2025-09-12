import { PartialType } from '@nestjs/mapped-types';
import { CreateCuadroFirmaDto } from './create-cuadro-firma.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCuadroFirmaDto extends PartialType(CreateCuadroFirmaDto) {
    @IsOptional()
    @IsString()
    observaciones: string;
}
