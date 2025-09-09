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
    
    return this.generateTokens(user);
  }

  async login({ email, password }: LoginDto) {
    const found = await this.prisma.user.findUnique({
      where: { correo_institucional: email },
      include: { rol_usuario: { include: { rol: true } } },
    });
    if (!found) throw new UnauthorizedException('Invalid credentials');

    if (!found.password) throw new UnauthorizedException('Invalid credentials');

    const valid = BcryptAdapter.compareHash(password, found.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(found);
  }

  async refreshToken(refresh_token: string) {
    if (!refresh_token)
      throw new UnauthorizedException('No refresh token provided');

    const payload = verifyJwt(refresh_token, envs.jwtRefreshSecret) as {
      sub?: number;
    };

    if (!payload?.sub)
      throw new UnauthorizedException('Invalid token payload');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { rol_usuario: { include: { rol: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return this.generateTokens(user);
  }

  private generateTokens(user: any) {
    const roles = user.rol_usuario?.map((r: any) => r.rol.nombre) ?? [];
    const payload = { sub: user.id, email: user.correo_institucional, roles };
    const access_token = signJwt(payload, {
      secret: envs.jwtAccessSecret,
      expiresIn: envs.jwtAccessExpiration,
    });
    const refresh_token = signJwt(payload, {
      secret: envs.jwtRefreshSecret,
      expiresIn: envs.jwtRefreshExpiration,
    });
    return { access_token, refresh_token };
  }

}
