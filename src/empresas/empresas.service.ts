import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FindEmpresasQueryDto } from './dto/find-empresas.dto';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindEmpresasQueryDto) {
    const where =
      query.activo === undefined
        ? undefined
        : {
            activo: query.activo,
          };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.empresa.findMany({
        where,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          nombre: true,
          activo: true,
          logo: true,
        },
      }),
      this.prisma.empresa.count({ where }),
    ]);

    return { items, total };
  }
}
