import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseInterceptors,
  UploadedFiles,
  HttpStatus,
  Logger,
  HttpException,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import {
  FilesInterceptor,
} from '@nestjs/platform-express';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { CreateCuadroFirmaDto, ResponsablesFirmaDto } from './dto/create-cuadro-firma.dto';
import { AddHistorialCuadroFirmaDto } from './dto/add-historial-cuadro-firma.dto';
import { UpdateCuadroFirmaDto } from './dto/update-cuadro-firma.dto';
import { FirmaCuadroDto } from './dto/firma-cuadro.dto';
import { UpdateEstadoAsignacionDto } from './dto/update-estado-asignacion.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponsablesNormalizerPipe } from './pipes/responsables-normalizer.pipe';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  logger: Logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

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
  @UseInterceptors(FilesInterceptor('file', 1))
  signDocument(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() firmaCuadroDto: FirmaCuadroDto,
    @Req() req: any,
  ) {
    if (req?.user?.sub !== +firmaCuadroDto.userId) {
      throw new HttpException('Usuario no autorizado', HttpStatus.FORBIDDEN);
    }
    const [signatureFile] = files;
    return this.documentsService.signDocument(
      firmaCuadroDto,
      signatureFile.buffer,
    );
  }

  @Patch('cuadro-firmas/documento/:id')
  @UseInterceptors(FilesInterceptor('file', 1))
  updateDocumentoAsignacion(
    @UploadedFiles() files: Express.Multer.File[],
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('observaciones') observaciones: string,
  ) {
    const [pdfDocument] = files;
    return this.documentsService.updateDocumentoAsignacion(
      +id,
      +userId,
      observaciones,
      pdfDocument.buffer,
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
  async findCuadroFirmas(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const cuadroFirmasDB = await this.documentsService.findCuadroFirma(+id);
    const exp = expiresIn ? +expiresIn : undefined;
    const urlCuadroFirmasPDF = await this.documentsService.getDocumentoURLBucket(
      cuadroFirmasDB.nombre_pdf,
      exp,
    );
    const documentoDB = await this.documentsService.getDocumentoByCuadroFirmaID(+id);
    const urlDocumento = await this.documentsService.getDocumentoURLBucket(
      documentoDB.data.nombre_archivo,
      exp,
    );
    return {
      urlCuadroFirmasPDF: urlCuadroFirmasPDF.data,
      urlDocumento: urlDocumento.data,
      ...cuadroFirmasDB,
    };
  }

  @Post('cuadro-firmas')
  @UseInterceptors(FilesInterceptor('file', 1))
  async guardarCuadroFirmas(
    @UploadedFiles() file: Express.Multer.File[],
    @Body('responsables', ResponsablesNormalizerPipe)
    responsables: ResponsablesFirmaDto,
    @Body() createCuadroFirmaDto: CreateCuadroFirmaDto,
  ) {
    const [documentoPDF] = file;

    const cuadroFirma = await this.documentsService.guardarCuadroFirmas(
      createCuadroFirmaDto,
      responsables,
      documentoPDF.buffer,
    );

    const addHistorialCuadroFirmaDto: AddHistorialCuadroFirmaDto = {
      cuadroFirmaId: cuadroFirma.id,
      estadoFirmaId: 4,
      userId: +createCuadroFirmaDto.createdBy,
      observaciones: 'Cuadro de firmas generado',
    };

    const registroHistorialDB = await this.agregarHistorialCuadroFirma(
      addHistorialCuadroFirmaDto,
    );

    if (!registroHistorialDB) {
      this.logger.error(
        `Problemas al crear registro en historial para cuadro de firmas con ID "${cuadroFirma.id}"`,
      );
    }

    return cuadroFirma;
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
  
  @Get('cuadro-firmas/by-user/:userId')
  getAsignacionesByUserId(
    @Param('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.documentsService.getAsignacionesByUserId(+userId, paginationDto);
  }
  

  @Get('cuadro-firmas/documentos/supervision')
  getSueprvisionDocumentos(
    @Query() paginationDto: PaginationDto,
  ) {
    return this.documentsService.getSupervisionDocumentos(paginationDto);
  }

  @Get('cuadro-firmas/documentos/supervision/stats')
  getSupervisionStats() {
    return this.documentsService.getSupervisionStats();
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
    @Body('responsables', ResponsablesNormalizerPipe)
    responsables: ResponsablesFirmaDto,
  ) {
    return this.documentsService.updateCuadroFirmas(
      +id,
      updateCuadroFirmaDto,
      responsables,
    );
  }

}
