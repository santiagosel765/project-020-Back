import { Body, Controller, Post, Req, Res, HttpCode } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login-dto';
import { Request, type Response } from 'express';
import { envs } from '../config/envs';

type RequestWithCookies = Request & { cookies: Record<string, string> };

const isProd = envs.nodeEnv === 'production';
const refreshCookieName = isProd ? '__Host-refresh' : 'refresh_token';
const refreshCookiePath = isProd ? '/' : `${envs.apiPrefix}/auth/refresh`;
const refreshCookieOpts = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: isProd,
  path: refreshCookiePath,
};

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
    res.cookie(refreshCookieName, tokens.refresh_token, refreshCookieOpts);
    return { access_token: tokens.access_token };
  }

  @SkipThrottle()
  @Post('refresh')
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[refreshCookieName];
    const tokens = await this.authService.refreshToken(refreshToken);
    res.cookie(refreshCookieName, tokens.refresh_token, refreshCookieOpts);
    return { access_token: tokens.access_token };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(refreshCookieName, refreshCookieOpts);
  }
}
