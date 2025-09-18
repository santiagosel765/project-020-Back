import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaginaDto } from './dto/create-pagina.dto';
import { UpdatePaginaDto } from './dto/update-pagina.dto';
import { Prisma } from 'generated/prisma';
import { PaginationDto } from 'src/shared/dto';
import { buildPageMeta } from 'src/shared/utils/pagination';

@Injectable()
export class PaginasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(all = false, pagination?: PaginationDto) {
    const hasPagination =
      pagination?.page !== undefined || pagination?.limit !== undefined;

    const where = all ? undefined : { activo: true };

    if (!hasPagination) {
      return this.prisma.pagina.findMany({
        where,
        orderBy: { id: 'asc' },
      });
    }

    const rawPage = pagination?.page ?? 1;
    const rawLimit = pagination?.limit ?? 10;
    const page = Math.max(1, Number(rawPage) || 1);
    const limit = Math.min(100, Math.max(1, Number(rawLimit) || 10));
    const sort: 'asc' | 'desc' = pagination?.sort === 'asc' ? 'asc' : 'desc';
    const skip = (page - 1) * limit;

    const [total, paginas] = await this.prisma.$transaction([
      this.prisma.pagina.count({ where }),
      this.prisma.pagina.findMany({
        where,
        orderBy: { id: sort },
        take: limit,
        skip,
      }),
    ]);

    return {
      items: paginas,
      meta: buildPageMeta(total, page, limit),
    };
  }

  async create(dto: CreatePaginaDto) {
    try {
      return await this.prisma.pagina.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El nombre de la página ya está en uso');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdatePaginaDto) {
    try {
      return await this.prisma.pagina.update({
        where: { id },
        data: { ...dto, updated_at: new Date() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El nombre de la página ya está en uso');
      }
      throw error;
    }
  }

  remove(id: number) {
    return this.prisma.pagina.update({
      where: { id },
      data: { activo: false, updated_at: new Date() },
    });
  }

  restore(id: number) {
    return this.prisma.pagina.update({
      where: { id },
      data: { activo: true, updated_at: new Date() },
    });
  }
}
