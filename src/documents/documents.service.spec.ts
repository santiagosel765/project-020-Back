jest.mock('src/config/envs', () => ({
  envs: {
    port: 0,
    apiPrefix: '',
    corsOrigin: [],
    nodeEnv: 'test',
    databaseUrl: 'test',
    jwtAccessSecret: 'secret',
    jwtRefreshSecret: 'secret',
    jwtAccessExpiration: 0,
    jwtRefreshExpiration: 0,
    bucketRegion: '',
    bucketName: '',
    bucketPrefix: '',
    bucketSignaturesPrefix: '',
    bucketAccessKeyID: '',
    bucketSecretKey: '',
    openAiAPIKey: '',
    openAiModel: '',
  },
}));

jest.mock('src/aws/aws.service', () => ({
  AWSService: class {},
}));

import { BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FirmaCuadroDto } from './dto/firma-cuadro.dto';
import {
  type PdfRepository,
  type TextAnchorFill,
} from '../pdf/domain/repositories/pdf.repository';

const createService = () => {
  const pdfRepository: jest.Mocked<PdfRepository> = {
    insertSignature: jest.fn(),
    insertMultipleSignature: jest.fn(),
    extractText: jest.fn(),
    fillTextAnchors: jest.fn(),
    fillRelativeToAnchor: jest.fn(),
    fillRowByColumns: jest.fn(),
    locateSignatureTableColumns: jest.fn(),
  } as unknown as jest.Mocked<PdfRepository>;

  const prisma = {
    cuadro_firma: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ nombre_pdf: 'test.pdf', pdf: null }),
      findUnique: jest.fn().mockResolvedValue({
        estado_firma: { nombre: 'En Progreso' },
        estado_firma_id: 2,
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    cuadro_firma_user: {
      count: jest.fn().mockResolvedValue(1),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        primer_nombre: 'Juan',
        primer_apellido: 'Perez',
        posicion: { nombre: 'Analista' },
        gerencia: { nombre: 'Tecnología' },
      }),
    },
  } as any;

  const cuadroFirmasRepository = {
    validarOrdenFirma: jest.fn().mockResolvedValue(undefined),
    updateCuadroFirmaUser: jest.fn().mockResolvedValue(undefined),
    agregarHistorialCuadroFirma: jest.fn().mockResolvedValue({} as any),
  } as any;

  const documentosRepository = {} as any;
  const pdfGeneratorRepository = {} as any;

  const pdfBaseBuffer = Buffer.from('PDF_BASE');
  const awsService = {
    getFileBuffer: jest.fn().mockResolvedValue(pdfBaseBuffer),
    uploadFile: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new DocumentsService(
    cuadroFirmasRepository,
    documentosRepository,
    pdfRepository,
    pdfGeneratorRepository,
    prisma,
    awsService,
  );

  return {
    service,
    pdfRepository,
    prisma,
    awsService,
    cuadroFirmasRepository,
    pdfBaseBuffer,
  };
};

const baseDto: FirmaCuadroDto = {
  userId: '1',
  nombreUsuario: 'Juan Perez',
  cuadroFirmaId: '10',
  responsabilidadId: '5',
  nombreResponsabilidad: 'Elabora',
  useStoredSignature: false,
};

describe('DocumentsService.signDocument', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('usa anchors de texto cuando existen todos los tokens', async () => {
    const { service, pdfRepository, awsService } = createService();
    const resolved = 'FECHA_ELABORA_ELABORA_TEST';

    jest
      .spyOn<any, any>(service as any, 'resolvePlaceholderInPdf')
      .mockResolvedValue({
        resolved,
        primary: resolved,
        candidates: [resolved],
      });

    pdfRepository.extractText.mockResolvedValue(
      [
        'NOMBRE_ELABORA_ELABORA_TEST',
        'PUESTO_ELABORA_ELABORA_TEST',
        'GERENCIA_ELABORA_ELABORA_TEST',
        resolved,
      ].join(' '),
    );

    const textBuffer = Buffer.from('with-text');
    pdfRepository.fillTextAnchors.mockResolvedValue(textBuffer);

    const signedBuffer = Buffer.from('signed');
    pdfRepository.insertSignature.mockResolvedValue(signedBuffer);

    const signatureBuffer = Buffer.from('signature-image');
    const response = await service.signDocument(baseDto, signatureBuffer);

    expect(pdfRepository.fillTextAnchors).toHaveBeenCalledTimes(1);
    const [, items] = pdfRepository.fillTextAnchors.mock.calls[0];
    expect((items as TextAnchorFill[])).toHaveLength(4);
    expect((items as TextAnchorFill[]).map((item) => item.token)).toEqual(
      expect.arrayContaining([
        'NOMBRE_ELABORA_ELABORA_TEST',
        'PUESTO_ELABORA_ELABORA_TEST',
        'GERENCIA_ELABORA_ELABORA_TEST',
        resolved,
      ]),
    );
    expect(pdfRepository.fillRelativeToAnchor).not.toHaveBeenCalled();
    expect(pdfRepository.insertSignature).toHaveBeenCalledWith(
      textBuffer,
      signatureBuffer,
      resolved,
      undefined,
      { writeDate: false },
    );
    expect(awsService.uploadFile).toHaveBeenCalledWith(
      signedBuffer,
      'test.pdf',
    );
    expect(response).toEqual({
      status: expect.any(Number),
      data: expect.any(String),
    });
  });

  it('usa columnas dinámicas cuando faltan tokens', async () => {
    const { service, pdfRepository, awsService, pdfBaseBuffer } =
      createService();
    const resolved = 'FECHA_ELABORA_ELABORA_TEST';

    jest
      .spyOn<any, any>(service as any, 'resolvePlaceholderInPdf')
      .mockResolvedValue({
        resolved,
        primary: resolved,
        candidates: [resolved],
      });

    pdfRepository.extractText.mockResolvedValue(resolved);

    const rowBuffer = Buffer.from('row-columns');
    pdfRepository.fillRowByColumns.mockResolvedValue({
      buffer: rowBuffer,
      mode: 'columns',
    });

    const signedBuffer = Buffer.from('signed-columns');
    pdfRepository.insertSignature.mockResolvedValue(signedBuffer);

    const signatureBuffer = Buffer.from('signature-image');
    const response = await service.signDocument(baseDto, signatureBuffer);

    expect(pdfRepository.fillTextAnchors).not.toHaveBeenCalled();
    expect(pdfRepository.fillRowByColumns).toHaveBeenCalledWith(
      pdfBaseBuffer,
      resolved,
      expect.objectContaining({
        NOMBRE: expect.stringContaining('Juan'),
        PUESTO: 'Analista',
        GERENCIA: 'Tecnología',
        FECHA: expect.any(String),
      }),
      expect.objectContaining({
        signatureBuffer,
        writeDate: false,
      }),
    );
    expect(pdfRepository.insertSignature).toHaveBeenCalledWith(
      rowBuffer,
      signatureBuffer,
      resolved,
      undefined,
      { drawSignature: false, writeDate: true },
    );
    expect(awsService.uploadFile).toHaveBeenCalledWith(
      signedBuffer,
      'test.pdf',
    );
    expect(response).toEqual({
      status: expect.any(Number),
      data: expect.any(String),
    });
  });

  it('recurre al fallback cuando no se detectan columnas', async () => {
    const { service, pdfRepository, awsService, pdfBaseBuffer } =
      createService();
    const resolved = 'FECHA_ELABORA_ELABORA_TEST';

    jest
      .spyOn<any, any>(service as any, 'resolvePlaceholderInPdf')
      .mockResolvedValue({
        resolved,
        primary: resolved,
        candidates: [resolved],
      });

    pdfRepository.extractText.mockResolvedValue(resolved);

    const fallbackBuffer = Buffer.from('fallback');
    pdfRepository.fillRowByColumns.mockResolvedValue({
      buffer: fallbackBuffer,
      mode: 'fallback',
    });

    const signatureBuffer = Buffer.from('signature-image');
    const response = await service.signDocument(baseDto, signatureBuffer);

    expect(pdfRepository.fillRowByColumns).toHaveBeenCalledWith(
      pdfBaseBuffer,
      resolved,
      expect.objectContaining({
        NOMBRE: expect.stringContaining('Juan'),
        PUESTO: 'Analista',
        GERENCIA: 'Tecnología',
        FECHA: expect.any(String),
      }),
      expect.objectContaining({
        signatureBuffer,
        writeDate: false,
      }),
    );
    expect(pdfRepository.insertSignature).not.toHaveBeenCalled();
    expect(awsService.uploadFile).toHaveBeenCalledWith(
      fallbackBuffer,
      'test.pdf',
    );
    expect(response).toEqual({
      status: expect.any(Number),
      data: expect.any(String),
    });
  });

  it('lanza error si no encuentra el placeholder FECHA', async () => {
    const { service } = createService();

    jest
      .spyOn<any, any>(service as any, 'resolvePlaceholderInPdf')
      .mockResolvedValue({
        resolved: null,
        primary: 'FECHA_ELABORA_FAKE',
        candidates: [],
      });

    await expect(
      service.signDocument(baseDto, Buffer.from('signature-image')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
