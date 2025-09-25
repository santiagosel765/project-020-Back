import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class PaginationDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort: 'asc' | 'desc' = 'desc';
}

// Acepta includeInactive/showInactive/all con prioridad includeInactive
export class InactiveFlagDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    const v = String(value).toLowerCase().trim();
    if (['1', 'true', 'on', 'yes'].includes(v)) return true;
    if (['0', 'false', 'off', 'no'].includes(v)) return false;
    return undefined; // si no viene, queda undefined
  })
  includeInactive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    const v = String(value).toLowerCase().trim();
    if (['1', 'true', 'on', 'yes'].includes(v)) return true;
    if (['0', 'false', 'off', 'no'].includes(v)) return false;
    return undefined;
  })
  showInactive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => String(value).trim() === '1')
  all?: boolean;
}
