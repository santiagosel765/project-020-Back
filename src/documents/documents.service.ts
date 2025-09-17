import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
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
import { cuadro_firma, cuadro_firma_estado_historial } from 'generated/prisma';
import {
  CreateCuadroFirmaDto,
  FirmanteUserDto,
  ResponsablesFirmaDto,
} from './dto/create-cuadro-firma.dto';
import { formatCurrentDate } from 'src/helpers/formatDate';
import { AddHistorialCuadroFirmaDto } from './dto/add-historial-cuadro-firma.dto';
import { HttpResponse } from 'src/interfaces/http-response.interfaces';
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
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

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
    idUser: number,
    observaciones: string,
    file: Buffer,
  ) {
    try {
      const documentoDB = await this.getDocumentoByCuadroFirmaID(id);
      await this.awsService.uploadFile(file, documentoDB?.data.nombre_archivo!);

      const updateData = {
        updated_by: idUser,
        updated_at: new Date(),
      };

      await this.documentosRepository.updateDocumentoByCuadroFirmaID(
        id,
        updateData,
      );

      const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
        cuadroFirmaId: id,
        estadoFirmaId: 2, // ? En Progreso
        userId: idUser, // ? persona que actualiza el cuadro de firmas
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

    const cuadroFirmaDB = await this.findCuadroFirmaPDF(
      +firmaCuadroDto.cuadroFirmaId,
    );

    // ? Validar que las personas firmen en orden
    await this.cuadroFirmasRepository.validarOrdenFirma(firmaCuadroDto);

    const pdfBuffer = await this.awsService.getFileBuffer(
      cuadroFirmaDB?.nombre_pdf!,
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

      
      await this.prisma.cuadro_firma.update({
        where: {
          id: +firmaCuadroDto.cuadroFirmaId,
        },
        data: {
          estado_firma_id: 2,
        },
      });

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
        cuadroFirmaDB?.nombre_pdf!,
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
    pdfContent: NonSharedBuffer;
    plantilladId: number;
    formattedHtml: string;
    fileName: string;
  }> {
    try {
      const { pdfContent, plantilladId, formattedHtml, fileName } =
        await this.cuadroFirmasRepository.generarCuadroFirmas(
          createCuadroFirmaDto,
          responsables,
        );

      return {
        pdfContent,
        plantilladId: plantilladId,
        formattedHtml,
        fileName,
      };
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al generar cuadro de firmas: ${error}`,
      );
    }
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
  ): Promise<cuadro_firma> {
    try {
      const { pdfContent, plantilladId, formattedHtml, fileName } =
        await this.generarCuadroFirmas(createCuadroFirmaDto, responsables);

      // ? Subir cuadro de firmas a S3
      const { fileKey: cuadroFirmasKey } = await this.awsService.uploadFile(
        pdfContent,
        fileName,
      );

      const timestamp: number = Date.now();
      const timestampString: string = timestamp.toString();
      const bucketFileName = `DOCUMENTO_PDF_${timestampString}`;
      const { fileKey } = await this.awsService.uploadFile(
        documentoPDF,
        bucketFileName,
      );

      // ? Guardar cuadro de firmas en DB, por defecto inicia en estado "Pendiente"
      const cuadroFirmaDB =
        await this.cuadroFirmasRepository.guardarCuadroFirmas(
          createCuadroFirmaDto,
          responsables,
          documentoPDF,
          null,
          plantilladId,
          formattedHtml,
          fileName,
          cuadroFirmasKey!,
          bucketFileName!,
          +createCuadroFirmaDto.createdBy,
        );

      if (!cuadroFirmaDB) {
        throw new HttpException(
          `Problemas al generar cuadro de firmas`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await this.asignarResponsablesCuadroFirmas(
        responsables,
        cuadroFirmaDB.id,
      );

      // ? Subir documento negocio a S3

      // ? Crear documento
      await this.prisma.documento.create({
        data: {
          cuadro_firma: { connect: { id: cuadroFirmaDB.id } },
          pdf: documentoPDF,
          user: { connect: { id: cuadroFirmaDB.created_by! } },
          nombre_archivo: bucketFileName,
          url_documento: fileKey,
        },
      });

      return cuadroFirmaDB;
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al generar cuadro de firmas: ${error}`,
      );
    }
  }

  async asignarResponsablesCuadroFirmas(
    responsables: ResponsablesFirmaDto,
    cuadroFirmaID: number,
  ) {
    await this.agregarResponsableCuadroFirma(
      responsables?.elabora!,
      cuadroFirmaID,
    );
    responsables?.revisa?.forEach(async (f) => {
      await this.agregarResponsableCuadroFirma(f, cuadroFirmaID);
    });
    responsables?.aprueba?.forEach(async (f) => {
      await this.agregarResponsableCuadroFirma(f, cuadroFirmaID);
    });
  }

  async getDocumentoURLBucket(fileName: string) {
    const url = await this.awsService.getPresignedURL(fileName);
    return {
      status: HttpStatus.ACCEPTED,
      data: url,
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

  async agregarResponsableCuadroFirma(
    firmanteUserDto: FirmanteUserDto,
    cuadroFirmaId: number,
  ): Promise<any> {
    try {
      return await this.prisma.cuadro_firma_user.create({
        data: {
          user: { connect: { id: firmanteUserDto.userId } },
          cuadro_firma: {
            connect: { id: cuadroFirmaId },
          },
          responsabilidad_firma: {
            connect: { id: firmanteUserDto.responsabilidadId },
          },
        },
      });
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al agregar usuario responsable con id "${firmanteUserDto.userId}" al cuadro de firma con id "${cuadroFirmaId}": ${error}`,
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

  async getAsignacionesByUserId(userId: number, paginationDto: PaginationDto) {
    const asignaciones =
      await this.cuadroFirmasRepository.getAsignacionesByUserId(userId, paginationDto);
    if (asignaciones.asignaciones.length === 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        data: `No hay asignaciones para el usuario con id "${userId}"`,
      };
    }
    return {
      status: HttpStatus.ACCEPTED,
      data: asignaciones,
    };
  }
  async getSupervisionDocumentos(paginationDto: PaginationDto) {
    const asignaciones =
      await this.cuadroFirmasRepository.getSupervisionDocumentos(paginationDto);
    if (asignaciones.documentos.length === 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        data: `No hay documentos registrados en la plataforma"`,
      };
    }
    return {
      status: HttpStatus.ACCEPTED,
      data: asignaciones,
    };
  }
}
