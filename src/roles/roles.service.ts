import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

interface PageDto {
  id: number;
  nombre: string;
  url: string;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(all = false) {
    return this.prisma.rol.findMany({
      where: all ? undefined : { activo: true },
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: CreateRolDto) {
    try {
      return await this.prisma.rol.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El nombre del rol ya está en uso');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateRolDto) {
    try {
      return await this.prisma.rol.update({
        where: { id },
        data: { ...dto, updated_at: new Date() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El nombre del rol ya está en uso');
      }
      throw error;
    }
  }

  remove(id: number) {
    return this.prisma.rol.update({
      where: { id },
      data: { activo: false, updated_at: new Date() },
    });
  }

  restore(id: number) {
    return this.prisma.rol.update({
      where: { id },
      data: { activo: true, updated_at: new Date() },
    });
  }

  async getPagesForUser(userId: number): Promise<PageDto[]> {
    const roles = await this.prisma.rol_usuario.findMany({
      where: {
        user_id: userId,
        rol: { activo: true },
      },
      select: { rol_id: true },
    });

    const roleIds = roles.map((r) => r.rol_id);
    if (roleIds.length === 0) return [];

    const pages = await this.prisma.pagina.findMany({
      where: {
        activo: true,
        pagina_rol: {
          some: {
            rol_id: { in: roleIds },
            rol: { activo: true },
          },
        },
      },
      select: { id: true, nombre: true, url: true },
      orderBy: { id: 'asc' },
    });

    return pages;
  }
}
