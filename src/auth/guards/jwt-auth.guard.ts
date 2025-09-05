import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtStrategy } from '../strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtStrategy: JwtStrategy) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    try {
      const payload = this.jwtStrategy.validate(token);
      req.user = payload;
      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
