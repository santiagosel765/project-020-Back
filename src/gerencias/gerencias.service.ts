import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GerenciasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(includeAll = false) {
    return this.prisma.gerencia.findMany({
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
