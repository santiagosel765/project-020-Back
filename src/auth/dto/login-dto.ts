import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({ require_tld: false })
  @IsString()
  email: string;

  @IsString()
  password: string;
}
