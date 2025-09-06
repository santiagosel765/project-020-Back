import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  API_PREFIX: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRATION: number;
  JWT_REFRESH_EXPIRATION: number;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
}

const envsSchema = joi
  .object({
    PORT: joi.number().required(),
    API_PREFIX: joi.string().required(),
    CORS_ORIGIN: joi.string().required(),
    DATABASE_URL: joi.string().required(),
    JWT_ACCESS_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    JWT_ACCESS_EXPIRATION: joi.number().required(),
    JWT_REFRESH_EXPIRATION: joi.number().required(),
    OPENAI_API_KEY: joi.string().optional().allow(''),
    OPENAI_MODEL: joi.string().optional().allow(''),
  })
  .unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) throw new Error(`Config validation error: ${error.message}`);

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  apiPrefix: envVars.API_PREFIX,
  corsOrigin: envVars.CORS_ORIGIN.split(',').map((o) => o.trim()),
  databaseUrl: envVars.DATABASE_URL,
  jwtAccessSecret: envVars.JWT_ACCESS_SECRET,
  jwtRefreshSecret: envVars.JWT_REFRESH_SECRET,
  jwtAccessExpiration: envVars.JWT_ACCESS_EXPIRATION,
  jwtRefreshExpiration: envVars.JWT_REFRESH_EXPIRATION,
  openAiAPIKey: envVars.OPENAI_API_KEY,
  openAiModel: envVars.OPENAI_MODEL,
};
