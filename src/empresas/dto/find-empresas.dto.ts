import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class FindEmpresasQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra empresas por estado de actividad',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).toLowerCase().trim();
    if (['1', 'true', 'on', 'yes'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'off', 'no'].includes(normalized)) {
      return false;
    }
    return value;
  })
  activo?: boolean;
}

export class EmpresaListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Empresa Demo' })
  nombre: string;

  @ApiProperty({ type: Boolean, nullable: true, example: true })
  activo: boolean | null;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/logo.png' })
  logo: string | null;
}

export class FindEmpresasResponseDto {
  @ApiProperty({ type: [EmpresaListItemDto] })
  items: EmpresaListItemDto[];

  @ApiProperty({ example: 1 })
  total: number;
}
