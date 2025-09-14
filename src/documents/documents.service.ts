import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PDF_REPOSITORY } from '../pdf/domain/repositories/pdf.repository';
import type { PdfRepository } from '../pdf/domain/repositories/pdf.repository';
import fs from 'fs';
import path from 'path';
import { SignDocumentDto } from './dto/sign-document.dto';
import { PDF_GENERATION_REPOSITORY } from 'src/pdf/domain/repositories/pdf-generation.repository';
import type { PdfGenerationRepository } from 'src/pdf/domain/repositories/pdf-generation.repository';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, cuadro_firma, cuadro_firma_estado_historial } from 'generated/prisma';
import { CreateCuadroFirmaDto, ResponsablesFirmaDto } from './dto/create-cuadro-firma.dto';
import { formatCurrentDate } from 'src/helpers/formatDate';
import { AddHistorialCuadroFirmaDto } from './dto/add-historial-cuadro-firma.dto';
import { HttpResponse } from 'src/interfaces/http-response.interfaces';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { UpdateCuadroFirmaDto } from './dto/update-cuadro-firma.dto';
import { CuadroFirmaDB } from './interfaces/cuadro-firma.interface';
import { FirmaCuadroDto } from './dto/firma-cuadro.dto';
import { AWSService } from 'src/aws/aws.service';
import { generarFilasFirmas } from './utils/generar-filas-firma.utils';
import {
  CUADRO_FIRMAS_REPOSITORY,
  CuadroFirmaRepository,
} from 'src/database/domain/repositories/cuadro-firmas.repository';
import {
  DOCUMENTOS_REPOSITORY,
  DocumentosRepository,
} from 'src/database/domain/repositories/documentos.repository';
import { UpdateEstadoAsignacionDto } from './dto/update-estado-asignacion.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { withPrismaRetry } from 'src/utils/prisma-retry';

@Injectable()
export class DocumentsService {
  logger: Logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(CUADRO_FIRMAS_REPOSITORY)
    private readonly cuadroFirmasRepository: CuadroFirmaRepository,
    @Inject(DOCUMENTOS_REPOSITORY)
    private readonly documentosRepository: DocumentosRepository,
    @Inject(PDF_REPOSITORY)
    private readonly pdfRepository: PdfRepository,
    @Inject(PDF_GENERATION_REPOSITORY)
    private readonly pdfGeneratorRepository: PdfGenerationRepository,
    private prisma: PrismaService,
    private awsService: AWSService,
  ) {}

  private handleDBErrors = (error: any, msg: string = '') => {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
    }
    throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
  };

  async guardarDocumento(file: Buffer) {
    const timestamp: number = Date.now();
    const timestampString: string = timestamp.toString();
    const fileName = `DOCUMENTO_PDF_${timestampString}`;
    return await this.awsService.uploadFile(file, fileName);
  }

  async updateDocumentoAsignacion(
    id: number,
    userId: number,
    observaciones: string,
    file: Buffer,
  ) {
    try {
      const documentoDB = await this.getDocumentoByCuadroFirmaID(id);
      await this.awsService.uploadFile(file, documentoDB?.data.nombre_archivo!);

      const updateData = {
        updated_by: userId,
        updated_at: new Date(),
      };

      await this.documentosRepository.updateDocumentoByCuadroFirmaID(
        id,
        updateData,
      );

      const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
        cuadroFirmaId: id,
        estadoFirmaId: 2, // ? En Progreso
        userId: userId, // ? persona que actualiza el cuadro de firmas
        observaciones: observaciones ?? `Se ha actualizado el documento`,
      };

      await this.cuadroFirmasRepository.agregarHistorialCuadroFirma(
        addHistorialCuadroFirmaDto,
      );
      return {
        status: HttpStatus.ACCEPTED,
        data: 'Documento actualizado exitosamente',
      };
    } catch (error) {
      this.handleDBErrors(
        error,
        `Problemas al actualziar documento de asignación`,
      );
    }
  }

  async signDocument(
    firmaCuadroDto: FirmaCuadroDto,
    signatureBuffer: Buffer,
  ): Promise<any> {
    // TODO: Considerar obtener imagen firma de DB

    const cuadroFirmaPDF = await this.findCuadroFirmaPDF(
      +firmaCuadroDto.cuadroFirmaId,
    );
    const estadoActual = await this.prisma.cuadro_firma.findUnique({
      where: { id: +firmaCuadroDto.cuadroFirmaId },
      select: { estado_firma: { select: { nombre: true } }, estado_firma_id: true },
    });

    if (
      ['rechazado', 'finalizado'].includes(
        estadoActual?.estado_firma?.nombre?.toLowerCase() ?? '',
      )
    ) {
      throw new HttpException(
        'El documento no admite más firmas',
        HttpStatus.BAD_REQUEST,
      );
    }

    // ? Validar que las personas firmen en orden
    await this.cuadroFirmasRepository.validarOrdenFirma(firmaCuadroDto);

    const pdfBuffer = await this.awsService.getFileBuffer(
      cuadroFirmaPDF?.nombre_pdf!,
    );

    let placeholder = 'FECHA_';
    const nombreCompleto = firmaCuadroDto.nombreUsuario.replaceAll(' ', '_');
    switch (firmaCuadroDto.nombreResponsabilidad) {
      case 'Aprueba':
        placeholder += `APRUEBA_${nombreCompleto}`;
        break;
      case 'Revisa':
        placeholder += `REVISA_${nombreCompleto}`;
        break;
      case 'Enterado':
        placeholder += `ENTERADO_${nombreCompleto}`;
        break;
      case 'Elabora':
        placeholder += `ELABORA_${nombreCompleto}`;
        break;
      default:
        break;
    }

    const signedPdfBuffer = await this.pdfRepository.insertSignature(
      pdfBuffer!,
      signatureBuffer,
      placeholder,
      null as any,
    );

    try {
      // await this.prisma.cuadro_firma.update({
      //   where: {
      //     id: +firmaCuadroDto.cuadroFirmaId,
      //   },
      //   data: {
      //     pdf: null,
      //   },
      // });

      const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
        cuadroFirmaId: +firmaCuadroDto.cuadroFirmaId,
        estadoFirmaId: 2, // ? En Progreso
        userId: +firmaCuadroDto.userId,
        observaciones: `${firmaCuadroDto.nombreUsuario}, responsable de "${firmaCuadroDto.nombreResponsabilidad}" ha firmado el documento`,
      };

      
      await this.agregarHistorialCuadroFirma(addHistorialCuadroFirmaDto);

      await this.cuadroFirmasRepository.updateCuadroFirmaUser(
        {
          cuadroFirmaId: +firmaCuadroDto.cuadroFirmaId,
          userId: +firmaCuadroDto.userId,
          responsabilidadId: +firmaCuadroDto.responsabilidadId,
        },
        {
          estaFirmado: true,
          fecha_firma: new Date(),
        }
      );

      const totalFirmantes = await this.prisma.cuadro_firma_user.count({
        where: { cuadro_firma_id: +firmaCuadroDto.cuadroFirmaId },
      });
      const firmados = await this.prisma.cuadro_firma_user.count({
        where: {
          cuadro_firma_id: +firmaCuadroDto.cuadroFirmaId,
          estaFirmado: true,
        },
      });

      let nuevoEstadoId: number | undefined;
      if (estadoActual?.estado_firma_id === 4 && firmados >= 1) {
        nuevoEstadoId = 2; // En Progreso
      }
      if (firmados === totalFirmantes) {
        nuevoEstadoId = 3; // Finalizado
      }
      if (nuevoEstadoId) {
        await this.prisma.cuadro_firma.update({
          where: { id: +firmaCuadroDto.cuadroFirmaId },
          data: { estado_firma_id: nuevoEstadoId },
        });
        await this.agregarHistorialCuadroFirma({
          cuadroFirmaId: +firmaCuadroDto.cuadroFirmaId,
          estadoFirmaId: nuevoEstadoId,
          userId: +firmaCuadroDto.userId,
          observaciones:
            nuevoEstadoId === 3
              ? 'Todos los responsables han firmado'
              : 'Documento en progreso',
        });
      }

      // await this.prisma.cuadro_firma_user.update({
      //   where: {
      //     // ? Llave compuesta
      //     cuadro_firma_id_user_id_responsabilidad_id: {
      //       cuadro_firma_id: +firmaCuadroDto.cuadroFirmaId,
      //       user_id: +firmaCuadroDto.userId,
      //       responsabilidad_id: +firmaCuadroDto.responsabilidadId,
      //     },
      //   },

      //   data: {
      //     estaFirmado: true,
      //     fecha_firma: new Date(),
      //   },
      // });

      await this.awsService.uploadFile(
        signedPdfBuffer!,
        cuadroFirmaPDF?.nombre_pdf!,
      );

      return {
        status: HttpStatus.ACCEPTED,
        data: 'Documento firmado exitosamente',
      };
    } catch (error) {
      throw new HttpException(
        `Problemas al generar archivo de salida: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzePDFTest(pdfBuffer: Buffer) {
    return this.pdfRepository.extractText(pdfBuffer);
  }

  /**
   * Genera y almacena una nueva plantilla HTML personalizada para una empresa.
   *
   * Este método:
   * 1. Verifica si ya existe una plantilla para la empresa indicada por `idEmpresa`.
   * 2. Lee el archivo base de plantilla HTML (`src/templates/cuadroFirmas.html`).
   * 3. Reemplaza los placeholders del HTML con los valores proporcionados (por ejemplo, el color).
   * 4. Crea el registro de la plantilla en la base de datos, asociándola a la empresa.
   *
   * @param createPlantillaDto - DTO con los datos para la plantilla (color, nombre, descripción, idEmpresa).
   * @returns Confirmación de creación de plantilla
   * @throws HttpException si ya existe una plantilla para la empresa o si ocurre un error al crearla.
   */
  async generarPlantilla(
    createPlantillaDto: CreatePlantillaDto,
  ): Promise<HttpResponse<string>> {
    const dbPlantilla = await this.prisma.plantilla.findFirst({
      where: {
        empresa_id: createPlantillaDto.idEmpresa,
      },
    });

    if (dbPlantilla) {
      throw new HttpException(
        `La plantilla para la empresa con ID ${createPlantillaDto.idEmpresa} ya existe`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const htmlFile = path.join(
      process.cwd(),
      'src/templates/cuadroFirmas.html',
    );

    const htmlContent = fs.readFileSync(htmlFile).toString();

    const htmlResultContent = this.pdfGeneratorRepository.replacePlaceholders(
      htmlContent,
      { '[COLOR]': createPlantillaDto.color },
    );

    try {
      await this.prisma.plantilla.create({
        data: {
          color: createPlantillaDto.color,
          nombre: createPlantillaDto.nombre,
          descripcion: createPlantillaDto.descripcion,
          plantilla: htmlResultContent,
          empresa: { connect: { id: createPlantillaDto.idEmpresa } },
        },
      });

      return {
        status: HttpStatus.CREATED,
        data: 'Plantilla creada exitosamente',
      };
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al generar plantilla para empresa con ID "${createPlantillaDto.idEmpresa}": ${error}`,
      );
    }
  }

  /**
   * Genera el PDF de un cuadro de firmas a partir de la plantilla asociada a la empresa.
   *
   * Este método:
   * 1. Busca la plantilla correspondiente a la empresa indicada en el DTO.
   * 2. Reemplaza los placeholders del HTML de la plantilla con los datos del cuadro de firmas.
   * 3. Genera el PDF a partir del HTML personalizado.
   * 4. Devuelve el contenido del PDF generado y el ID de la plantilla utilizada.
   *
   * @param createCuadroFirmaDto - DTO con los datos necesarios para el cuadro de firmas.
   * @returns Un objeto con el buffer del PDF generado (`pdfContent`) y el ID de la plantilla utilizada (`plantilladId`).
   * @throws HttpException si no existe plantilla para la empresa o si ocurre un error al generar el PDF.
   */
  async generarCuadroFirmas(
    createCuadroFirmaDto: CreateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
  ): Promise<{
    pdfContent: Buffer;
    plantilladId: number;
    formattedHtml: string;
    fileName: string;
  }> {
    const dbPlantilla = await withPrismaRetry(
      () =>
        this.prisma.plantilla.findFirst({
          where: { empresa_id: +createCuadroFirmaDto.empresa_id },
          include: { empresa: true },
        }),
      this.prisma,
    );

    if (!dbPlantilla) {
      throw new Error(
        `La plantilla de la empresa con ID "${createCuadroFirmaDto.empresa_id}" no existe`,
      );
    }

    // Defaults seguros
    const nombreElabora = (responsables?.elabora?.nombre ?? '').trim();
    const puestoElabora = responsables?.elabora?.puesto ?? '';
    const gerenciaElabora = responsables?.elabora?.gerencia ?? '';
    const nombreElaboraSlug = nombreElabora
      ? nombreElabora.replace(/\s+/g, '_')
      : 'ELABORA';

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
      '[TITULO]': createCuadroFirmaDto.titulo ?? '',
      '[CODIGO]': createCuadroFirmaDto.codigo ?? '',
      '[VERSION]': createCuadroFirmaDto.version ?? '',
      '[DESCRIPCION]': createCuadroFirmaDto.descripcion ?? '',
      '[FECHA]': formatCurrentDate(),
      '[LOGO_URL]': dbPlantilla.empresa?.logo ?? '',
      FIRMANTE_ELABORA: nombreElabora,
      PUESTO_ELABORA: puestoElabora,
      GERENCIA_ELABORA: gerenciaElabora,
      FECHA_ELABORA: `FECHA_ELABORA_${nombreElaboraSlug}`,
      '[FILAS_REVISA]': filasRevisaStr ?? '',
      '[FILAS_APRUEBA]': filasApruebaStr ?? '',
    };

    const formattedHtml = this.pdfGeneratorRepository.replacePlaceholders(
      dbPlantilla.plantilla ?? '',
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


  /**
   * Genera y guarda un nuevo cuadro de firmas en la base de datos.
   *
   * Este método:
   * 1. Genera el PDF del cuadro de firmas utilizando la plantilla correspondiente y los datos proporcionados.
   * 2. Crea el registro en la tabla `cuadro_firma` con los datos y el PDF generado.
   * 3. Asocia el cuadro de firmas a la empresa, plantilla y usuario correspondiente.
   *
   * @param createCuadroFirmaDto - DTO con los datos necesarios para crear el cuadro de firmas.
   * @returns El registro creado en la tabla `cuadro_firma`.
   * @throws HttpException si ocurre un error al generar el PDF o al guardar el registro.
   */
  async guardarCuadroFirmas(
    createCuadroFirmaDto: CreateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
    documentoPDF: Buffer,
  ): Promise<{
    id: number;
    codigo: string;
    titulo: string;
    url_pdf: string;
    nombre_pdf: string;
    firmantesCreados: number;
  }> {
    try {
      const toArray = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
      const respUpper = {
        ELABORA: responsables?.elabora,
        REVISA: responsables?.revisa,
        APRUEBA: responsables?.aprueba,
      } as any;

      type RoleName = 'ELABORA' | 'REVISA' | 'APRUEBA';
      type Assign = { userId: number; roleName: RoleName };
      const roles: Assign[] = [
        ...toArray(respUpper.ELABORA).map((x: any) => ({
          userId: +x.userId,
          roleName: 'ELABORA' as RoleName,
        })),
        ...toArray(respUpper.REVISA).map((x: any) => ({
          userId: +x.userId,
          roleName: 'REVISA' as RoleName,
        })),
        ...toArray(respUpper.APRUEBA).map((x: any) => ({
          userId: +x.userId,
          roleName: 'APRUEBA' as RoleName,
        })),
      ].filter((a) => Number.isFinite(a.userId));

      const respDto: ResponsablesFirmaDto = responsables;

      const exists = await withPrismaRetry(
        () => this.prisma.cuadro_firma.findUnique({
          where: { codigo: createCuadroFirmaDto.codigo },
        }),
        this.prisma,
      );
      if (exists) {
        throw new ConflictException('El código ya está en uso. Elige otro código.');
      }

      const { pdfContent, plantilladId, formattedHtml, fileName } =
        await this.generarCuadroFirmas(createCuadroFirmaDto, respDto);

      const { fileKey: cuadroFirmasKey } = await this.awsService.uploadFile(
        pdfContent,
        fileName,
      );

      const timestampString = Date.now().toString();
      const bucketFileName = `DOCUMENTO_PDF_${timestampString}`;
      await this.awsService.uploadFile(documentoPDF, bucketFileName);

      const cf = await this.cuadroFirmasRepository.guardarCuadroFirmas(
        createCuadroFirmaDto,
        respDto,
        documentoPDF,
        pdfContent,
        plantilladId,
        formattedHtml,
        fileName,
        cuadroFirmasKey!,
        bucketFileName!,
        +createCuadroFirmaDto.createdBy,
      );

      // ... después de crear `cf` y antes del return

      if (roles.length > 0) {
        // Trae todas las responsabilidades y normaliza a UPPER
        const responsabilidades = await this.prisma.responsabilidad_firma.findMany();

        const rolIdByName = new Map<string, number>();
        for (const r of responsabilidades) {
          const key = (r.nombre ?? '').trim().toUpperCase();
          if (key) rolIdByName.set(key, r.id);
        }

        let inserted = 0;

        await this.prisma.$transaction(async (tx) => {
          for (const r of roles) {
            const responsabilidadId = rolIdByName.get(r.roleName); // 'ELABORA'|'REVISA'|'APRUEBA'|'ENTERADO'
            if (!responsabilidadId) {
              this.logger.warn(
                `[guardarCuadroFirmas] responsabilidad no encontrada: ${r.roleName}`
              );
              continue;
            }

            await tx.cuadro_firma_user.upsert({
              where: {
                cuadro_firma_id_user_id_responsabilidad_id: {
                  cuadro_firma_id: cf.id,
                  user_id: r.userId,
                  responsabilidad_id: responsabilidadId,
                },
              },
              update: {},
              create: {
                cuadro_firma_id: cf.id,
                user_id: r.userId,
                responsabilidad_id: responsabilidadId,
                estaFirmado: false,
              },
            });

            inserted++;
          }
        });

        // Reemplaza el firmantesCreados por el conteo real
        return {
          id: cf.id,
          codigo: cf.codigo ?? createCuadroFirmaDto.codigo,
          titulo: cf.titulo,
          url_pdf: cf.url_pdf!,
          nombre_pdf: cf.nombre_pdf!,
          firmantesCreados: inserted, // 👈 ahora sí es real
        };
      }

      // Si no hubo roles, conserva el return original
      return {
        id: cf.id,
        codigo: cf.codigo ?? createCuadroFirmaDto.codigo,
        titulo: cf.titulo,
        url_pdf: cf.url_pdf!,
        nombre_pdf: cf.nombre_pdf!,
        firmantesCreados: 0,
      };
    } catch (e: any) {
      this.logger.error('[createCuadroFirmas] failed', e);
      if (e instanceof BadRequestException) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('El código ya está en uso. Elige otro código.');
      }
      if (
        e?.code === 'P1001' ||
        e?.code === 'P1002' ||
        e?.code === 'P1017' ||
        e?.message?.includes('ECONNRESET') ||
        e?.message?.includes('server has closed the connection')
      ) {
        throw new ServiceUnavailableException('Intente de nuevo');
      }
      throw new InternalServerErrorException(
        'Problemas al generar cuadro de firmas: ' + e.message,
      );
    }
  }

  async getDocumentoURLBucket(fileName: string) {
    const url = await this.awsService.getPresignedURL(fileName);
    return {
      status: HttpStatus.OK,
      data: url.data,
    };
  }

  /**
   * Agrega un nuevo registro al historial de estados de un cuadro de firma.
   *
   * Este método:
   * 1. Crea un registro en la tabla `cuadro_firma_estado_historial` asociando el usuario, el cuadro de firma,
   *    el estado de firma y las observaciones proporcionadas.
   * 2. Devuelve el registro creado.
   *
   * @param addHistorialCuadroFirmaDto - DTO con los datos necesarios para el historial (userId, cuadroFirmaId, estadoFirmaId, observaciones).
   * @returns El registro creado en `cuadro_firma_estado_historial`.
   * @throws HttpException si ocurre un error al crear el registro.
   */
  async agregarHistorialCuadroFirma(
    addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto,
  ): Promise<cuadro_firma_estado_historial> {
    try {
      return await this.cuadroFirmasRepository.agregarHistorialCuadroFirma(
        addHistorialCuadroFirmaDto,
      );
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al crear registro en historial de cuadro de firma con id "${addHistorialCuadroFirmaDto.cuadroFirmaId}": ${error}`,
      );
    }
  }

  async findCuadroFirma(id: number): Promise<CuadroFirmaDB> {
    try {
      const cuadroFirmaDB = await this.prisma.cuadro_firma.findFirst({
        where: { id },
        select: {
          id: true,
          titulo: true,
          nombre_pdf: true,
          descripcion: true,
          version: true,
          codigo: true,
          empresa_id: true,
          created_by: true,
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
              gerencia: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              posicion: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          estado_firma: {
            select: {
              nombre: true,
              descripcion: true,
            },
          },
          cuadro_firma_estado_historial: {
            select: {
              observaciones: true,
              fecha_observacion: true,
              updated_at: true,
              user: true,
              estado_firma: true,
            },
          },
          cuadro_firma_user: {
            select: {
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
                  gerencia: {
                    select: {
                      id: true,
                      nombre: true,
                    },
                  },
                  posicion: {
                    select: {
                      id: true,
                      nombre: true,
                    },
                  },
                },
              },
              responsabilidad_firma: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      });

      if (!cuadroFirmaDB) {
        throw new HttpException(
          `Cuadro de firma con ID "${id} no existe"`,
          HttpStatus.NOT_FOUND,
        );
      }

      return cuadroFirmaDB as CuadroFirmaDB;
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al obtener cuadro de firma con id "${id}": ${error}`,
      );
    }
  }

  async findCuadroFirmaPDF(id: number): Promise<{
    pdf: Uint8Array<ArrayBufferLike> | null;
    nombre_pdf: string | null;
  } | null> {
    try {
      const cuadroFirmaPDF = await this.prisma.cuadro_firma.findFirst({
        where: { id },
        select: {
          pdf: true,
          nombre_pdf: true,
        },
      });

      if (!cuadroFirmaPDF) {
        throw new HttpException(
          `Cuadro de firma con ID "${id} no existe"`,
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        pdf: cuadroFirmaPDF.pdf,
        nombre_pdf: cuadroFirmaPDF.nombre_pdf,
      };
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al obtener pdf del cuadro de firma con id "${id}": ${error}`,
      );
    }
  }

  /**
   * Actualiza un cuadro de firmas existente y regenera su PDF.
   *
   * Este método:
   * 1. Obtiene el registro actual del cuadro de firmas por su ID.
   * 2. Prepara los datos combinando los valores actuales y los nuevos del DTO.
   * 3. Genera un nuevo PDF basado en los datos actualizados.
   * 4. Realiza un solo update en la base de datos, guardando los nuevos datos y el PDF generado.
   *
   * @param id - ID del cuadro de firmas a actualizar.
   * @param updateCuadroFirmaDto - DTO con los campos a actualizar.
   * @returns Un objeto con el estado HTTP y un mensaje de éxito.
   * @throws HttpException si el cuadro de firmas no existe o si ocurre un error durante la actualización.
   */
  async updateCuadroFirmas(
    id: number,
    updateCuadroFirmaDto: UpdateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
  ) {
    try {
      const cuadroFirmaDB = await this.findCuadroFirma(id);

      const createCuadroFirmaDto: CreateCuadroFirmaDto = {
        titulo: updateCuadroFirmaDto.titulo ?? cuadroFirmaDB.titulo,
        descripcion:
          updateCuadroFirmaDto.descripcion ?? cuadroFirmaDB.descripcion!,
        version: updateCuadroFirmaDto.version ?? cuadroFirmaDB.version!,
        codigo: updateCuadroFirmaDto.codigo ?? cuadroFirmaDB.codigo!,
        empresa_id:
          updateCuadroFirmaDto.empresa_id! ?? cuadroFirmaDB.empresa_id!,
        createdBy:
          updateCuadroFirmaDto.createdBy! ?? +cuadroFirmaDB.created_by!,
      };

      const { pdfContent } = await this.generarCuadroFirmas(
        createCuadroFirmaDto,
        responsables,
      );

      const updatedCuadroFirmas =
        await this.cuadroFirmasRepository.updateCuadroFirmas(
          id,
          updateCuadroFirmaDto,
          responsables,
          null,
          +createCuadroFirmaDto.empresa_id,
        );

      if (!updatedCuadroFirmas) {
        throw new HttpException(
          `Problemas al actualizar cuadro de firmas con ID "${id}"`,
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.awsService.uploadFile(pdfContent, cuadroFirmaDB.nombre_pdf);

      const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
        cuadroFirmaId: id,
        estadoFirmaId: 2, // ? En Progreso
        userId: +updateCuadroFirmaDto.createdBy!, // ? persona que actualiza el cuadro de firmas
        observaciones:
          updateCuadroFirmaDto.observaciones ??
          `Se ha actualizado el cuadro de firmas`,
      };

      await this.cuadroFirmasRepository.agregarHistorialCuadroFirma(
        addHistorialCuadroFirmaDto,
      );

      return {
        status: HttpStatus.ACCEPTED,
        data: 'Cuadro de firmas actualizado exitosamente',
      };
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al actualizar cuadro de firmas con id "${id}": ${error}`,
      );
    }
  }

  async getAllEstadosFirma() {
    return this.prisma.estado_firma.findMany();
  }

  async getDocumentoByCuadroFirmaID(id: number) {
    try {
      const documentoDB =
        await this.cuadroFirmasRepository.getDocumentoByCuadroFirmaID(id);
      return {
        status: HttpStatus.ACCEPTED,
        data: documentoDB,
      };
    } catch (error) {
      throw new HttpException(
        `Problemas al obtener documento en cuadro de firmas con ID "${id}": ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUsuariosFirmantesCuadroFirmas(id: number) {
    try {
      const firmantes =
        await this.cuadroFirmasRepository.getUsuariosFirmantesCuadroFirmas(id);
      return {
        status: HttpStatus.ACCEPTED,
        data: firmantes,
      };
    } catch (error) {
      this.handleDBErrors(
        error,
        `Problemas al obtener firmantes de cuadro de firmas`,
      );
    }
  }

  async getHistorialCuadroFirmas(id: number, paginationDto: PaginationDto) {
    try {
      const historial =
        await this.cuadroFirmasRepository.getHistorialCuadroFirmas(id, paginationDto);

      return {
        status: HttpStatus.ACCEPTED,
        data: historial,
      };
    } catch (error) {
      this.handleDBErrors(
        error,
        `Problemas al obtener historial de cuadro de firmas`,
      );
    }
  }

  async updateEstadoAsignacion(
    updateEstadoAsignacionDto: UpdateEstadoAsignacionDto,
  ) {
    const isUpdated = await this.cuadroFirmasRepository.updateEstadoFirma(
      updateEstadoAsignacionDto,
    );
    return {
      status: HttpStatus.ACCEPTED,
      data: 'Estado de asignación actualizado exitosamente',
    };
  }

  async getAsignacionesByUserId(
    userId: number,
    paginationDto: PaginationDto,
  ) {
    const asignaciones =
      await this.cuadroFirmasRepository.getAsignacionesByUserId(
        userId,
        paginationDto,
      );
    if (asignaciones.asignaciones.length === 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        data: `No hay asignaciones para el usuario con id "${userId}"`,
      };
    }
    return {
      status: HttpStatus.OK,
      data: {
        items: asignaciones.asignaciones,
        total: asignaciones.meta.totalCount,
        page: asignaciones.meta.page,
        limit: asignaciones.meta.limit,
      },
    };
  }

  async getSupervisionDocumentos(paginationDto: PaginationDto) {
    const documentos =
      await this.cuadroFirmasRepository.getSupervisionDocumentos(
        paginationDto,
      );
    if (documentos.documentos.length === 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        data: `No hay documentos registrados en la plataforma"`,
      };
    }
    return {
      status: HttpStatus.OK,
      data: {
        items: documentos.documentos,
        total: documentos.meta.totalCount,
        page: documentos.meta.page,
        limit: documentos.meta.limit,
      },
    };
  }
}
