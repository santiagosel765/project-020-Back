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
import { AddHistorialCuadroFirmaDto } from './dto/add-historial-cuadro-firma.dto';
import { HttpResponse } from 'src/interfaces/http-response.interfaces';
import { UpdateCuadroFirmaDto } from './dto/update-cuadro-firma.dto';
import { CuadroFirmaDB } from './interfaces/cuadro-firma.interface';
import { FirmaCuadroDto } from './dto/firma-cuadro.dto';
import { AWSService } from 'src/aws/aws.service';
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
import { joinWithSpace } from 'src/common/utils/strings';
import { Prisma } from 'generated/prisma';
import { ListQueryDto } from './dto/list-query.dto';
import { resolvePhotoUrl } from 'src/shared/helpers/file.helpers';
import {
  buildPaginationResult,
  logPaginationDebug,
  normalizePagination,
  stableOrder,
} from 'src/shared/utils/pagination';
import {
  NOTIFICACIONES_REPOSITORY,
  NotificacionesRepository,
} from 'src/database/domain/repositories/notificaciones.repository';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  NotificationBulkReadDto,
  NotificationPaginationDto,
} from './dto/notification-response.dto';
import { buildNotificationPayload } from './utils/notification.presenter';
import { WsService } from 'src/ws/ws.service';

@Injectable()
export class DocumentsService {
  logger: Logger = new Logger(DocumentsService.name);

  private readonly responsabilidadCache = new Map<
    'Elabora' | 'Revisa' | 'Aprueba' | 'Enterado',
    number
  >();

  constructor(
    @Inject(CUADRO_FIRMAS_REPOSITORY)
    private readonly cuadroFirmasRepository: CuadroFirmaRepository,
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly notificacionesRepository: NotificacionesRepository,
    @Inject(DOCUMENTOS_REPOSITORY)
    private readonly documentosRepository: DocumentosRepository,
    @Inject(PDF_REPOSITORY)
    private readonly pdfRepository: PdfRepository,
    @Inject(PDF_GENERATION_REPOSITORY)
    private readonly pdfGeneratorRepository: PdfGenerationRepository,
    private wsService: WsService,
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

  private buildFullNameFromUser(user: {
    primer_nombre?: string | null;
    segundo_name?: string | null;
    tercer_nombre?: string | null;
    primer_apellido?: string | null;
    segundo_apellido?: string | null;
    apellido_casada?: string | null;
  }): string {
    return joinWithSpace(
      user.primer_nombre,
      user.segundo_name,
      user.tercer_nombre,
      user.primer_apellido,
      user.segundo_apellido,
      user.apellido_casada,
    );
  }

  private buildInitialsFromFullName(fullName: string): string {
    if (!fullName) {
      return '';
    }

    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }

  private async mapFirmantesResumen(
    firmantes?: Array<{
      user?: {
        id?: number | string | null;
        primer_nombre?: string | null;
        segundo_name?: string | null;
        tercer_nombre?: string | null;
        primer_apellido?: string | null;
        segundo_apellido?: string | null;
        apellido_casada?: string | null;
        url_foto?: string | null;
        urlFoto?: string | null;
        // Prisma puede traer bytes aquí. Relajamos el tipo:
        foto_perfil?: unknown;
        nombre?: string | null;
      } | null;
      user_id?: number | null;
      responsabilidad_firma?: { nombre?: string | null } | null;
    }>,
  ) {
    return Promise.all(
      (firmantes ?? []).map(async (firmante) => {
        const user = firmante?.user ?? {};
        const nombreBase = this.buildFullNameFromUser(user);
        const nombre = nombreBase || joinWithSpace(user.nombre);
        const iniciales = this.buildInitialsFromFullName(nombre);
        const rawId = (user as any).id ?? firmante?.user_id ?? 0;

        const rawFoto =
          (user as any).url_foto ??
          (user as any).urlFoto ??
          (user as any).foto_perfil ??
          null;
        const urlFoto = await this.resolveFotoUrl(rawFoto);

        return {
          id: Number(rawId),
          nombre,
          iniciales,
          urlFoto,
          responsabilidad: firmante?.responsabilidad_firma?.nombre ?? '',
        };
      }),
    );
  }

  private async resolveFotoUrl(raw: unknown): Promise<string | null> {
    if (typeof raw !== 'string' || raw.length === 0) {
      return null;
    }
    try {
      return await resolvePhotoUrl(this.awsService, raw);
    } catch (error) {
      this.logger.warn(
        `No se pudo generar URL prefirmada para ${raw}: ${error}`,
      );
      return null;
    }
  }

  private async mapUserWithPhotoUrl(user: any): Promise<any> {
    if (!user) {
      return user;
    }

    const urlFoto = await this.resolveFotoUrl(user?.url_foto ?? null);

    return {
      ...user,
      urlFoto,
    };
  }

  private async getResponsabilidadIdByNombre(
    nombre: 'Elabora' | 'Revisa' | 'Aprueba' | 'Enterado',
  ): Promise<number> {
    if (this.responsabilidadCache.has(nombre)) {
      return this.responsabilidadCache.get(nombre)!;
    }

    const responsabilidad = await this.prisma.responsabilidad_firma.findFirst({
      where: { nombre },
      select: { id: true },
    });

    if (!responsabilidad) {
      throw new HttpException(
        `Responsabilidad "${nombre}" no configurada`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.responsabilidadCache.set(nombre, responsabilidad.id);
    return responsabilidad.id;
  }

  private async hydrateFirmanteByUserId(
    firmante?: Partial<FirmanteUserDto>,
    rol?: 'Elabora' | 'Revisa' | 'Aprueba' | 'Enterado',
  ): Promise<FirmanteUserDto | undefined> {
    if (!firmante) {
      return undefined;
    }

    const hasFullData =
      Boolean(firmante.nombre) &&
      Boolean(firmante.puesto) &&
      Boolean(firmante.gerencia) &&
      firmante.responsabilidadId !== undefined &&
      firmante.responsabilidadId !== null;

    if (hasFullData) {
      return firmante as FirmanteUserDto;
    }

    if (!firmante.userId) {
      const rolLabel = rol ?? 'desconocido';
      throw new HttpException(
        `Responsable sin userId en rol ${rolLabel}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: firmante.userId },
      select: {
        id: true,
        primer_nombre: true,
        segundo_name: true,
        tercer_nombre: true,
        primer_apellido: true,
        segundo_apellido: true,
        apellido_casada: true,
        posicion: { select: { nombre: true } },
        gerencia: { select: { nombre: true } },
      },
    });

    if (!user) {
      throw new HttpException(
        `Usuario ${firmante.userId} no existe`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const nombre = this.buildFullNameFromUser(user);
    const puesto = user.posicion?.nombre ?? '';
    const gerencia = user.gerencia?.nombre ?? '';

    let responsabilidadId = firmante.responsabilidadId;
    if (
      (responsabilidadId === undefined || responsabilidadId === null) &&
      rol
    ) {
      responsabilidadId = await this.getResponsabilidadIdByNombre(rol);
    }

    if (responsabilidadId === undefined || responsabilidadId === null) {
      const rolLabel = rol ?? 'desconocido';
      throw new HttpException(
        `Responsabilidad "${rolLabel}" no configurada`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      userId: firmante.userId,
      nombre,
      puesto,
      gerencia,
      responsabilidadId,
    };
  }

  private async hydrateResponsables(
    input: ResponsablesFirmaDto,
  ): Promise<ResponsablesFirmaDto> {
    const elabora = await this.hydrateFirmanteByUserId(
      input?.elabora,
      'Elabora',
    );

    const revisaHydrated = await Promise.all(
      (input?.revisa ?? []).map((firmante) =>
        this.hydrateFirmanteByUserId(firmante, 'Revisa'),
      ),
    );

    const apruebaHydrated = await Promise.all(
      (input?.aprueba ?? []).map((firmante) =>
        this.hydrateFirmanteByUserId(firmante, 'Aprueba'),
      ),
    );

    const revisa = revisaHydrated.filter(
      (firmante): firmante is FirmanteUserDto => Boolean(firmante),
    );
    const aprueba = apruebaHydrated.filter(
      (firmante): firmante is FirmanteUserDto => Boolean(firmante),
    );

    this.logger.debug(
      `Hydrated responsables => elabora:${elabora ? 1 : 0}, revisa:${
        revisa.length
      }, aprueba:${aprueba.length}`,
    );

    const result = {} as ResponsablesFirmaDto;
    if (elabora) {
      result.elabora = elabora;
    }
    if (revisa.length > 0) {
      result.revisa = revisa;
    }
    if (aprueba.length > 0) {
      result.aprueba = aprueba;
    }

    return result;
  }

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
      const cuadroFirmaDB =
        await this.cuadroFirmasRepository.findCuadroFirmaById(id);

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

      // ? Notificar responsables
      const createNotificationDto: CreateNotificationDto = {
        titulo: `Actualización Documento de Asignación "${cuadroFirmaDB.titulo}"`,
        contenido: `Se ha actualizado el documento para la asignación "${cuadroFirmaDB.titulo}"`,
        tipo: 'Actualización de documento',
        referenciaId: cuadroFirmaDB?.id ?? 0,
        referenciaTipo: 'Cuadro de firma',
      };

      const createdNotification =
        await this.notificacionesRepository.createNotification(
          createNotificationDto,
        );

      const responsables =
        await this.cuadroFirmasRepository.getUsuariosFirmantesCuadroFirmas(
          cuadroFirmaDB.id,
        );

      for (const responsable of responsables) {
        await this.notificacionesRepository.createUserNotification(
          createdNotification.id,
          responsable.user.id,
        );
        await this.wsService.emitNotificationsToUser(responsable.user.id);
      }

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
    // await this.cuadroFirmasRepository.validarOrdenFirma(firmaCuadroDto);

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
      const observacion = `${firmaCuadroDto.nombreUsuario}, responsable de "${firmaCuadroDto.nombreResponsabilidad}" ha firmado el documento`;
      const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
        cuadroFirmaId: +firmaCuadroDto.cuadroFirmaId,
        estadoFirmaId: 2, // ? En Progreso
        userId: +firmaCuadroDto.userId,
        observaciones: observacion,
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
        },
      );

      const createNotificationDto: CreateNotificationDto = {
        titulo: `Documento firmado`,
        contenido: observacion,
        tipo: 'Firma de documento',
        referenciaId: +firmaCuadroDto.cuadroFirmaId,
        referenciaTipo: 'Cuadro de firma',
        // userId: +firmaCuadroDto.userId,
      };

      const createdNotification =
        await this.notificacionesRepository.createNotification(
          createNotificationDto,
        );

      const responsables =
        await this.cuadroFirmasRepository.getUsuariosFirmantesCuadroFirmas(
          +firmaCuadroDto.cuadroFirmaId,
        );
      for (const responsable of responsables) {
        await this.notificacionesRepository.createUserNotification(
          createdNotification.id,
          responsable.user.id,
        );

        await this.wsService.emitNotificationsToUser(responsable.user.id);
      }

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

  async updateDocumentoByCuadroFirmaId(
    cuadroFirmasId: number,
    data: { [key: string]: any },
  ) {
    try {
      const documento =
        await this.documentosRepository.findByCuadroFirmaID(cuadroFirmasId);

      if (!documento) {
        throw new HttpException(
          `No se encontró un documento asociado al cuadro de firmas ${cuadroFirmasId}.`,
          HttpStatus.NOT_FOUND,
        );
      }

      await this.documentosRepository.updateDocumento(documento!.id, data);

      return {
        status: HttpStatus.ACCEPTED,
        data: true,
      };
    } catch (error) {
      throw new HttpException(
        `Problemas al actualizar docuemtno: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getResumenDocumento(cuadroFirmasId: number) {
    await this.findCuadroFirmaPDF(cuadroFirmasId);
    const documento =
      await this.documentosRepository.findByCuadroFirmaID(cuadroFirmasId);
    return documento?.resumen;
  }

  async extractPDFContent(cuadroFirmasId: number): Promise<string> {
    await this.findCuadroFirmaPDF(cuadroFirmasId);

    const documento =
      await this.documentosRepository.findByCuadroFirmaID(cuadroFirmasId);

    const nombreArchivo = documento?.nombre_archivo ?? null;
    if (!nombreArchivo) {
      throw new HttpException(
        `No se encontró un documento asociado al cuadro de firmas ${cuadroFirmasId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.awsService.getFileBuffer(nombreArchivo);
    } catch (error) {
      this.logger.error(
        `No se pudo obtener el PDF ${nombreArchivo} del almacenamiento: ${error}`,
      );
      throw new HttpException(
        'No se pudo obtener el archivo PDF asociado al cuadro de firmas.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const pdfContent = await this.pdfRepository.extractText(pdfBuffer);
      if (!pdfContent?.trim()) {
        throw new Error('El contenido del PDF está vacío');
      }

      return pdfContent;
    } catch (error) {
      this.logger.error(
        `No se pudo extraer el contenido del PDF para el cuadro de firmas ${cuadroFirmasId}: ${error}`,
      );
      throw new HttpException(
        'No se pudo extraer el contenido del PDF asociado al cuadro de firmas.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getMergedDocuments(cuadroFirmasId: number): Promise<Buffer> {
    const cuadroFirmas = await this.findCuadroFirma(cuadroFirmasId);
    const cuadroFirmasKey = cuadroFirmas?.nombre_pdf ?? null;

    if (!cuadroFirmasKey) {
      this.logger.warn(
        `Cuadro de firmas ${cuadroFirmasId} no tiene PDF asociado en la base de datos`,
      );
      throw new HttpException(
        `No se encontró el PDF del cuadro de firmas ${cuadroFirmasId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const documento =
      await this.documentosRepository.findByCuadroFirmaID(cuadroFirmasId);
    const documentoKey = documento?.nombre_archivo ?? null;

    if (!documentoKey) {
      this.logger.warn(
        `Cuadro de firmas ${cuadroFirmasId} no tiene documento original asociado`,
      );
      throw new HttpException(
        `No se encontró el documento original asociado al cuadro de firmas ${cuadroFirmasId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const minSizeBytes = 1024;

    let documentoBuffer: Buffer;
    try {
      documentoBuffer = await this.awsService.getFileBuffer(
        documentoKey,
        'pdf',
      );
    } catch (error) {
      this.logger.error(
        `No se pudo descargar el documento ${documentoKey} desde el almacenamiento: ${error}`,
      );
      throw new HttpException(
        'No se pudo descargar el documento original desde el almacenamiento.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (documentoBuffer.length <= minSizeBytes) {
      this.logger.warn(
        `El documento original ${documentoKey} parece estar vacío (${documentoBuffer.length} bytes)`,
      );
      throw new HttpException(
        'El documento original parece estar vacío o dañado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let cuadroFirmasBuffer: Buffer;
    try {
      cuadroFirmasBuffer = await this.awsService.getFileBuffer(
        cuadroFirmasKey,
        'pdf',
      );
    } catch (error) {
      this.logger.error(
        `No se pudo descargar el cuadro de firmas ${cuadroFirmasKey} desde el almacenamiento: ${error}`,
      );
      throw new HttpException(
        'No se pudo descargar el cuadro de firmas desde el almacenamiento.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (cuadroFirmasBuffer.length <= minSizeBytes) {
      this.logger.warn(
        `El cuadro de firmas ${cuadroFirmasKey} parece estar vacío (${cuadroFirmasBuffer.length} bytes)`,
      );
      throw new HttpException(
        'El cuadro de firmas parece estar vacío o dañado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.pdfRepository.mergePDFs([
        cuadroFirmasBuffer,
        documentoBuffer,
      ]);
    } catch (error) {
      this.logger.error(
        `No se pudieron unir los PDFs del cuadro de firmas ${cuadroFirmasId}: ${error}`,
      );
      throw new HttpException(
        'No se pudo combinar los archivos PDF solicitados.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    const responsablesHydrated = await this.hydrateResponsables(responsables);
    try {
      const { pdfContent, plantilladId, formattedHtml, fileName } =
        await this.generarCuadroFirmas(
          createCuadroFirmaDto,
          responsablesHydrated,
        );

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
          responsablesHydrated,
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

      const createNotificationDto: CreateNotificationDto = {
        titulo: `Creación de Asignación "${cuadroFirmaDB.titulo}"`,
        contenido: `Se ha creado la asignación para el documento "${cuadroFirmaDB.titulo}"`,
        tipo: 'Firma de documento',
        referenciaId: cuadroFirmaDB?.id ?? 0,
        referenciaTipo: 'Cuadro de firma',
      };

      const createdNotification =
        await this.notificacionesRepository.createNotification(
          createNotificationDto,
        );

      await this.asignarResponsablesCuadroFirmas(
        responsablesHydrated,
        cuadroFirmaDB.id,
        createdNotification.id,
      );

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
    notificacionId?: number,
  ) {
    await this.agregarResponsableCuadroFirma(
      responsables?.elabora!,
      cuadroFirmaID,
    );
    if (notificacionId) {
      await this.notificacionesRepository.createUserNotification(
        notificacionId,
        responsables?.elabora?.userId!,
      );
      await this.wsService.emitNotificationsToUser(
        responsables?.elabora?.userId!,
      );
    }
    if (responsables?.revisa) {
      for (const firmante of responsables.revisa) {
        await this.agregarResponsableCuadroFirma(firmante, cuadroFirmaID);
        if (notificacionId) {
          await this.notificacionesRepository.createUserNotification(
            notificacionId,
            firmante.userId,
          );
          await this.wsService.emitNotificationsToUser(firmante.userId);
        }
      }
    }
    if (responsables?.aprueba) {
      for (const firmante of responsables.aprueba) {
        await this.agregarResponsableCuadroFirma(firmante, cuadroFirmaID);
        if (notificacionId) {
          await this.notificacionesRepository.createUserNotification(
            notificacionId,
            firmante.userId,
          );
          await this.wsService.emitNotificationsToUser(firmante.userId);
        }
      }
    }
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
              url_foto: true,
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
                  url_foto: true,
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
                  url_foto: true,
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

      const creador = await this.mapUserWithPhotoUrl(cuadroFirmaDB.user);

      const historialConFoto = await Promise.all(
        (cuadroFirmaDB.cuadro_firma_estado_historial ?? []).map(
          async (historial) => ({
            ...historial,
            user: await this.mapUserWithPhotoUrl(historial.user),
          }),
        ),
      );

      const firmantesConFoto = await Promise.all(
        (cuadroFirmaDB.cuadro_firma_user ?? []).map(async (firmante) => ({
          ...firmante,
          user: await this.mapUserWithPhotoUrl(firmante.user),
        })),
      );

      return {
        ...cuadroFirmaDB,
        user: creador,
        cuadro_firma_estado_historial: historialConFoto,
        cuadro_firma_user: firmantesConFoto,
      } as CuadroFirmaDB;
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
    titulo: string | null;
  } | null> {
    try {
      const cuadroFirmaPDF = await this.prisma.cuadro_firma.findFirst({
        where: { id },
        select: {
          pdf: true,
          nombre_pdf: true,
          titulo: true,
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
        titulo: cuadroFirmaPDF.titulo,
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
    const responsablesHydrated = await this.hydrateResponsables(responsables);
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
        responsablesHydrated,
      );

      const updatedCuadroFirmas =
        await this.cuadroFirmasRepository.updateCuadroFirmas(
          id,
          updateCuadroFirmaDto,
          responsablesHydrated,
          null,
          +createCuadroFirmaDto.empresa_id,
        );

      const createNotificationDto: CreateNotificationDto = {
        titulo: `Actualización Asignación "${cuadroFirmaDB.titulo}"`,
        contenido: `La asignación ha sido actualizada.`,
        tipo: 'Actualización de cuadro de firmas',
        referenciaId: cuadroFirmaDB?.id ?? 0,
        referenciaTipo: 'Cuadro de firma',
      };

      const createdNotification =
        await this.notificacionesRepository.createNotification(
          createNotificationDto,
        );

      const responsables =
        await this.cuadroFirmasRepository.getUsuariosFirmantesCuadroFirmas(id);
      for (const responsable of responsables) {
        await this.notificacionesRepository.createUserNotification(
          createdNotification.id,
          responsable.user.id,
        );
        await this.wsService.emitNotificationsToUser(responsable.user.id);
      }

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

      const firmantesConFoto = await Promise.all(
        (firmantes ?? []).map(async (firmante) => ({
          ...firmante,
          user: await this.mapUserWithPhotoUrl(firmante.user),
        })),
      );
      return {
        status: HttpStatus.ACCEPTED,
        data: firmantesConFoto,
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
        await this.cuadroFirmasRepository.getHistorialCuadroFirmas(
          id,
          paginationDto,
        );

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
    const cuadroFirmaDB = await this.cuadroFirmasRepository.findCuadroFirmaById(
      updateEstadoAsignacionDto.idCuadroFirma,
    );
    await this.cuadroFirmasRepository.updateEstadoFirma(
      updateEstadoAsignacionDto,
    );

    // TODO: Notificar usuarios

    const contenido = `El documento ha pasado a estado "${updateEstadoAsignacionDto.nombreEstadoFirma}".`;
    const createNotificationDto: CreateNotificationDto = {
      titulo: `Actualización Estado de Asignación "${cuadroFirmaDB.titulo}"`,
      contenido,
      tipo: 'Actualización de estado',
      referenciaId: cuadroFirmaDB?.id ?? 0,
      referenciaTipo: 'Cuadro de firma',
    };

    const createdNotification =
      await this.notificacionesRepository.createNotification(
        createNotificationDto,
      );

    const responsables =
      await this.cuadroFirmasRepository.getUsuariosFirmantesCuadroFirmas(
        cuadroFirmaDB.id,
      );

    for (const responsable of responsables) {
      await this.notificacionesRepository.createUserNotification(
        createdNotification.id,
        responsable.user.id,
      );
      await this.wsService.emitNotificationsToUser(responsable.user.id);
    }

    return {
      status: HttpStatus.ACCEPTED,
      data: 'Estado de asignación actualizado exitosamente',
    };
  }

  private buildWhere(
    search?: string,
    estado?: string,
    estadoId?: number,
  ): Prisma.cuadro_firmaWhereInput {
    return {
      AND: [
        search
          ? {
              OR: [
                { titulo: { contains: search, mode: 'insensitive' } },
                { descripcion: { contains: search, mode: 'insensitive' } },
                { codigo: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        Number.isInteger(estadoId) && (estadoId ?? 0) > 0
          ? { estado_firma_id: estadoId }
          : estado
            ? { estado_firma: { nombre: estado } }
            : {},
      ],
    };
  }

  async listSupervision(q: ListQueryDto) {
    return await this.cuadroFirmasRepository.listSupervision(q);
  }

  async listByUser(userId: number, q: ListQueryDto) {
    this.logger.debug(
      `listByUser filters: estado="${q.estado ?? ''}" estadoId="${
        q.estadoId ?? ''
      }" search="${q.search ?? ''}"`,
    );
    const { page, limit, sort, skip, take } = normalizePagination(q);

    const whereDoc = this.buildWhere(q.search, q.estado, q.estadoId);
    const where: Prisma.cuadro_firmaWhereInput = {
      AND: [whereDoc, { cuadro_firma_user: { some: { user_id: userId } } }],
    };
    const orderBy = stableOrder(sort);

    logPaginationDebug('DocumentsService.listByUser', 'before', {
      page,
      limit,
      sort,
      skip,
      take,
      orderBy,
    });

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.cuadro_firma.count({ where }),
      this.prisma.cuadro_firma.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          estado_firma: true,
          empresa: true,
          cuadro_firma_user: {
            include: { user: true, responsabilidad_firma: true },
          },
        },
      }),
    ]);

    logPaginationDebug('DocumentsService.listByUser', 'after', {
      total,
      count: total,
      firstId: rows[0]?.id ?? null,
      lastId: rows.length > 0 ? (rows[rows.length - 1]?.id ?? null) : null,
      returned: rows.length,
    });

    const asignaciones = await Promise.all(
      rows.map(async (row) => {
        const { cuadro_firma_user = [], ...rest } = row;
        return {
          cuadro_firma: {
            ...rest,
            cuadro_firma_user,
            firmantesResumen: await this.mapFirmantesResumen(cuadro_firma_user),
          },
        };
      }),
    );
    return buildPaginationResult(asignaciones, total, page, limit, sort);
  }

  async statsSupervision(search?: string) {
    const whereBase = this.buildWhere(search);
    const estados = [
      'Pendiente',
      'En Progreso',
      'Rechazado',
      'Completado',
    ] as const;
    const counts = await Promise.all(
      estados.map((estado) =>
        this.prisma.cuadro_firma.count({
          where: { ...whereBase, estado_firma: { nombre: estado } },
        }),
      ),
    );
    const resumen: Record<string, number> = {
      Todos: counts.reduce((acc, current) => acc + current, 0),
    };
    estados.forEach((estado, index) => {
      resumen[estado] = counts[index];
    });
    return { status: HttpStatus.OK, data: resumen };
  }

  async statsByUser(userId: number, search?: string) {
    const whereDoc = this.buildWhere(search);
    const estados = [
      'Pendiente',
      'En Progreso',
      'Rechazado',
      'Completado',
    ] as const;
    const counts = await Promise.all(
      estados.map((estado) =>
        this.prisma.cuadro_firma.count({
          where: {
            AND: [
              whereDoc,
              { estado_firma: { nombre: estado } },
              { cuadro_firma_user: { some: { user_id: userId } } },
            ],
          },
        }),
      ),
    );
    const resumen: Record<string, number> = {
      Todos: counts.reduce((acc, current) => acc + current, 0),
    };
    estados.forEach((estado, index) => {
      resumen[estado] = counts[index];
    });
    return { status: HttpStatus.OK, data: resumen };
  }

  async getNotificationsByUser(
    userId: number,
    pagination: NotificationPaginationDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const since = pagination.since ? new Date(pagination.since) : undefined;

    const { items, total } =
      await this.notificacionesRepository.getNotificationsByUser(userId, {
        pagination: { page, limit },
        since,
      });

    const payload = buildNotificationPayload(items, total, page, limit);
    return {
      status: HttpStatus.OK,
      version: payload.version,
      data: payload.data,
    };
  }
  async updateNotificationByUserId(notificationId: number, userId: number) {
    await this.notificacionesRepository.updateNotification({
      notificationId,
      userId,
    });
    return {
      status: HttpStatus.OK,
      data: true,
    };
  }

  async markNotificationsAsRead(bulkReadDto: NotificationBulkReadDto) {
    const { userId, ids } = bulkReadDto;
    const updated = await this.notificacionesRepository.markNotificationsAsRead(
      userId,
      ids,
    );

    return {
      status: HttpStatus.OK,
      data: { updated },
    };
  }
}
