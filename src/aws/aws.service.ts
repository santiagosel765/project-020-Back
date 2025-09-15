import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { envs } from 'src/config/envs';
import { Readable } from 'stream';

@Injectable()
export class AWSService {
  private readonly logger: Logger = new Logger(AWSService.name);
  
  private readonly s3Client: S3Client = new S3Client({
    region: envs.bucketRegion!,
    credentials: {
      accessKeyId: envs.bucketAccessKeyID!,
      secretAccessKey: envs.bucketSecretKey!,
    },
  });

  /**
   * Sube un archivo al bucket S3 configurado.
   *
   * Este método:
   * 1. Usa el cliente S3 para subir el archivo recibido como buffer al bucket y prefijo definidos en las variables de entorno.
   * 2. El nombre del archivo en S3 será `${bucketPrefix}/${fileName}.${fileExtension}`.
   * 3. Registra en logs el resultado de la operación.
   *
   * @param fileBuffer - Buffer del archivo a subir.
   * @param fileName - Nombre base con el que se guardará el archivo en S3 (sin extensión).
   * @param fileExtension - Extensión del archivo (por defecto "pdf").
   * @returns Un objeto con la clave del archivo (`fileKey`) si la subida fue exitosa, o un objeto con estado `error` y mensaje descriptivo si falla.
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    fileExtension: 'png' | 'jpg' | 'jpeg' | 'pdf' = 'pdf',
    options?: {
      keyPrefix?: string;
      contentType?: string;
      customKey?: string;
    },
  ) {
    const keyPrefix = options?.keyPrefix ?? envs.bucketPrefix;
    const fileKey = options?.customKey ?? `${keyPrefix}/${fileName}.${fileExtension}`;
    const uploadParams: any = {
      Bucket: envs.bucketName,
      Key: fileKey,
      Body: fileBuffer,
    };
    if (options?.contentType) {
      uploadParams.ContentType = options.contentType;
    }

    try {
      const s3Response = await this.s3Client.send(
        new PutObjectCommand(uploadParams),
      );

      this.logger.log(`S3 response: ${s3Response}`);
      this.logger.log(`File key: ${fileKey}`);

      return {
        fileKey,
      };
    } catch (error) {
      const errMsg = `Problemas al subir archivo "${fileName}" al bucket. Error: ${error}`;
      this.logger.error(errMsg);
      return {
        status: 'error',
        data: errMsg,
      };
    }
  }

  /**
   * Genera una URL prefirmada (presigned URL) para acceder temporalmente a un archivo en S3.
   *
   * Este método:
   * 1. Construye la clave del archivo (`fileKey`) usando el prefijo, nombre y extensión.
   * 2. Crea un comando `GetObjectCommand` para el archivo especificado.
   * 3. Genera una URL prefirmada con tiempo de expiración (por defecto 3000 segundos).
   * 4. Si ocurre un error, lo registra en logs y retorna un mensaje de error.
   *
   * @param fileName - Nombre base del archivo en S3 (sin extensión).
   * @param fileExtension - Extensión del archivo (por defecto "pdf").
   * @param expireTime - Tiempo de expiración de la URL en segundos (por defecto 3600 = 1 hora).
   * @returns Un objeto con el estado (`success` o `error`) y la URL prefirmada o el mensaje de error.
   */
  async getPresignedURL(
    fileName: string,
    fileExtension: string = 'pdf',
    expireTime = 3600,
  ) {
    const fileKey = `${envs.bucketPrefix}/${fileName}.${fileExtension}`;

    const command = new GetObjectCommand({
      Bucket: envs.bucketName,
      Key: fileKey,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: `inline; filename="${fileName}.pdf"`,
    });

    try {
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expireTime,
      });

      return {
        status: 'success',
        data: url,
      };
    } catch (error) {
      const errMsg = `Problemas al obtener url del archivo "${fileKey}" al bucket. Error: ${error}`;
      this.logger.error(errMsg);
      return {
        status: 'success',
        data: errMsg,
      };
    }
  }

  async getPresignedURLByKey(
    fileKey: string,
    contentType?: string,
    expiresIn = 3600,
  ) {
    const command = new GetObjectCommand({
      Bucket: envs.bucketName,
      Key: fileKey,
      ...(contentType ? { ResponseContentType: contentType } : {}),
    });

    try {
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });
      return { status: 'success', data: url };
    } catch (error) {
      const errMsg = `Problemas al obtener url del archivo "${fileKey}" al bucket. Error: ${error}`;
      this.logger.error(errMsg);
      return { status: 'error', data: errMsg };
    }
  }

  /**
   * Verifica si un archivo existe en el bucket S3 configurado.
   *
   * Este método:
   * 1. Envía un comando `HeadObject` a S3 para comprobar la existencia del archivo especificado por `fileName` (incluyendo el prefijo).
   * 2. Si el archivo existe, retorna `true`.
   * 3. Si el archivo no existe o ocurre un error, registra el error en logs y retorna `false`.
   *
   * @param fileName - Nombre del archivo en S3 (debe de contener extensión (ej: .pdf, .png)).
   * @returns `true` si el archivo existe en el bucket, `false` en caso contrario.
   */
  async checkFileAvailabilityInBucket(fileKey: string) {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: envs.bucketName,
          Key: fileKey,
        }),
      );

      return true;
    } catch (error) {
      this.logger.error(
        `No fue posible encontrar el archivo ${fileKey} en el bucket.`,
      );
      return false;
    }
  }

  async getFileBuffer(
    fileNameOrKey: string,
    fileExtension: string = 'pdf',
  ): Promise<Buffer> {
    const fileKey = fileNameOrKey.includes('/')
      ? fileNameOrKey
      : `${envs.bucketPrefix}/${fileNameOrKey}.${fileExtension}`;
    return this.getFileBufferByKey(fileKey);
  }

  async getFileBufferByKey(fileKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: envs.bucketName,
      Key: fileKey,
    });
    const response = await this.s3Client.send(command);

    if (response.Body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } else if (Buffer.isBuffer(response.Body)) {
      return response.Body;
    } else if (typeof response.Body?.transformToByteArray === 'function') {
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } else {
      throw new Error('No se pudo procesar el stream del archivo S3');
    }
  }
}
