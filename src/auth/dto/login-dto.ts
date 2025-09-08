import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({ require_tld: false }) // allow admin@local
  email: string;

  @IsString()
  password: string;
}
