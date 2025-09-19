import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'generated/prisma';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { PageDto, PaginationDto } from '../shared/dto';
import {
  buildPaginationResult,
  normalizePagination,
  stableOrder,
} from 'src/shared/utils/pagination';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(all = false, pagination?: PaginationDto) {
    const where = all ? undefined : { activo: true };
    const select = {
      id: true,
      nombre: true,
      descripcion: true,
      activo: true,
      add_date: true,
    } as const;

    if (all) {
      return this.prisma.rol.findMany({
        where,
        orderBy: { id: 'asc' },
        select,
      });
    }

    const { page, limit, sort, skip, take } = normalizePagination(pagination);

    const [total, roles] = await this.prisma.$transaction([
      this.prisma.rol.count({ where }),
      this.prisma.rol.findMany({
        where,
        orderBy: stableOrder(sort),
        take,
        skip,
        select,
      }),
    ]);

    return buildPaginationResult(roles, total, page, limit, sort);
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

  async getPages(id: number) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) {
      throw new NotFoundException('El rol no existe');
    }
    if (!rol.activo) {
      throw new BadRequestException('El rol está inactivo');
    }
    const pages = await this.prisma.pagina_rol.findMany({
      where: { rol_id: id, pagina: { activo: true } },
      select: { pagina_id: true },
      orderBy: { pagina_id: 'asc' },
    });
    return { paginaIds: pages.map((p) => p.pagina_id) };
  }

  async setPages(id: number, paginaIds: number[], userId: number) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) {
      throw new NotFoundException('El rol no existe');
    }
    if (!rol.activo) {
      throw new BadRequestException('El rol está inactivo');
    }

    const uniqueIds = Array.from(new Set(paginaIds));
    if (uniqueIds.length > 0) {
      const pages = await this.prisma.pagina.findMany({
        where: { id: { in: uniqueIds }, activo: true },
        select: { id: true },
      });
      if (pages.length !== uniqueIds.length) {
        throw new BadRequestException(
          'Una o más páginas no existen o están inactivas',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.pagina_rol.findMany({
        where: { rol_id: id },
        select: { pagina_id: true },
      });
      await tx.pagina_rol.deleteMany({ where: { rol_id: id } });
      if (uniqueIds.length > 0) {
        await tx.pagina_rol.createMany({
          data: uniqueIds.map((pid) => ({ rol_id: id, pagina_id: pid })),
          skipDuplicates: true,
        });
      }
      await tx.auditoria.create({
        data: {
          user_id: userId,
          entidad: 'rol',
          entidad_id: id,
          accion: 'SET_PAGINAS',
          descripcion: JSON.stringify({
            before: before.map((b) => b.pagina_id),
            after: uniqueIds,
          }),
        },
      });
      return { paginaIds: uniqueIds };
    });
  }

  async getPagesForUser(userId: number): Promise<PageDto[]> {
    const roles = await this.prisma.rol_usuario.findMany({
      where: { user_id: userId, rol: { activo: true } },
      select: { rol_id: true },
    });

    const roleIds = roles.map((r) => r.rol_id);
    if (roleIds.length === 0) return [];

    const pages = await this.prisma.pagina.findMany({
      where: {
        activo: true,
        pagina_rol: {
          some: { rol_id: { in: roleIds }, rol: { activo: true } },
        },
      },
      select: {
        id: true,
        nombre: true,
        url: true,
        icon: true,
        order: true, // <- si usaste @map("display_order")
      },
      orderBy: [
        { order: 'asc' }, // primero por orden custom
        { id: 'asc' }, // luego por id
      ],
    });

    return pages.map((p) => ({
      id: p.id,
      code: p.nombre,
      name: p.nombre,
      path: p.url,
      icon: p.icon ?? null,
      order: p.order ?? null,
    }));
  }

  // NUEVO MÉTODO
  async getRoleNamesForUser(userId: number): Promise<string[]> {
    const rows = await this.prisma.rol_usuario.findMany({
      where: { user_id: userId },
      select: { rol: { select: { nombre: true } } },
    });
    return rows.map((r) => r.rol.nombre);
  }
}
