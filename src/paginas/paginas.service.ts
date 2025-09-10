import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaginaDto } from './dto/create-pagina.dto';
import { UpdatePaginaDto } from './dto/update-pagina.dto';
import { Prisma } from 'generated/prisma'; 

@Injectable()
export class PaginasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(all = false) {
    return this.prisma.pagina.findMany({
      where: all ? undefined : { activo: true },
      orderBy: { id: 'asc' },
    });
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
