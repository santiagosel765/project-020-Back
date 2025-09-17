import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  HttpStatus,
  Logger,
  HttpException,
  Query,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import {
  CreateCuadroFirmaDto,
  ResponsablesFirmaDto,
} from './dto/create-cuadro-firma.dto';
import { AddHistorialCuadroFirmaDto } from './dto/add-historial-cuadro-firma.dto';
import { UpdateCuadroFirmaDto } from './dto/update-cuadro-firma.dto';
import { FirmaCuadroDto } from './dto/firma-cuadro.dto';
import { JsonParsePipe } from 'src/common/json-pipe/json-pipe.pipe';
import { UpdateEstadoAsignacionDto } from './dto/update-estado-asignacion.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { AWSService } from 'src/aws/aws.service';
import { envs } from 'src/config/envs';

@Controller('documents')
export class DocumentsController {
  logger: Logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly awsService: AWSService,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('file', 1))
  create(
    @UploadedFiles() file: Express.Multer.File[],
    @Body() createDocumentDto: CreateDocumentDto,
  ) {
    const [pdfDocument] = file;
    return this.documentsService.guardarDocumento(pdfDocument.buffer);
  }

  @Post('cuadro-firmas/firmar')
  @UseInterceptors(FileInterceptor('file'))
  async signDocumentTest(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() firmaCuadroDto: FirmaCuadroDto,
  ) {
    let signatureBuffer: Buffer | null = null;

    if (file?.buffer?.length) {
      signatureBuffer = file.buffer;
    } else {
      const prefix = envs?.bucketSignaturesPrefix ?? 'signatures';
      const key = `${prefix}/${firmaCuadroDto.userId}/current.png`;

      try {
        signatureBuffer = await this.awsService.getFileBuffer(key);
      } catch (error) {
        signatureBuffer = null;
      }
    }

    if (!signatureBuffer) {
      throw new HttpException(
        'No se encontró la firma. Adjunta un archivo o sube tu firma en tu perfil.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.documentsService.signDocument(
      firmaCuadroDto,
      signatureBuffer,
    );
  }

  @Patch('cuadro-firmas/documento/:id')
  @UseInterceptors(FilesInterceptor('file', 1))
  updateDocumentoAsignacion(
    @UploadedFiles() files: Express.Multer.File[],
    @Param("id") id: string,
    @Body('idUser') idUser: string, 
    @Body('observaciones') observaciones: string, 
  ) {
    const [pdfDocument] = files;
    return this.documentsService.updateDocumentoAsignacion(
      +id,
      +idUser,
      observaciones,
      pdfDocument.buffer
    );
  }

  @Post('analyze-pdf-test')
  @UseInterceptors(FilesInterceptor('files', 1))
  analyzePDFTest(@UploadedFiles() files: Express.Multer.File[]) {
    return this.documentsService.analyzePDFTest(files[0].buffer);
  }

  @Post('plantilla')
  generarPlantilla(@Body() createPlantillaDto: CreatePlantillaDto) {
    return this.documentsService.generarPlantilla(createPlantillaDto);
  }

  @Get('cuadro-firmas/documento-url')
  async getDocumentoURLBucket(@Query('fileName') fileName: string) {
    return this.documentsService.getDocumentoURLBucket(fileName);
  }

  @Get('cuadro-firmas/:id')
  async findCuadroFirmas(@Param('id') id: string) {
    const cuadroFirmasDB = await this.documentsService.findCuadroFirma(+id)
    const urlCuadroFirmasPDF = await this.documentsService.getDocumentoURLBucket(cuadroFirmasDB.nombre_pdf)
    const documentoDB = await this.documentsService.getDocumentoByCuadroFirmaID(+id);
    const urlDocumento = await this.documentsService.getDocumentoURLBucket(documentoDB.data.nombre_archivo)
    return {
      urlCuadroFirmasPDF: urlCuadroFirmasPDF.data.data,
      urlDocumento: urlDocumento.data.data,
      ...cuadroFirmasDB,
      
    };
  }

  @Post('cuadro-firmas')
  @UseInterceptors(FilesInterceptor('file', 1))
  async guardarCuadroFirmas(
    @UploadedFiles() file: Express.Multer.File[],
    @Body('responsables', JsonParsePipe) responsables: ResponsablesFirmaDto,
    @Body() createCuadroFirmaDto: CreateCuadroFirmaDto,
  ) {
    console.log({ responsables });
    const [documentoPDF] = file;
    // return createCuadroFirmaDto;
    const cuadroFirmaDB = await this.documentsService.guardarCuadroFirmas(
      createCuadroFirmaDto,
      responsables,
      documentoPDF.buffer,
    );

    if (!cuadroFirmaDB) {
      throw new HttpException(
        `Problemas al generar cuadro de firmas`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
      cuadroFirmaId: cuadroFirmaDB.id,
      estadoFirmaId: 4,
      userId: +createCuadroFirmaDto.createdBy,
      observaciones: 'Cuadro de firmas generado',
    };

    const registroHistorialDB = await this.agregarHistorialCuadroFirma(
      addHistorialCuadroFirmaDto,
    );

    if (!registroHistorialDB) {
      this.logger.error(
        `Problemas al crear registro en historial para cuadro de firmas con ID "${cuadroFirmaDB.id}"`,
      );
    }

    return {
      status: HttpStatus.CREATED,
      data: 'Cuadro de firmas generado exitosamente',
    };
  }

  @Post('cuadro-firmas/historial')
  async agregarHistorialCuadroFirma(
    @Body() addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto,
  ) {
    const registroHistorialDB =
      await this.documentsService.agregarHistorialCuadroFirma(
        addHistorialCuadroFirmaDto,
      );

    return {
      status: HttpStatus.CREATED,
      data: {
        registro: registroHistorialDB,
      },
    };
  }

  @Get('estados-firma')
  getAllEstadosFirma() {
    return this.documentsService.getAllEstadosFirma();
  }
  
  @Get('cuadro-firmas/historial/:id')
  getHistorialCuadroFirmas(
    @Param('id') id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.documentsService.getHistorialCuadroFirmas(+id, paginationDto);
  }
  

  @Get('cuadro-firmas/firmantes/:id')
  getUsuariosFirmantesCuadroFirmas(
    @Param('id') id: string
  ) {
    return this.documentsService.getUsuariosFirmantesCuadroFirmas(+id);
  }
  
  @Get('cuadro-firmas/documentos/supervision')
  async listSupervision(@Query() q: ListQueryDto) {
    return this.documentsService.listSupervision(q);
  }

  @Get('cuadro-firmas/by-user/:userId')
  async listByUser(@Param('userId') userId: string, @Query() q: ListQueryDto) {
    return this.documentsService.listByUser(Number(userId), q);
  }

  @Get('cuadro-firmas/documentos/supervision/stats')
  async stats(@Query() q: Pick<ListQueryDto, 'search'>) {
    return this.documentsService.statsSupervision(q.search);
  }

  @Get('cuadro-firmas/by-user/:userId/stats')
  async statsByUser(
    @Param('userId') userId: string,
    @Query() q: Pick<ListQueryDto, 'search'>,
  ) {
    return this.documentsService.statsByUser(Number(userId), q.search);
  }
  
  
  @Patch('cuadro-firmas/estado')
  cambiarEstadoAsignacion(
    @Body() updateEstadoAsignacionDto: UpdateEstadoAsignacionDto,
    
  ) {
    return this.documentsService.updateEstadoAsignacion(
      updateEstadoAsignacionDto
    );
  }
  
  @Patch('cuadro-firmas/:id')
  updateCuadroFirmas(
    @Param('id') id: string,
    @Body() updateCuadroFirmaDto: UpdateCuadroFirmaDto,
    @Body('responsables', JsonParsePipe) responsables: ResponsablesFirmaDto,
  ) {
    return this.documentsService.updateCuadroFirmas(
      +id,
      updateCuadroFirmaDto,
      responsables,
    );
  }

}
