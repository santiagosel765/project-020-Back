import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
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
    return this.prisma.user.findMany();
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
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
      include: {
        rol_usuario: { include: { rol: true } },
      },
    });
    if (!user) return null;
    const roles = user.rol_usuario?.map((r: any) => r.rol.nombre) ?? [];
    return {
      id: user.id,
      email: user.correo_institucional,
      roles,
    };
  }
}
