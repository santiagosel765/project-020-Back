import { Body, Controller, Post, Req, Res, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login-dto';
import { Request, type Response } from 'express';
import { envs } from '../config/envs';

type RequestWithCookies = Request & { cookies: Record<string, string> };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() createUserDto: CreateUserDto) {
    return this.authService.signup(createUserDto);
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(loginDto);
    res.cookie('__Host-refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `${envs.apiPrefix}/auth/refresh`,
    });
    return { access_token: tokens.access_token };
  }

  @Post('refresh')
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['__Host-refresh'];
    const tokens = await this.authService.refreshToken(refreshToken);
    res.cookie('__Host-refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `${envs.apiPrefix}/auth/refresh`,
    });
    return { access_token: tokens.access_token };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('__Host-refresh', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `${envs.apiPrefix}/auth/refresh`,
    });
  }
}
