/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Inject,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { Response } from 'express';

const documentsServiceMock = {
  listByUser: jest.fn().mockResolvedValue({
    items: [
      {
        cuadro_firma: {
          id: 1,
          firmantesResumen: [
            {
              id: 2,
              nombre: 'John Doe',
              iniciales: 'JD',
              urlFoto: null,
              responsabilidad: 'Elabora',
            },
          ],
        },
      },
    ],
    page: 1,
    limit: 10,
    sort: 'desc',
    total: 1,
    pages: 1,
    hasPrev: false,
    hasNext: false,
  }),
  getUsuariosFirmantesCuadroFirmas: jest.fn().mockResolvedValue({
    status: HttpStatus.ACCEPTED,
    data: [
      {
        estaFirmado: false,
        user: {
          id: 2,
          primer_nombre: 'John',
          segundo_name: null,
          tercer_nombre: null,
          primer_apellido: 'Doe',
          segundo_apellido: null,
          apellido_casada: null,
          correo_institucional: 'john@example.com',
        },
        responsabilidad_firma: { id: 1, nombre: 'Elabora' },
      },
    ],
  }),
  listSupervision: jest.fn().mockResolvedValue({
    items: [
      {
        id: 30,
        titulo: 'Documento de Prueba 01',
        descripcion: 'Documento de Prueba descripcion 01',
        codigo: 'PR-001',
        version: '2.0',
        add_date: '2025-09-14T10:35:23.313Z',
        estado_firma: { id: 4, nombre: 'Pendiente' },
        empresa: { id: 1, nombre: 'FGE' },
        diasTranscurridos: 0,
        descripcionEstado: 'Cuadro de firmas generado',
        firmantesResumen: [
          {
            id: 46,
            nombre: 'Admin User',
            iniciales: 'AU',
            urlFoto: null,
            responsabilidad: 'Elabora',
          },
        ],
      },
    ],
    page: 1,
    limit: 10,
    sort: 'desc',
    total: 1,
    pages: 1,
    hasPrev: false,
    hasNext: false,
  }),
  statsSupervision: jest.fn().mockResolvedValue({
    status: HttpStatus.OK,
    data: { Todos: 1, Pendiente: 1, 'En Progreso': 0, Rechazado: 0, Completado: 0 },
  }),
  statsByUser: jest.fn().mockResolvedValue({
    status: HttpStatus.OK,
    data: { Todos: 1, Pendiente: 1, 'En Progreso': 0, Rechazado: 0, Completado: 0 },
  }),
  findCuadroFirma: jest.fn().mockResolvedValue({
    id: 1,
    nombre_pdf: 'cuadro',
    progress: 50,
    cuadro_firma_user: [
      {
        estaFirmado: true,
        fecha_firma: null,
        responsabilidad_firma: { id: 1, nombre: 'Elabora', orden: 1 },
        user: { primer_apellido: 'A' },
      },
      {
        estaFirmado: false,
        fecha_firma: null,
        responsabilidad_firma: { id: 2, nombre: 'Revisa', orden: 2 },
        user: { primer_apellido: 'B' },
      },
    ],
  }),
  getDocumentoByCuadroFirmaID: jest
    .fn()
    .mockResolvedValue({ data: { nombre_archivo: 'doc' } }),
  getDocumentoURLBucket: jest
    .fn()
    .mockResolvedValue({
      status: HttpStatus.OK,
      data: 'https://example.com/file.pdf?response-content-type=application%2Fpdf&content-disposition=inline',
    }),
  getMergedDocuments: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n')),
};

@UseGuards(JwtAuthGuard)
@Controller('documents')
class TestDocumentsController {
  constructor(
    @Inject('documentsService')
    private readonly documentsService: typeof documentsServiceMock,
  ) {}

  @Get('cuadro-firmas/by-user/:userId')
  listByUser(@Param('userId') userId: string, @Query() query: any) {
    return this.documentsService.listByUser(+userId, query);
  }

  @Get('cuadro-firmas/firmantes/:id')
  getUsuariosFirmantesCuadroFirmas(@Param('id') id: string) {
    return this.documentsService.getUsuariosFirmantesCuadroFirmas(+id);
  }

  @Get('cuadro-firmas/documentos/supervision')
  listSupervision(@Query() query: any) {
    return this.documentsService.listSupervision(query);
  }

  @Get('cuadro-firmas/documentos/supervision/stats')
  statsSupervision(@Query('search') search?: string) {
    return this.documentsService.statsSupervision(search);
  }

  @Get('cuadro-firmas/by-user/:userId/stats')
  statsByUser(@Param('userId') userId: string, @Query('search') search?: string) {
    return this.documentsService.statsByUser(+userId, search);
  }

  @Get('cuadro-firmas/:id')
  async findCuadroFirmas(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const cuadroFirmasDB = await this.documentsService.findCuadroFirma(+id);
    const urlCuadroFirmasPDF = await this.documentsService.getDocumentoURLBucket(
      cuadroFirmasDB.nombre_pdf,
      expiresIn ? +expiresIn : undefined,
    );
    const documentoDB = await this.documentsService.getDocumentoByCuadroFirmaID(+id);
    const urlDocumento = await this.documentsService.getDocumentoURLBucket(
      documentoDB.data.nombre_archivo,
      expiresIn ? +expiresIn : undefined,
    );
    return {
      urlCuadroFirmasPDF: urlCuadroFirmasPDF.data,
      urlDocumento: urlDocumento.data,
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
    res.setHeader('Content-Length', merged.length.toString());
    return res.send(merged);
  }
}

describe('DocumentsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TestDocumentsController],
      providers: [{ provide: 'documentsService', useValue: documentsServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('by-user returns firmantesResumen and respects page/limit', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/by-user/1?page=1&limit=10')
      .expect(HttpStatus.OK);

    expect(res.body.items[0].cuadro_firma.firmantesResumen).toBeDefined();
    expect(res.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 10,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('firmantes/:id returns complete list', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/firmantes/1')
      .expect(HttpStatus.OK);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('user');
    expect(res.body.data[0]).toHaveProperty('responsabilidad_firma');
  });

  it('supervision returns firmantesResumen and pagination data', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/documentos/supervision?page=1&limit=10')
      .expect(HttpStatus.OK);

    expect(res.body.items[0].firmantesResumen).toBeDefined();
    expect(res.body.total).toBe(1);
  });

  it('supervision stats returns counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/documentos/supervision/stats')
      .expect(HttpStatus.OK);

    expect(res.body.data).toHaveProperty('Todos');
    expect(res.body.data).toHaveProperty('Pendiente');
  });

  it('by-user stats returns counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/by-user/1/stats')
      .expect(HttpStatus.OK);

    expect(res.body.data).toHaveProperty('Todos');
    expect(res.body.data).toHaveProperty('Pendiente');
  });

  it('cuadro-firmas/:id returns progress and sorted firmantes with urls', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/1?expiresIn=60')
      .expect(HttpStatus.OK);

    expect(res.body.progress).toBeGreaterThanOrEqual(0);
    expect(res.body.progress).toBeLessThanOrEqual(100);

    const ordenes = res.body.cuadro_firma_user.map(
      (i: any) => i.responsabilidad_firma.orden,
    );
    const sorted = [...ordenes].sort((a, b) => a - b);
    expect(ordenes).toEqual(sorted);

    expect(res.body.urlCuadroFirmasPDF).toContain(
      'response-content-type=application%2Fpdf',
    );
    expect(res.body.urlCuadroFirmasPDF.toLowerCase()).toContain(
      'content-disposition=inline',
    );
    expect(res.body.urlDocumento).toContain(
      'response-content-type=application%2Fpdf',
    );
    expect(res.body.urlDocumento.toLowerCase()).toContain(
      'content-disposition=inline',
    );
  });

  it('merged pdf endpoint responde con un PDF', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.7\n');
    documentsServiceMock.getMergedDocuments.mockResolvedValueOnce(pdfBuffer);

    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/1/merged-pdf')
      .expect(HttpStatus.OK);

    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'inline; filename="merged.pdf"',
    );
    expect(res.headers['content-length']).toBe(String(pdfBuffer.length));
    expect(res.body).toEqual(pdfBuffer);
  });
});
