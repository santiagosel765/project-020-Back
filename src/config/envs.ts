import 'dotenv/config';
import * as joi from 'joi';

const envsSchema = joi.object({
  PORT: joi.number().default(3200),
  API_PREFIX: joi.string().default('/api/v1'),         
  CORS_ORIGIN: joi.string().default('http://localhost:9002'),
  DATABASE_URL: joi.string().required(),

  JWT_ACCESS_SECRET: joi.string().required(),
  JWT_REFRESH_SECRET: joi.string().required(),
  JWT_ACCESS_EXPIRATION: joi.number().default(900),
  JWT_REFRESH_EXPIRATION: joi.number().default(604800),

  OPENAI_API_KEY: joi.string().optional().allow(''),
  OPENAI_MODEL: joi.string().optional().allow(''),
}).unknown(true);

const { error, value } = envsSchema.validate(process.env, { abortEarly: false });
if (error) throw new Error(`Config validation error: ${error.message}`);

export const envs = {
  port: value.PORT,
  apiPrefix: value.API_PREFIX,
  corsOrigin: String(value.CORS_ORIGIN).split(',').map((o: string) => o.trim()),
  databaseUrl: value.DATABASE_URL,
  jwtAccessSecret: value.JWT_ACCESS_SECRET,
  jwtRefreshSecret: value.JWT_REFRESH_SECRET,
  jwtAccessExpiration: value.JWT_ACCESS_EXPIRATION,
  jwtRefreshExpiration: value.JWT_REFRESH_EXPIRATION,
  openAiAPIKey: value.OPENAI_API_KEY,
  openAiModel: value.OPENAI_MODEL,
};
