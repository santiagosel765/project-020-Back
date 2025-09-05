import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Post()
  login() {
    return this.authService.login();
  }

  @Post()
  signup() {
    return this.authService.signup();
  }

  @Post()
  refreshToken() {
    return this.authService.refreshToken();
  }

}
