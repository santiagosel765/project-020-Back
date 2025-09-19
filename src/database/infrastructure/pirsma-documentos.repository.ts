import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { DocumentosRepository } from '../domain/repositories/documentos.repository';

@Injectable()
export class PrismaDocumentosRepository implements DocumentosRepository {
  constructor(private prisma: PrismaService) {}

  async updateDocumentoByCuadroFirmaID(
    cuadroFirmaID: number,
    data: { [key: string]: any },
  ) {
    try {
      const updatedDocumento = await this.prisma.documento.updateMany({
        where: { cuadro_firma_id: cuadroFirmaID },
        data,
      });

      if (!updatedDocumento) {
        throw new HttpException(
          `Problemas al actualizar documento`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return updatedDocumento;
    } catch (error) {
      throw new HttpException(
        `Problemas al actualizar documento: ${error}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  findByCuadroFirmaID(cuadroFirmaID: number) {
    return this.prisma.documento.findFirst({
      where: { cuadro_firma_id: cuadroFirmaID },
      select: {
        nombre_archivo: true,
      },
    });
  }
}
