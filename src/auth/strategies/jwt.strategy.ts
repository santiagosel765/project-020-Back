import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type JwtPayload = { sub: number; email: string; roleIds?: number[] };

const cookieNames = ['access_token', '__Host-access'] as const;

function cookieExtractor(req: Request): string | null {
  const cookies = (req as any)?.cookies ?? {};

  for (const name of cookieNames) {
    const value = cookies?.[name];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor, 
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return {
      sub: payload.sub,
      email: payload.email,
      roleIds: payload.roleIds ?? [],
    };
  }
}
