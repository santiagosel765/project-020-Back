import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString({ message: 'currentPassword must be a string' })
  currentPassword?: string;

  @IsString({ message: 'newPassword must be a string' })
  @MinLength(6, { message: 'newPassword must be at least 6 characters long' })
  newPassword!: string;
}
