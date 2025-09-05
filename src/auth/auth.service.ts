import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login-dto';
import { BcryptAdapter } from './adapters/bcrypt.adapter';
import { signJwt, verifyJwt } from './utils/jwt.util';
import { envs } from '../config/envs';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(createUserDto: CreateUserDto) {
    const { correo_institucional, codigo_empleado, password, ...rest } =
      createUserDto;
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ correo_institucional }, { codigo_empleado }] },
    });
    if (exists) throw new BadRequestException('User already exists');
    const hashed = BcryptAdapter.hashPassword(password);
    const user = await this.prisma.user.create({
      data: {
        correo_institucional,
        codigo_empleado,
        password: hashed,
        ...rest,
      },
    });
    const tokens = this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  async login({ user, password }: LoginDto) {
    const where = user.includes('@')
      ? { correo_institucional: user }
      : { codigo_empleado: user };
    const found = await this.prisma.user.findUnique({
      where,
      include: { rol_usuario: { include: { rol: true } } },
    });
    if (!found) throw new UnauthorizedException('Invalid credentials');
    const valid = BcryptAdapter.compareHash(password, found.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const tokens = this.generateTokens(found);
    await this.saveRefreshToken(found.id, tokens.refresh_token);
    return tokens;
  }

  async refreshToken({ refresh_token }: RefreshTokenDto) {
    const payload = verifyJwt(refresh_token, envs.jwtRefreshSecret);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { rol_usuario: { include: { rol: true } } },
    });
    if (!user || !user.refresh_token)
      throw new UnauthorizedException('Invalid token');
    const valid = user.refresh_token === refresh_token;
    if (!valid) throw new UnauthorizedException('Invalid token');
    const tokens = this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  private generateTokens(user: any) {
    const roles = user.rol_usuario?.map((r: any) => r.rol.nombre) ?? [];
    const payload = { sub: user.id, email: user.correo_institucional, roles };
    const access_token = signJwt(payload, {
      secret: envs.jwtSecret,
      expiresIn: envs.jwtExpiration,
    });
    const refresh_token = signJwt(payload, {
      secret: envs.jwtRefreshSecret,
      expiresIn: envs.jwtRefreshExpiration,
    });
    return { access_token, refresh_token };
  }

  private async saveRefreshToken(userId: number, token: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refresh_token: token },
    });
  }
}
