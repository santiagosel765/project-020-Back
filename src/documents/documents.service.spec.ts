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

import { DocumentsService } from './documents.service';
import { FirmaCuadroDto } from './dto/firma-cuadro.dto';
import { type PdfRepository } from '../pdf/domain/repositories/pdf.repository';
import { HttpStatus } from '@nestjs/common';

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

  const documentosRepository = {
    updateDocumentoByCuadroFirmaID: jest.fn(),
    findByCuadroFirmaID: jest.fn(),
  } as any;
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
    documentosRepository,
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

  it('firma el documento insertando la firma y subiendo el archivo', async () => {
    const { service, pdfRepository, awsService, pdfBaseBuffer } =
      createService();

    const signatureBuffer = Buffer.from('signature-image');
    const signedBuffer = Buffer.from('signed');
    pdfRepository.insertSignature.mockResolvedValue(signedBuffer);

    const response = await service.signDocument(baseDto, signatureBuffer);

    expect(pdfRepository.insertSignature).toHaveBeenCalledWith(
      pdfBaseBuffer,
      signatureBuffer,
      'FECHA_ELABORA_Juan_Perez',
      null,
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

  it('lanza error si insertSignature falla', async () => {
    const { service, pdfRepository } = createService();
    pdfRepository.insertSignature.mockRejectedValue(new Error('fail'));

    await expect(
      service.signDocument(baseDto, Buffer.from('signature-image')),
    ).rejects.toThrow('fail');
  });

  it('construye el placeholder según la responsabilidad', async () => {
    const { service, pdfRepository, awsService } = createService();
    const signatureBuffer = Buffer.from('signature-image');
    const signedBuffer = Buffer.from('signed');
    pdfRepository.insertSignature.mockResolvedValue(signedBuffer);

    await service.signDocument(
      { ...baseDto, nombreResponsabilidad: 'Aprueba' },
      signatureBuffer,
    );

    expect(pdfRepository.insertSignature).toHaveBeenCalledWith(
      expect.any(Buffer),
      signatureBuffer,
      'FECHA_APRUEBA_Juan_Perez',
      null,
    );
    expect(awsService.uploadFile).toHaveBeenCalled();
  });
});

describe('DocumentsService.extractPDFContent', () => {
  it('obtiene el contenido del PDF desde almacenamiento y lo extrae', async () => {
    const {
      service,
      documentosRepository,
      awsService,
      pdfRepository,
      pdfBaseBuffer,
    } = createService();

    documentosRepository.findByCuadroFirmaID.mockResolvedValue({
      nombre_archivo: 'archivo.pdf',
    });
    pdfRepository.extractText.mockResolvedValue('contenido extraído');

    await expect(service.extractPDFContent(42)).resolves.toBe(
      'contenido extraído',
    );
    expect(documentosRepository.findByCuadroFirmaID).toHaveBeenCalledWith(42);
    expect(awsService.getFileBuffer).toHaveBeenCalledWith('archivo.pdf');
    expect(pdfRepository.extractText).toHaveBeenCalledWith(pdfBaseBuffer);
  });

  it('lanza 404 si no existe un documento asociado al cuadro de firmas', async () => {
    const { service, documentosRepository } = createService();
    documentosRepository.findByCuadroFirmaID.mockResolvedValue(null);

    await expect(service.extractPDFContent(99)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('lanza 400 si no se puede extraer el contenido del PDF', async () => {
    const { service, documentosRepository, pdfRepository } = createService();
    documentosRepository.findByCuadroFirmaID.mockResolvedValue({
      nombre_archivo: 'archivo.pdf',
    });
    pdfRepository.extractText.mockResolvedValue('   ');

    await expect(service.extractPDFContent(7)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });
});
