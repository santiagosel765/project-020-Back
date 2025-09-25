import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const ESTADOS_FIRMA_WHITELIST = [
  'Pendiente',
  'En Progreso',
  'Rechazado',
  'Completado',
] as const;

export type EstadoFirmaNombre = (typeof ESTADOS_FIRMA_WHITELIST)[number];

const ESTADO_LOOKUP: Record<string, EstadoFirmaNombre> =
  ESTADOS_FIRMA_WHITELIST.reduce((acc, estado) => {
    acc[estado.toLowerCase()] = estado;
    return acc;
  }, {} as Record<string, EstadoFirmaNombre>);

export const normalizeEstadoNombre = (
  value: unknown,
): EstadoFirmaNombre | string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const canonical = ESTADO_LOOKUP[trimmed.toLowerCase()];
  return canonical ?? trimmed;
};

const normalizeSort = (value: unknown): 'asc' | 'desc' => {
  if (value === 'asc' || value === 'desc') {
    return value;
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  }
  return 'desc';
};
export class ListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  @Transform(({ value }) => normalizeSort(value), { toClassOnly: true })
  sort: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  search?: string;

  @IsOptional()
  @IsIn(ESTADOS_FIRMA_WHITELIST)
  @Transform(({ value }) => normalizeEstadoNombre(value), {
    toClassOnly: true,
  })
  estado?: EstadoFirmaNombre;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estadoId?: number;
}
