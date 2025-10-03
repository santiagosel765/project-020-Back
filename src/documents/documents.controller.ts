import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Delete,
  Request as NestRequest,
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
import { AiService } from 'src/ai/ai.service';
import type { Request, Response } from 'express';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  NotificationBulkReadDto,
  NotificationListResponseDto,
  NotificationPaginationDto,
} from './dto/notification-response.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  logger: Logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly awsService: AWSService,
    private readonly aiService: AiService,
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

    return this.documentsService.signDocument(firmaCuadroDto, signatureBuffer);
  }

  @Patch('cuadro-firmas/documento/:id')
  @UseInterceptors(FilesInterceptor('file', 1))
  updateDocumentoAsignacion(
    @UploadedFiles() files: Express.Multer.File[],
    @Param('id') id: string,
    @Body('idUser') idUser: string,
    @Body('observaciones') observaciones: string,
  ) {
    const [pdfDocument] = files;
    return this.documentsService.updateDocumentoAsignacion(
      +id,
      +idUser,
      observaciones,
      pdfDocument.buffer,
    );
  }

  @Post('analyze-pdf-test')
  @UseInterceptors(FilesInterceptor('files', 1))
  analyzePDFTest(@UploadedFiles() files: Express.Multer.File[]) {
    return this.documentsService.analyzePDFTest(files[0].buffer);
  }

  @Post('analyze-pdf/:cuadroFirmasId')
  async analyzePDF(
    @Param('cuadroFirmasId', ParseIntPipe) cuadroFirmasId: number,
    @Res() res: Response,
  ) {
    try {
      const resumenDB =
        await this.documentsService.getResumenDocumento(cuadroFirmasId);

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.status(HttpStatus.OK);
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      if (resumenDB && resumenDB.trim() !== '') {
        res.write(resumenDB);
        res.end();
        return;
      }

      const pdfContent =
        await this.documentsService.extractPDFContent(cuadroFirmasId);

      let stream: AsyncIterable<any>;
      try {
        stream = await this.aiService.summarizePDF(pdfContent);
      } catch (iaError) {
        const iaMessage =
          iaError instanceof Error ? iaError.message : `${iaError}`;
        this.logger.error(
          `No se pudo iniciar el resumen con IA para cuadro de firmas ${cuadroFirmasId}: ${iaMessage}`,
        );
        throw new HttpException(
          'No se pudo generar el resumen con IA.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      let fullResponse = '';
      for await (const event of stream) {
        if (event?.type === 'response.output_text.delta') {
          const chunk: string = event.delta ?? '';
          if (chunk) {
            fullResponse += chunk;
            res.write(chunk);
          }
        } else if (event?.type === 'response.refusal.delta') {
          throw new HttpException(
            'El modelo rechazó generar el resumen solicitado.',
            HttpStatus.BAD_GATEWAY,
          );
        } else if (event?.type === 'response.error') {
          const message =
            event.error?.message ?? 'No se pudo generar el resumen con IA.';
          throw new HttpException(message, HttpStatus.BAD_GATEWAY);
        }
      }

      await this.documentsService.updateDocumentoByCuadroFirmaId(
        cuadroFirmasId,
        { resumen: fullResponse },
      );
      res.end();
    } catch (error) {
      const errorMessage =
        error instanceof HttpException
          ? JSON.stringify(error.getResponse())
          : error instanceof Error
            ? error.message
            : `${error}`;
      this.logger.error(
        `Error al resumir PDF del cuadro de firmas ${cuadroFirmasId}: ${errorMessage}`,
      );

      if (res.headersSent) {
        res.write('\n\n**[Error]** No se pudo completar el resumen.\n');
        res.end();
        return;
      }

      if (error instanceof HttpException) {
        const status = error.getStatus();
        const responseBody = error.getResponse();
        res
          .status(status)
          .json(
            typeof responseBody === 'string'
              ? { message: responseBody }
              : responseBody,
          );
        return;
      }

      res
        .status(HttpStatus.BAD_GATEWAY)
        .json({ message: 'No se pudo generar el resumen.' });
    }
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
    const cuadroFirmasDB = await this.documentsService.findCuadroFirma(+id);
    const urlCuadroFirmasPDF =
      await this.documentsService.getDocumentoURLBucket(
        cuadroFirmasDB.nombre_pdf,
      );
    const documentoDB =
      await this.documentsService.getDocumentoByCuadroFirmaID(+id);
    const urlDocumento = await this.documentsService.getDocumentoURLBucket(
      documentoDB.data.nombre_archivo,
    );
    return {
      urlCuadroFirmasPDF: urlCuadroFirmasPDF.data.data,
      urlDocumento: urlDocumento.data.data,
      ...cuadroFirmasDB,
    };
  }

  @Get('cuadro-firmas/:id/merged-pdf')
  async getMergedPDF(
    @Param('id', ParseIntPipe) id: number,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const merged = await this.documentsService.getMergedDocuments(id);
    res.setHeader('Content-Type', 'application/pdf');
    const isDownload = download === '1' || download === 'true';
    res.setHeader(
      'Content-Disposition',
      isDownload
        ? 'attachment; filename="documento-firmas.pdf"'
        : 'inline; filename="merged.pdf"',
    );
    if (typeof merged?.length === 'number') {
      res.setHeader('Content-Length', merged.length.toString());
    }
    return res.send(merged);
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
  getUsuariosFirmantesCuadroFirmas(@Param('id') id: string) {
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
      updateEstadoAsignacionDto,
    );
  }

  @Patch('cuadro-firmas/notificaciones/leer')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiOkResponse({
    schema: {
      properties: {
        status: { type: 'number', example: 200 },
        data: { type: 'boolean' },
      },
    },
  })
  updateNotificationByUserId(
    @Body('userId', ParseIntPipe) userId: number,
    @Body('notificationId', ParseIntPipe) notificationId: number,
  ) {
    return this.documentsService.updateNotificationByUserId(
      notificationId,
      userId,
    );
  }

  @Patch('cuadro-firmas/notificaciones/leer-todas')
  @ApiOperation({ summary: 'Marcar notificaciones como leídas' })
  @ApiBody({ type: NotificationBulkReadDto })
  @ApiOkResponse({
    schema: {
      properties: {
        status: { type: 'number', example: 200 },
        data: {
          type: 'object',
          properties: {
            updated: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  markNotificationsAsRead(@Body() bulkReadDto: NotificationBulkReadDto) {
    return this.documentsService.markNotificationsAsRead(bulkReadDto);
  }

  @Get('cuadro-firmas/notificaciones/:userId')
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  getNotificationsByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: NotificationPaginationDto,
  ) {
    return this.documentsService.getNotificationsByUser(userId, pagination);
  }
  @Patch('cuadro-firmas/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateCuadroFirmas(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCuadroFirmaDto: UpdateCuadroFirmaDto,
    @Body('responsables', JsonParsePipe) responsables: ResponsablesFirmaDto,
    @Req() req: Request & { user?: { id?: number; sub?: number } },
  ) {
    const userIdFromJwt = req.user?.id ?? req.user?.sub;
    const userId = updateCuadroFirmaDto.idUser ?? userIdFromJwt;

    if (userId === undefined || userId === null) {
      throw new BadRequestException('Usuario requerido para historial');
    }

    const numericUserId = Number(userId);

    if (!Number.isFinite(numericUserId)) {
      throw new BadRequestException('Usuario requerido para historial');
    }

    return this.documentsService.updateCuadroFirmas(
      id,
      updateCuadroFirmaDto,
      responsables,
      numericUserId,
    );
  }

  @Post('ai/chat/start/:cuadroFirmaId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async startChatWithDocument(
    @Param('cuadroFirmaId', ParseIntPipe) cuadroFirmaId: number,
    @NestRequest() req,
  ) {
    const userId = req.user.sub;
    return await this.documentsService.startChatWithDocument(
      userId,
      cuadroFirmaId,
    );
  }

  @Post('ai/chat/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async chatWithDocument(
    @Param('sessionId') sessionId: string,
    @Body() { message }: { message: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.status(HttpStatus.OK);
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const stream = await this.documentsService.chatWithDocument(
      sessionId,
      message,
    );

    let assistantResponse = '';
    for await (const chunk of stream) {
      const safeChunk = chunk as { delta?: string };
      const piece = safeChunk.delta ?? '';
      assistantResponse += piece;
      res.write(piece);
    }

    // Actualizar la sesión con la respuesta completa
    await this.documentsService.updateChatSessionWithResponse(
      sessionId,
      assistantResponse,
    );

    res.end();
  }

  @Get('ai/chat/sessions/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getUserSessions(@Param('userId', ParseIntPipe) userId: number) {
    return this.documentsService.getUserChatSessions(userId);
  }

  @Delete('ai/chat/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteSession(@Param('sessionId') sessionId: string) {
    const deleted = this.documentsService.deleteChatSession(sessionId);
    return { deleted };
  }
}
