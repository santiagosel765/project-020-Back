import { PartialType } from '@nestjs/mapped-types';
import { CreateCuadroFirmaDto } from './create-cuadro-firma.dto';

export class UpdateCuadroFirmaDto extends PartialType(CreateCuadroFirmaDto) {}
