import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const NOTIFICATIONS_PAYLOAD_VERSION = '1.0';

export class NotificationItemDto {
  @ApiProperty({ example: 123 })
  @IsInt()
  id!: number;

  @ApiProperty({ example: 'Nuevo documento disponible' })
  @IsString()
  title!: string;

  @ApiProperty({
    example: 'Se asignó el documento "Contrato" para su revisión.',
  })
  @IsString()
  message!: string;

  @ApiProperty({ example: '2025-01-01T15:04:05.000Z' })
  @IsDateString()
  createdAt!: string;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiProperty({ example: '/documento/1' })
  @IsString()
  href!: string;

  @ApiProperty({ example: 'info', nullable: true })
  @IsOptional()
  @IsString()
  icon: string | null = null;
}

export class NotificationMetaDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  page!: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  limit!: number;

  @ApiProperty({ example: 57 })
  @IsInt()
  total!: number;

  @ApiProperty({ example: 6 })
  @IsInt()
  pages!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;

  @ApiProperty({ example: false })
  hasPrev!: boolean;
}

export class NotificationPayloadDto {
  @ApiProperty({ type: [NotificationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationItemDto)
  items!: NotificationItemDto[];

  @ApiProperty({ type: NotificationMetaDto })
  @ValidateNested()
  @Type(() => NotificationMetaDto)
  meta!: NotificationMetaDto;
}

export class NotificationEnvelopeDto {
  @ApiProperty({ example: NOTIFICATIONS_PAYLOAD_VERSION })
  @Matches(/^1\.0$/)
  version: string = NOTIFICATIONS_PAYLOAD_VERSION;

  @ApiProperty({ type: NotificationPayloadDto })
  @ValidateNested()
  @Type(() => NotificationPayloadDto)
  data!: NotificationPayloadDto;
}

export class NotificationListResponseDto extends NotificationEnvelopeDto {
  @ApiProperty({ example: 200 })
  @IsInt()
  status!: number;
}

export class NotificationPaginationDto {
  @ApiProperty({ required: false, example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ required: false, example: '2025-01-01T15:04:05.000Z' })
  @IsOptional()
  @IsDateString()
  since?: string;
}

export class NotificationBulkReadDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId!: number;

  @ApiProperty({ required: false, type: [Number], example: [10, 11, 15] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  ids?: number[];
}

export class UserNotificationsClientDto {
  @IsString()
  version: string = NOTIFICATIONS_PAYLOAD_VERSION;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  since?: Date;
}

export class UserNotificationsServerDto extends NotificationEnvelopeDto {}
