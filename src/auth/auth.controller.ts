// src/auth/auth.controller.ts
import { Body, Controller, Post, Req, Res, HttpCode } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login-dto';
import { Request, type Response } from 'express';
import { envs } from '../config/envs';

type RequestWithCookies = Request & { cookies: Record<string, string> };

const isProd = envs.nodeEnv === 'production';

const accessCookieName = isProd ? '__Host-access' : 'access_token';
const refreshCookieName = isProd ? '__Host-refresh' : 'refresh_token';

const baseCookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,        
  secure: isProd,                 
  path: '/',   
};

const accessCookieOpts = baseCookieOpts;
const refreshCookieOpts = baseCookieOpts;

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

    res.cookie(accessCookieName, tokens.access_token, {
      ...accessCookieOpts,
      maxAge: Number(envs.jwtAccessExpiration) * 1000,
    });
    res.cookie(refreshCookieName, tokens.refresh_token, {
      ...refreshCookieOpts,
      maxAge: Number(envs.jwtRefreshExpiration) * 1000,
    });

    return { ok: true };
  }

  @SkipThrottle()
  @Post('refresh')
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[refreshCookieName];

    const tokens = await this.authService.refreshToken(refreshToken);

    res.cookie(accessCookieName, tokens.access_token, {
      ...accessCookieOpts,
      maxAge: Number(envs.jwtAccessExpiration) * 1000,
    });
    res.cookie(refreshCookieName, tokens.refresh_token, {
      ...refreshCookieOpts,
      maxAge: Number(envs.jwtRefreshExpiration) * 1000,
    });

    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    const isProd = envs.nodeEnv === 'production';
    const accessCookieName = isProd ? '__Host-access' : 'access_token';
    const refreshCookieName = isProd ? '__Host-refresh' : 'refresh_token';

    const baseCookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProd,
      path: '/',
    };

    const expireOpts = { ...baseCookieOpts, maxAge: 0, expires: new Date(0) };
    res.cookie(accessCookieName, '', expireOpts);
    res.cookie(refreshCookieName, '', expireOpts);

    return;
  }

}
