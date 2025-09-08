import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail(
    { require_tld: false },
    { message: 'email must be a valid email' },
  ) // allow admin@local
  email: string;

  @IsString({ message: 'password must be a string' })
  password: string;
}
