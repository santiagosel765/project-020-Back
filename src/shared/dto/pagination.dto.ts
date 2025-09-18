import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number; // default 1

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number; // default 10 (cap máx 100)

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc'; // default 'desc'
}
