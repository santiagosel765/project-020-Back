import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BcryptAdapter } from '../auth/adapters/bcrypt.adapter';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {
    const { password, ...rest } = createUserDto;
    return this.prisma.user.create({
      data: { ...rest, password: BcryptAdapter.hashPassword(password) },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        primer_nombre: true,
        correo_institucional: true,
        activo: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        primer_nombre: true,
        correo_institucional: true,
        activo: true,
      },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data: updateUserDto });
  }

  remove(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }

  async me(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        correo_institucional: true,
        rol_usuario: { select: { rol: { select: { nombre: true } } } },
      },
    });
    if (!user) return null;
    const roles = user.rol_usuario?.map((r) => r.rol.nombre) ?? [];
    return {
      id: user.id,
      email: user.correo_institucional,
      roles,
    };
  }
}
