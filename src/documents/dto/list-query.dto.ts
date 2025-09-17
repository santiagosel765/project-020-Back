import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListQueryDto {
  @IsInt()
  @Min(1)
  page = 1;

  @IsInt()
  @Min(1)
  limit = 10;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sort: 'asc' | 'desc' = 'desc';

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  estado?: string;
}
