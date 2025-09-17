import { cuadro_firma, cuadro_firma_estado_historial } from 'generated/prisma';
import { AddHistorialCuadroFirmaDto } from 'src/documents/dto/add-historial-cuadro-firma.dto';
import {
  CreateCuadroFirmaDto,
  ResponsablesFirmaDto,
} from 'src/documents/dto/create-cuadro-firma.dto';
import { UpdateCuadroFirmaDto } from 'src/documents/dto/update-cuadro-firma.dto';
import {
  Asignacion,
  DocumentoCuadroFirma,
  GenerarCuadroFirmasResult,
  HistorialCuadroFirma,
  UpdateCuadroFirmasResult,
  UsuarioFirmanteCuadroFirma,
} from '../interfaces/cuadro-firmas.interface';
import { UpdateEstadoAsignacionDto } from 'src/documents/dto/update-estado-asignacion.dto';
import { FirmaCuadroDto } from 'src/documents/dto/firma-cuadro.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PaginationMetaData } from '../interfaces/pagination.itnerface';

export const CUADRO_FIRMAS_REPOSITORY = 'CUADRO_FIRMAS_REPOSITORY';

export abstract class CuadroFirmaRepository {
  abstract generarCuadroFirmas(
    createCuadroFirmaDto: CreateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
  ): Promise<GenerarCuadroFirmasResult>;

  abstract guardarCuadroFirmas(
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
  ): Promise<cuadro_firma>;

  abstract actualizarResponsablesCuadroFirma(
    responsables: ResponsablesFirmaDto,
    cuadroFirmaId: number,
  ): Promise<void>;

  abstract updateCuadroFirmas(
    id: number,
    updateCuadroFirmaDto: UpdateCuadroFirmaDto,
    responsables: ResponsablesFirmaDto,
    pdfContent: Buffer | null,
    empresaId: number,
  ): Promise<UpdateCuadroFirmasResult>;

  abstract getDocumentoByCuadroFirmaID(
    id: number,
  ): Promise<DocumentoCuadroFirma>;

  abstract getUsuariosFirmantesCuadroFirmas(
    id: number,
  ): Promise<UsuarioFirmanteCuadroFirma[]>;

  abstract getHistorialCuadroFirmas(
    id: number,
    paginationDto: PaginationDto
  ): Promise<{ historial: HistorialCuadroFirma[], meta: PaginationMetaData}>;

  abstract agregarHistorialCuadroFirma(
    addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto,
  ): Promise<cuadro_firma_estado_historial>;

  abstract updateEstadoFirma(
    updateEstadoAsignacion: UpdateEstadoAsignacionDto,
  ): Promise<any>;

  abstract getAsignacionesByUserId(userId: number, paginationDto: PaginationDto): Promise<{ asignaciones: Asignacion[], meta: PaginationMetaData}>;
  abstract getSupervisionDocumentos(paginationDto: PaginationDto): Promise<{ documentos: any[], meta: PaginationMetaData}>;

  abstract validarOrdenFirma(firmaCuadroDto: FirmaCuadroDto): Promise<void>;

  abstract updateCuadroFirmaUser(
    keys: {
      cuadroFirmaId: number;
      userId: number;
      responsabilidadId: number;
    },
    data: {
      [key: string]: any;
    },
  ): Promise<void>;
}
