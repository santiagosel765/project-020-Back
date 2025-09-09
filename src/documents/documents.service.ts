import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PDF_REPOSITORY } from '../pdf/domain/repositories/pdf.repository';
import type { PdfRepository } from '../pdf/domain/repositories/pdf.repository';
import fs from 'fs';
import path from 'path';
import { SignDocumentDto } from './dto/sign-document.dto';
import { PDF_GENERATION_REPOSITORY } from 'src/pdf/domain/repositories/pdf-generation.repository';
import type { PdfGenerationRepository } from 'src/pdf/domain/repositories/pdf-generation.repository';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  cuadro_firma,
  cuadro_firma_estado_historial,
  plantilla,
} from 'generated/prisma';
import {
  CreateCuadroFirmaDto,
  FirmanteUserDto,
} from './dto/create-cuadro-firma.dto';
import { formatCurrentDate } from 'src/helpers/formatDate';
import { AddHistorialCuadroFirmaDto } from './dto/add-historial-cuadro-firma.dto';
import { HttpResponse } from 'src/interfaces/http-response.interfaces';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { UpdateCuadroFirmaDto } from './dto/update-cuadro-firma.dto';
import { filaAprueba, filaRevisa } from './utils/cuadro-firmas.utils';

@Injectable()
export class DocumentsService {
  logger: Logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(PDF_REPOSITORY)
    private readonly pdfRepository: PdfRepository,
    @Inject(PDF_GENERATION_REPOSITORY)
    private readonly pdfGeneratorRepository: PdfGenerationRepository,
    // private readonly aiService: AiService,
    private prisma: PrismaService,
  ) {}

  private handleDBErrors = (error: any, msg: string = '') => {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
    }
    throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
  };

  create(createDocumentDto: CreateDocumentDto) {
    return 'This action adds a new document';
  }

  async signDocumentTest(
    pdfBuffer: Buffer,
    signatureBuffer: Buffer,
  ): Promise<Buffer | null> {
    // ? Placeholder 'FIRMA_DIGITAL' por defecto
    const signedPdfBuffer = await this.pdfRepository.insertSignature(
      pdfBuffer,
      signatureBuffer,
      null as any,
    );
    const timestamp: number = Date.now();
    const timestampString: string = timestamp.toString();
    try {
      const testFolder = path.join(process.cwd(), 'tmp/files');
      if (!fs.existsSync(testFolder))
        fs.mkdirSync(testFolder, { recursive: true });

      if (signedPdfBuffer)
        fs.writeFileSync(`tmp/files/${timestampString}.pdf`, signedPdfBuffer);
    } catch (error) {
      throw new HttpException(
        `Problemas al generar archivo de salida: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return signedPdfBuffer;
  }

  async multipleSignDocumentTest(signDocumentDto: SignDocumentDto) {
    const { signatures, pdfBuffer } = signDocumentDto;

    try {
      const signedPdfBuffer = await this.pdfRepository.insertMultipleSignature(
        pdfBuffer,
        signatures,
        null as any,
      );
      const timestamp: number = Date.now();
      const timestampString: string = timestamp.toString();
      const testFolder = path.join(process.cwd(), 'tmp/files');
      if (!fs.existsSync(testFolder))
        fs.mkdirSync(testFolder, { recursive: true });

      if (signedPdfBuffer)
        fs.writeFileSync(`tmp/files/${timestampString}.pdf`, signedPdfBuffer);
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
      const newPlantilla = await this.prisma.plantilla.create({
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
  ): Promise<{ pdfContent: NonSharedBuffer; plantilladId: number }> {
    const dbPlantilla = await this.prisma.plantilla.findFirst({
      where: {
        empresa_id: createCuadroFirmaDto.empresa_id,
      },
      include: {
        empresa: true,
      },
    });

    if (!dbPlantilla) {
      throw new HttpException(
        `La plantilla de la empresa con ID "${createCuadroFirmaDto.empresa_id}" no existe`,
        HttpStatus.NOT_FOUND,
      );
    }

    const filasApruebaStr = this.generarFilasFirmas(
      createCuadroFirmaDto.responsables?.aprueba,
      'APRUEBA',
      'Aprobado<br>por:'
    );

    const filasRevisaStr = this.generarFilasFirmas(
      createCuadroFirmaDto.responsables?.revisa,
      'REVISA',
      'Revisado<br>por:'
    );

    // ? Las fechas se generan cuando firmen
    const placeholders = {
      '[TITULO]': createCuadroFirmaDto.titulo,
      '[CODIGO]': createCuadroFirmaDto.codigo,
      '[VERSION]': createCuadroFirmaDto.version,
      '[DESCRIPCION]': createCuadroFirmaDto.descripcion,
      '[FECHA]': formatCurrentDate(),
      '[LOGO_URL]': dbPlantilla.empresa.logo || '',
      FIRMANTE_ELABORA: createCuadroFirmaDto.responsables?.elabora?.nombre!,
      PUESTO_ELABORA: createCuadroFirmaDto.responsables?.elabora?.puesto!,
      GERENCIA_ELABORA: createCuadroFirmaDto.responsables?.elabora?.gerencia!,
      FECHA_ELABORA: `FECHA_ELABORA_${createCuadroFirmaDto.responsables?.elabora?.nombre!}`,
      '[FILAS_REVISA]': filasRevisaStr,
      '[FILAS_APRUEBA]': filasApruebaStr,
    };

    try {
      const formattedHtml = this.pdfGeneratorRepository.replacePlaceholders(
        dbPlantilla.plantilla!,
        placeholders,
      );

      // ? Generar pdf - cuadro de firmas
      const pdfPath =
        await this.pdfGeneratorRepository.generatePDFFromHTML(formattedHtml);

      if (!fs.existsSync(pdfPath)) {
        throw new HttpException(
          `Problemas al generar cuadro de firmas en ruta: ${pdfPath}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const pdfContent = fs.readFileSync(pdfPath);

      return {
        pdfContent,
        plantilladId: dbPlantilla.id,
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
  ): Promise<cuadro_firma> {
    try {
      const { pdfContent, plantilladId } =
        await this.generarCuadroFirmas(createCuadroFirmaDto);
      // ? Guardar cuadro de firmas en DB, por defecto inicia en estado "Pendiente"
      const cuadroFirmaDB = await this.prisma.cuadro_firma.create({
        data: {
          titulo: createCuadroFirmaDto.titulo,
          descripcion: createCuadroFirmaDto.descripcion,
          codigo: createCuadroFirmaDto.codigo,
          version: createCuadroFirmaDto.version,
          pdf: pdfContent,
          empresa: { connect: { id: createCuadroFirmaDto.empresa_id } },
          plantilla: { connect: { id: plantilladId } },
          user: { connect: { id: createCuadroFirmaDto.createdBy } },
        },
      });

      if (!cuadroFirmaDB) {
        throw new HttpException(
          `Problemas al generar cuadro de firmas`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // TODO: Create usuarios firmantes
      await this.agregarResponsableCuadroFirma(createCuadroFirmaDto.responsables?.elabora!, cuadroFirmaDB.id);
      createCuadroFirmaDto.responsables?.revisa?.forEach( async (f) => {
        await this.agregarResponsableCuadroFirma(f, cuadroFirmaDB.id);
      });
      createCuadroFirmaDto.responsables?.aprueba?.forEach( async (f) => {
        await this.agregarResponsableCuadroFirma(f, cuadroFirmaDB.id);
      });
      

      return cuadroFirmaDB;
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al generar cuadro de firmas: ${error}`,
      );
    }
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

  async findCuadroFirma(id: number): Promise<cuadro_firma> {
    try {
      const cuadroFirmaDB = await this.prisma.cuadro_firma.findFirst({
        where: { id },
      });

      if (!cuadroFirmaDB) {
        throw new HttpException(
          `Cuadro de firma con ID "${id} no existe"`,
          HttpStatus.NOT_FOUND,
        );
      }

      return cuadroFirmaDB;
    } catch (error) {
      return this.handleDBErrors(
        error,
        `Problemas al obtener cuadro de firma con id "${id}": ${error}`,
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
          updateCuadroFirmaDto.empresa_id ?? cuadroFirmaDB.empresa_id!,
        createdBy: updateCuadroFirmaDto.createdBy ?? cuadroFirmaDB.created_by!,
        responsables: undefined,
      };

      const { pdfContent } =
        await this.generarCuadroFirmas(createCuadroFirmaDto);

      const updatedCuadroFirmas = await this.prisma.cuadro_firma.update({
        where: { id },
        data: {
          ...updateCuadroFirmaDto,
          pdf: pdfContent,
        },
      });

      if (!updatedCuadroFirmas) {
        throw new HttpException(
          `Problemas al actualizar cuadro de firmas con ID "${id}"`,
          HttpStatus.BAD_REQUEST,
        );
      }

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

  private generarFilasFirmas(
    firmantes: FirmanteUserDto[] | undefined,
    tipo: 'APRUEBA' | 'REVISA',
    labelPrimeraFila: string,
  ): string {
    if (!firmantes) return '';

    return firmantes
      .map((f, index) => {
        const rowLabel = index === 0 ? labelPrimeraFila : '';
        return `<tr class="tr-firmas">
        <td class="row-label">${rowLabel}</td>
        <td>FIRMANTE_${tipo}</td>
        <td>PUESTO_${tipo}</td>
        <td>GERENCIA_${tipo}</td>
        <td class="td-firma"></td>
        <td>FECHA_${tipo}_${f.nombre}</td>
      </tr>`
          .replace(`FIRMANTE_${tipo}`, f.nombre)
          .replace(`PUESTO_${tipo}`, f.puesto)
          .replace(`GERENCIA_${tipo}`, f.gerencia);
      })
      .join('');
  }
}
