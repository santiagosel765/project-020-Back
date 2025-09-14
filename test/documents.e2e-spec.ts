/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Param, Query, UseGuards, HttpStatus, Inject } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

const documentsServiceMock = {
  getAsignacionesByUserId: jest.fn().mockResolvedValue({
    status: HttpStatus.OK,
    data: {
      asignaciones: [
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
      meta: {
        totalCount: 1,
        page: 1,
        limit: 10,
        lastPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    },
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
  getSupervisionDocumentos: jest.fn().mockResolvedValue({
    status: HttpStatus.OK,
    data: {
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
      total: 1,
      page: 1,
      limit: 10,
    },
  }),
  getSupervisionStats: jest.fn().mockResolvedValue({
    status: HttpStatus.OK,
    data: { total: 1, pendiente: 1, enProgreso: 0, rechazado: 0, completado: 0 },
  }),
};

@UseGuards(JwtAuthGuard)
@Controller('documents')
class TestDocumentsController {
  constructor(
    @Inject('documentsService')
    private readonly documentsService: typeof documentsServiceMock,
  ) {}

  @Get('cuadro-firmas/by-user/:userId')
  getAsignacionesByUserId(@Param('userId') userId: string, @Query() query: any) {
    return this.documentsService.getAsignacionesByUserId(+userId, query);
  }

  @Get('cuadro-firmas/firmantes/:id')
  getUsuariosFirmantesCuadroFirmas(@Param('id') id: string) {
    return this.documentsService.getUsuariosFirmantesCuadroFirmas(+id);
  }

  @Get('cuadro-firmas/documentos/supervision')
  getSupervision(@Query() query: any) {
    return this.documentsService.getSupervisionDocumentos(query);
  }

  @Get('cuadro-firmas/documentos/supervision/stats')
  getSupervisionStats() {
    return this.documentsService.getSupervisionStats();
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

    expect(
      res.body.data.asignaciones[0].cuadro_firma.firmantesResumen,
    ).toBeDefined();
    expect(res.body.data.meta).toEqual({
      totalCount: 1,
      page: 1,
      limit: 10,
      lastPage: 1,
      hasNextPage: false,
      hasPrevPage: false,
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

    expect(res.body.data.items[0].firmantesResumen).toBeDefined();
    expect(res.body.data.total).toBe(1);
  });

  it('supervision stats returns counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/documents/cuadro-firmas/documentos/supervision/stats')
      .expect(HttpStatus.OK);

    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('pendiente');
  });
});
