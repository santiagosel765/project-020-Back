import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaginaDto } from './dto/create-pagina.dto';
import { UpdatePaginaDto } from './dto/update-pagina.dto';
import { Prisma } from 'generated/prisma';
import { PaginationDto } from 'src/shared/dto';
import {
  buildPaginationResult,
  logPaginationDebug,
  normalizePagination,
  stableOrder,
} from 'src/shared/utils/pagination';

@Injectable()
export class PaginasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false, pagination?: PaginationDto) {
    const where = includeInactive ? undefined : { activo: true };

    const { page, limit, sort, skip, take } = normalizePagination(pagination);
    const orderBy = stableOrder(sort);

    logPaginationDebug('PaginasService.findAll', 'before', {
      page,
      limit,
      sort,
      skip,
      take,
      orderBy,
    });

    const [total, paginas] = await this.prisma.$transaction([
      this.prisma.pagina.count({ where }),
      this.prisma.pagina.findMany({
        where,
        orderBy,
        take,
        skip,
      }),
    ]);

    logPaginationDebug('PaginasService.findAll', 'after', {
      total,
      count: total,
      firstId: paginas[0]?.id ?? null,
      lastId:
        paginas.length > 0 ? paginas[paginas.length - 1]?.id ?? null : null,
      returned: paginas.length,
    });

    return buildPaginationResult(paginas, total, page, limit, sort);
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
