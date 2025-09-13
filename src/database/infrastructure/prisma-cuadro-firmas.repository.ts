import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

import {
  cuadro_firma,
  cuadro_firma_estado_historial,
  plantilla,
} from 'generated/prisma';
import { CuadroFirmaRepository } from '../domain/repositories/cuadro-firmas.repository';
import { generarFilasFirmas } from 'src/documents/utils/generar-filas-firma.utils';
import {
  CreateCuadroFirmaDto,
  ResponsablesFirmaDto,
} from 'src/documents/dto/create-cuadro-firma.dto';
import {
  PDF_GENERATION_REPOSITORY,
  type PdfGenerationRepository,
} from 'src/pdf/domain/repositories/pdf-generation.repository';
import { AWSService } from 'src/aws/aws.service';
import {
  PDF_REPOSITORY,
  type PdfRepository,
} from 'src/pdf/domain/repositories/pdf.repository';
import { formatCurrentDate } from 'src/helpers/formatDate';
import { UpdateCuadroFirmaDto } from 'src/documents/dto/update-cuadro-firma.dto';
import { AddHistorialCuadroFirmaDto } from 'src/documents/dto/add-historial-cuadro-firma.dto';
import { UpdateEstadoAsignacionDto } from 'src/documents/dto/update-estado-asignacion.dto';
import { Asignacion } from '../domain/interfaces/cuadro-firmas.interface';
import { FirmaCuadroDto } from 'src/documents/dto/firma-cuadro.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class PrismaCuadroFirmaRepository implements CuadroFirmaRepository {
  constructor(
    private prisma: PrismaService,
    @Inject(PDF_REPOSITORY)
    private readonly pdfRepository: PdfRepository,
    @Inject(PDF_GENERATION_REPOSITORY)
    private readonly pdfGeneratorRepository: PdfGenerationRepository,
    private awsService: AWSService,
  ) {}

  async generarCuadroFirmas(
    createCuadroFirmaDto: CreateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
  ): Promise<{
    pdfContent: NonSharedBuffer;
    plantilladId: number;
    formattedHtml: string;
    fileName: string;
  }> {
    const dbPlantilla = await this.prisma.plantilla.findFirst({
      where: {
        empresa_id: +createCuadroFirmaDto.empresa_id,
      },
      include: {
        empresa: true,
      },
    });

    if (!dbPlantilla) {
      throw new Error(
        `La plantilla de la empresa con ID "${createCuadroFirmaDto.empresa_id}" no existe`,
      );
    }

    const filasApruebaStr = generarFilasFirmas(
      responsables?.aprueba,
      'APRUEBA',
      'Aprobado por:',
    );

    const filasRevisaStr = generarFilasFirmas(
      responsables?.revisa,
      'REVISA',
      'Revisado por:',
    );

    const placeholders = {
      '[TITULO]': createCuadroFirmaDto.titulo,
      '[CODIGO]': createCuadroFirmaDto.codigo,
      '[VERSION]': createCuadroFirmaDto.version,
      '[DESCRIPCION]': createCuadroFirmaDto.descripcion,
      '[FECHA]': formatCurrentDate(),
      '[LOGO_URL]': dbPlantilla.empresa.logo || '',
      FIRMANTE_ELABORA: responsables?.elabora?.nombre!,
      PUESTO_ELABORA: responsables?.elabora?.puesto!,
      GERENCIA_ELABORA: responsables?.elabora?.gerencia!,
      FECHA_ELABORA: `FECHA_ELABORA_${responsables?.elabora?.nombre!.replaceAll(' ', '_')!}`,
      '[FILAS_REVISA]': filasRevisaStr,
      '[FILAS_APRUEBA]': filasApruebaStr,
    };

    const formattedHtml = this.pdfGeneratorRepository.replacePlaceholders(
      dbPlantilla.plantilla!,
      placeholders,
    );

    const { outputPath, fileName } =
      await this.pdfGeneratorRepository.generatePDFFromHTML(formattedHtml);

    const pdfContent = require('fs').readFileSync(outputPath);

    return {
      pdfContent,
      plantilladId: dbPlantilla.id,
      formattedHtml,
      fileName,
    };
  }

  async guardarCuadroFirmas(
    createCuadroFirmaDto: CreateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
    documentoPDF: Buffer,
    pdfContent: Buffer | null,
    plantilladId: number,
    formattedHtml: string,
    fileName: string,
    cuadroFirmasKey: string,
    bucketFileName: string,
    createdBy: number,
  ): Promise<cuadro_firma> {
    try {
      // Guardar cuadro de firmas en DB
      const cuadroFirmaDB = await this.prisma.cuadro_firma.create({
        data: {
          titulo: createCuadroFirmaDto.titulo,
          descripcion: createCuadroFirmaDto.descripcion,
          codigo: createCuadroFirmaDto.codigo,
          version: createCuadroFirmaDto.version,
          pdf: pdfContent,
          empresa: { connect: { id: +createCuadroFirmaDto.empresa_id } },
          plantilla: { connect: { id: plantilladId } },
          user: { connect: { id: createdBy } },
          pdf_html: formattedHtml,
          nombre_pdf: fileName,
          url_pdf: cuadroFirmasKey,
        },
      });

      // Guardar documento
      await this.prisma.documento.create({
        data: {
          cuadro_firma: { connect: { id: cuadroFirmaDB.id } },
          pdf: documentoPDF,
          user: { connect: { id: createdBy } },
          nombre_archivo: bucketFileName,
          url_documento: bucketFileName,
        },
      });

      return cuadroFirmaDB;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'El código ya está en uso. Elige otro código.',
        );
      }
      throw e;
    }
  }

  async updateCuadroFirmas(
    id: number,
    updateCuadroFirmaDto: UpdateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
    pdfContent: Buffer | null,
    empresaId: number,
  ) {
    // Actualiza el cuadro de firmas
    const updatedCuadroFirmas = await this.prisma.cuadro_firma.update({
      where: { id },
      data: {
        titulo: updateCuadroFirmaDto.titulo,
        descripcion: updateCuadroFirmaDto.descripcion,
        version: updateCuadroFirmaDto.version,
        empresa: { connect: { id: +empresaId } },
        pdf: pdfContent,
      },
    });

    // Actualiza responsables (puedes reutilizar la lógica diferencial aquí o delegar a otro método)
    await this.actualizarResponsablesCuadroFirma(responsables, id);

    return updatedCuadroFirmas;
  }

  // Puedes mover aquí la lógica de actualizarResponsablesCuadroFirma si lo deseas
  async actualizarResponsablesCuadroFirma(
    responsables: ResponsablesFirmaDto,
    cuadroFirmaId: number,
  ) {
    const actuales = await this.prisma.cuadro_firma_user.findMany({
      where: { cuadro_firma_id: cuadroFirmaId },
      select: {
        user_id: true,
        responsabilidad_id: true,
      },
    });

    const nuevos: { userId: number; responsabilidadId: number }[] = [
      ...(responsables?.elabora ? [responsables.elabora] : []),
      ...(responsables?.revisa ?? []),
      ...(responsables?.aprueba ?? []),
    ].map((f) => ({
      userId: f.userId,
      responsabilidadId: f.responsabilidadId,
    }));

    for (const actual of actuales) {
      if (
        !nuevos.some(
          (n) =>
            n.userId === actual.user_id &&
            n.responsabilidadId === actual.responsabilidad_id,
        )
      ) {
        await this.prisma.cuadro_firma_user.delete({
          where: {
            cuadro_firma_id_user_id_responsabilidad_id: {
              cuadro_firma_id: cuadroFirmaId,
              user_id: actual.user_id,
              responsabilidad_id: actual.responsabilidad_id,
            },
          },
        });
      } else {
        // ? Si sigue como responsable, únicamente indicamos que no ha firmado
        await this.prisma.cuadro_firma_user.update({
          where: {
            // ? Llave compuesta
            cuadro_firma_id_user_id_responsabilidad_id: {
              cuadro_firma_id: cuadroFirmaId,
              user_id: actual.user_id,
              responsabilidad_id: actual.responsabilidad_id,
            },
          },

          data: {
            estaFirmado: false,
          },
        });
      }
    }

    for (const nuevo of nuevos) {
      if (
        !actuales.some(
          (a) =>
            a.user_id === nuevo.userId &&
            a.responsabilidad_id === nuevo.responsabilidadId,
        )
      ) {
        await this.prisma.cuadro_firma_user.create({
          data: {
            user: { connect: { id: nuevo.userId } },
            cuadro_firma: { connect: { id: cuadroFirmaId } },
            responsabilidad_firma: { connect: { id: nuevo.responsabilidadId } },
            estaFirmado: false,
          },
        });
      }
    }
  }

  async getDocumentoByCuadroFirmaID(id: number) {
    const documentoDB = await this.prisma.documento.findFirst({
      where: {
        cuadro_firma_id: id,
      },
      select: {
        nombre_archivo: true,
        add_date: true,
        updated_at: true,
        user: {
          select: {
            id: true,
            primer_nombre: true,
            segundo_name: true,
            tercer_nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
            apellido_casada: true,
            correo_institucional: true,
          },
        },
      },
    });

    if (!documentoDB) {
      throw new Error(
        `El documento en el cuadro de firmas con ID ${id} no existe.`,
      );
    }

    return documentoDB;
  }

  async getUsuariosFirmantesCuadroFirmas(id: number) {
    return await this.prisma.cuadro_firma_user.findMany({
      where: {
        cuadro_firma_id: id,
      },
      select: {
        estaFirmado: true,
        user: {
          select: {
            id: true,
            primer_nombre: true,
            segundo_name: true,
            tercer_nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
            apellido_casada: true,
            correo_institucional: true,
          },
        },
        responsabilidad_firma: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });
  }

  async getHistorialCuadroFirmas(id: number, paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const totalCount = await this.prisma.cuadro_firma_estado_historial.count({
      where: { cuadro_firma_id: id },
    });

    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.min(page, totalPages);

    const historialDB =
      await this.prisma.cuadro_firma_estado_historial.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: {
          cuadro_firma_id: id,
        },
        select: {
          observaciones: true,
          fecha_observacion: true,
          user: {
            select: {
              id: true,
              primer_nombre: true,
              segundo_name: true,
              tercer_nombre: true,
              primer_apellido: true,
              segundo_apellido: true,
              apellido_casada: true,
              correo_institucional: true,
            },
          },
          estado_firma: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

    return {
      historial: historialDB,
      meta: {
        totalPages,
        totalCount,
        page: currentPage,
        limit,
        lastPage: totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async agregarHistorialCuadroFirma(
    addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto,
  ): Promise<cuadro_firma_estado_historial> {
    return await this.prisma.cuadro_firma_estado_historial.create({
      data: {
        user: { connect: { id: addHistorialCuadroFirmaDto.userId } },
        cuadro_firma: {
          connect: { id: addHistorialCuadroFirmaDto.cuadroFirmaId },
        },
        estado_firma: {
          connect: { id: addHistorialCuadroFirmaDto.estadoFirmaId },
        },
        observaciones: addHistorialCuadroFirmaDto.observaciones,
      },
    });
  }

  async updateEstadoFirma(
    updateEstadoAsignacion: UpdateEstadoAsignacionDto,
  ): Promise<any> {
    try {
      await this.prisma.cuadro_firma.update({
        where: { id: updateEstadoAsignacion.idCuadroFirma },
        data: {
          estado_firma_id: updateEstadoAsignacion.idEstadoFirma,
        },
      });

      const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
        cuadroFirmaId: updateEstadoAsignacion.idCuadroFirma,
        estadoFirmaId: updateEstadoAsignacion.idEstadoFirma,
        userId: updateEstadoAsignacion.idUser, // ? persona que actualiza el cuadro de firmas
        observaciones:
          updateEstadoAsignacion.observaciones ??
          `La asignación ha pasado al estado ${updateEstadoAsignacion.nombreEstadoFirma}`,
      };

      await this.agregarHistorialCuadroFirma(addHistorialCuadroFirmaDto);

      if (updateEstadoAsignacion.nombreEstadoFirma === 'Rechazado') {
        await this.prisma.cuadro_firma.update({
          where: { id: updateEstadoAsignacion.idCuadroFirma },
          data: { active: false },
        });
      }
      return true;
    } catch (error) {
      throw new HttpException(
        `Problemas al actualizar estado de firma para la asignación con id "${updateEstadoAsignacion.idCuadroFirma}: ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAsignacionesByUserId(userId: number, paginationDto: PaginationDto) {
    try {
      const { page = 1, limit = 10 } = paginationDto;

      const result = await this.prisma.cuadro_firma_user.findMany({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          user_id: userId,
        },
        select: {
          cuadro_firma: {
            select: {
              titulo: true,
              descripcion: true,
              codigo: true,
              version: true,
              nombre_pdf: true,
              add_date: true,
              estado_firma: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              empresa: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              user: {
                select: {
                  correo_institucional: true,
                  codigo_empleado: true,
                },
              },
            },
          },
          user: true,
        },
        distinct: ['cuadro_firma_id'],
      });
      const totalCount = result.length;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.min(page, totalPages);

      const mapped = result.map((item) => {
        // Calcula días solo si el estado no es Rechazado ni Finalizado
        let diasTranscurridos: number | undefined = undefined;
        const estado = item.cuadro_firma.estado_firma?.nombre?.toLowerCase();
        if (estado !== 'rechazado' && estado !== 'finalizado') {
          const fechaCreacion = item.cuadro_firma.add_date;
          const hoy = new Date();
          diasTranscurridos = Math.floor(
            (hoy.getTime() - new Date(fechaCreacion!).getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }

        return {
          ...item,
          usuarioAsignado: item.user,
          usuarioCreador: item.cuadro_firma.user,
          user: undefined,
          cuadro_firma: {
            ...item.cuadro_firma,
            user: undefined,
            diasTranscurridos,
          },
        };
      });

      return {
        asignaciones: mapped as Asignacion[],
        meta: {
          totalPages,
          totalCount,
          page: currentPage,
          limit,
          lastPage: totalPages,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Problemas al obtener asignaciones del usuario con id "${userId}: ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getSupervisionDocumentos(paginationDto: PaginationDto) {
    try {
      const { page = 1, limit = 10 } = paginationDto;

      const result = await this.prisma.cuadro_firma.findMany({
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          titulo: true,
          descripcion: true,
          codigo: true,
          version: true,
          add_date: true,
          estado_firma: {
            select: {
              id: true,
              nombre: true,
            },
          },
          empresa: {
            select: {
              id: true,
              nombre: true,
            },
          },

        },
      });

      const totalCount = result.length;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.min(page, totalPages);

      const mapped = await Promise.all(result.map(async (item) => {
        // ? Calcula días solo si el estado no es Rechazado ni Finalizado
        let diasTranscurridos: number | undefined = undefined;
        const estado = item.estado_firma!.nombre?.toLowerCase();
        if (estado !== 'rechazado' && estado !== 'finalizado') {
          const fechaCreacion = item.add_date;
          const hoy = new Date();
          diasTranscurridos = Math.floor(
            (hoy.getTime() - new Date(fechaCreacion!).getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }
        // ? Obtiene la observación más reciente del historial
        const historial = await this.prisma.cuadro_firma_estado_historial.findFirst(
          { 
            where: { cuadro_firma_id: item.id },
            orderBy: { fecha_observacion: 'desc' },
          },
          
        );

        return {
          ...item,
          diasTranscurridos,
          descripcionEstado: historial?.observaciones
        };
      }));

      console.log({mapped})

      return {
        documentos: mapped,
        meta: {
          totalPages,
          totalCount,
          page: currentPage,
          limit,
          lastPage: totalPages,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Problemas al obtener documentos: ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validarOrdenFirma(firmaCuadroDto: FirmaCuadroDto) {
    // ? Obtener la responsabilidad actual y su orden
    const responsabilidadActual =
      await this.prisma.responsabilidad_firma.findUnique({
        where: { nombre: firmaCuadroDto.nombreResponsabilidad },
        select: { orden: true },
      });

    if (!responsabilidadActual || responsabilidadActual.orden === null) {
      throw new HttpException(
        `Responsabilidad "${firmaCuadroDto.nombreResponsabilidad}" no es válida o no tiene orden definido.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // ? Buscar todas las responsabilidades previas (orden menor)
    const responsabilidadesPrevias =
      await this.prisma.responsabilidad_firma.findMany({
        where: {
          orden: { lt: responsabilidadActual.orden },
        },
        select: { nombre: true },
      });

    // ? Por cada responsabilidad previa, valida que todos hayan firmado
    for (const previa of responsabilidadesPrevias) {
      const firmantesPrevios = await this.prisma.cuadro_firma_user.findMany({
        where: {
          cuadro_firma_id: +firmaCuadroDto.cuadroFirmaId,
          responsabilidad_firma: { nombre: previa.nombre },
          estaFirmado: false,
        },
      });
      if (firmantesPrevios.length > 0) {
        throw new HttpException(
          `No puedes firmar hasta que todos los responsables de "${previa.nombre}" hayan firmado.`,
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }

  async updateCuadroFirmaUser(
    keys: {
      cuadroFirmaId: number;
      userId: number;
      responsabilidadId: number;
    },
    data: { [key: string]: any },
  ) {
    try {
      await this.prisma.cuadro_firma_user.update({
        where: {
          cuadro_firma_id_user_id_responsabilidad_id: {
            cuadro_firma_id: keys.cuadroFirmaId,
            user_id: keys.userId,
            responsabilidad_id: keys.responsabilidadId,
          },
        },
        data,
      });
    } catch (error) {
      throw new HttpException(
        `Problemas al actualizar cuadro_firma_user: ${error}.`,
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
