import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { envs } from 'src/config/envs';

@Injectable()
export class AWSService {
  private readonly logger = new Logger(AWSService.name);

  // 🔒 habilitado solo si hay mínimos: región y bucket
  private readonly enabled =
    Boolean(envs.bucketRegion && envs.bucketRegion.trim()) &&
    Boolean(envs.bucketName && envs.bucketName.trim());

  private _client: S3Client | null = null;

  private get client(): S3Client | null {
    if (!this.enabled) return null;
    if (this._client) return this._client;

    const config: S3ClientConfig = {
      region: envs.bucketRegion!, // no-null because enabled=true
    };

    // Credenciales (opcionales). Si no hay, AWS SDK intentará otras fuentes (profile, role, etc.)
    if (envs.bucketAccessKeyID && envs.bucketSecretKey) {
      config.credentials = {
        accessKeyId: envs.bucketAccessKeyID,
        secretAccessKey: envs.bucketSecretKey,
      };
    }

    this._client = new S3Client(config);
    return this._client;
  }

  async uploadFile(filePath: string, fileName: string) {
    if (!this.enabled || !this.client) {
      this.logger.warn('AWS S3 deshabilitado: configura S3_BUCKET_REGION y S3_BUCKET_NAME para activar.');
      // Mantengo mismo shape de respuesta que tu código
      return { status: 'error', data: 'S3 no configurado' };
    }

    const uploadParams = {
      Bucket: envs.bucketName!,
      Key: `${envs.bucketPrefix || ''}/${fileName}`.replace(/^\/+/, ''),
      // 👇 Usa stream o Buffer, no el path literal
      Body: fs.createReadStream(filePath),
      ContentType: 'application/pdf',
    };

    try {
      const s3Response = await this.client.send(new PutObjectCommand(uploadParams));

      // Limpia el archivo temporal local
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      this.logger.log(`S3 putObject OK: ${JSON.stringify(s3Response)}`);
      return { status: 'success', data: 'Archivo subido al bucket exitosamente' };
    } catch (error) {
      const errMsg = `Problemas al subir archivo "${filePath}" al bucket. Error: ${error}`;
      this.logger.error(errMsg);
      return { status: 'error', data: errMsg };
    }
  }

  async getPresignedURL(fileName: string, expireTime = 3000) {
    if (!this.enabled || !this.client) {
      this.logger.warn('AWS S3 deshabilitado: configura S3_BUCKET_REGION y S3_BUCKET_NAME para activar.');
      return { status: 'error', data: 'S3 no configurado' };
    }

    const exists = await this.checkFileAvailabilityInBucket(fileName);
    if (!exists) {
      return { status: 'error', data: `No fue posible encontrar el archivo ${fileName} en el bucket.` };
    }

    const command = new GetObjectCommand({
      Bucket: envs.bucketName!,
      Key: `${envs.bucketPrefix || ''}/${fileName}`.replace(/^\/+/, ''),
    });

    try {
      const url = await getSignedUrl(this.client, command, { expiresIn: expireTime });
      return { status: 'success', data: url };
    } catch (error) {
      const errMsg = `Problemas al obtener url del archivo "${fileName}". Error: ${error}`;
      this.logger.error(errMsg);
      return { status: 'error', data: errMsg };
    }
  }

  async checkFileAvailabilityInBucket(fileName: string) {
    if (!this.enabled || !this.client) {
      this.logger.warn('AWS S3 deshabilitado: configura S3_BUCKET_REGION y S3_BUCKET_NAME para activar.');
      return false;
    }
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: envs.bucketName!,
          Key: `${envs.bucketPrefix || ''}/${fileName}`.replace(/^\/+/, ''),
        }),
      );
      return true;
    } catch {
      this.logger.error(`No fue posible encontrar el archivo ${fileName} en el bucket.`);
      return false;
    }
  }
}
