import 'dotenv/config';
import * as joi from 'joi';

const envsSchema = joi
  .object({
    PORT: joi.number().default(3200),
    API_PREFIX: joi.string().default('/api/v1'),
    CORS_ORIGIN: joi.string().default('http://localhost:9002'),
    NODE_ENV: joi.string().default('development'),
    DATABASE_URL: joi.string().required(),

    JWT_ACCESS_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    JWT_ACCESS_EXPIRATION: joi.number().default(900),
    JWT_REFRESH_EXPIRATION: joi.number().default(604800),

    S3_BUCKET_REGION: joi.string().optional().allow(''),
    S3_BUCKET_NAME: joi.string().optional().allow(''),
    S3_BUCKET_PREFIX: joi.string().optional().allow(''),
    S3_BUCKET_SIGNATURES_PREFIX: joi.string().optional().allow(''),
    BUCKET_SIGNATURES_PREFIX: joi.string().optional().allow(''),
    S3_BUCKET_ACCESS_KEY_ID: joi.string().optional().allow(''),
    S3_BUCKET_SECRET_KEY: joi.string().optional().allow(''),

    OPENAI_API_KEY: joi.string().optional().allow(''),
    OPENAI_MODEL: joi.string().default('gpt-4o-mini'),
  })
  .unknown(true);

const { error, value } = envsSchema.validate(process.env, {
  abortEarly: false,
});
if (error) throw new Error(`Config validation error: ${error.message}`);

export const envs = {
  port: value.PORT,
  apiPrefix: value.API_PREFIX,
  corsOrigin: String(value.CORS_ORIGIN)
    .split(',')
    .map((o: string) => o.trim()),
  nodeEnv: value.NODE_ENV,
  databaseUrl: value.DATABASE_URL,

  jwtAccessSecret: value.JWT_ACCESS_SECRET,
  jwtRefreshSecret: value.JWT_REFRESH_SECRET,
  jwtAccessExpiration: value.JWT_ACCESS_EXPIRATION,
  jwtRefreshExpiration: value.JWT_REFRESH_EXPIRATION,

  bucketRegion: value.S3_BUCKET_REGION as string | undefined,
  bucketName: value.S3_BUCKET_NAME as string | undefined,
  bucketPrefix: (value.S3_BUCKET_PREFIX as string | undefined) ?? '',
  bucketSignaturesPrefix:
    (value.S3_BUCKET_SIGNATURES_PREFIX as string | undefined) ??
    (value.BUCKET_SIGNATURES_PREFIX as string | undefined) ??
    'signatures',
  bucketAccessKeyID: value.S3_BUCKET_ACCESS_KEY_ID as string | undefined,
  bucketSecretKey: value.S3_BUCKET_SECRET_KEY as string | undefined,

  openAiAPIKey: value.OPENAI_API_KEY,
  openAiModel: value.OPENAI_MODEL,
};
