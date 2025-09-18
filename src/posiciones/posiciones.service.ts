import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PosicionesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(includeAll = false) {
    return this.prisma.posicion.findMany({
      where: includeAll ? undefined : { activo: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nombre: true,
        activo: true,
      },
    });
  }
}
