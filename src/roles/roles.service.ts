import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface PageDto {
  id: number;
  nombre: string;
  url: string;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

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

