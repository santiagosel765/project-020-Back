import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  GLOBAL_PREFIX: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRATION: number;
  JWT_REFRESH_EXPIRATION: number;
}

const envsSchema = joi
  .object({
    PORT: joi.number().required(),
    GLOBAL_PREFIX: joi.string().required(),
    OPENAI_API_KEY: joi.string().required(),
    OPENAI_MODEL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    JWT_EXPIRATION: joi.number().required(),
    JWT_REFRESH_EXPIRATION: joi.number().required(),
  })
  .unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) throw new Error(`Config validation error: ${error.message}`);

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  gobalPrefix: envVars.GLOBAL_PREFIX,
  openAiAPIKey: envVars.OPENAI_API_KEY,
  openAiModel: envVars.OPENAI_MODEL,
  jwtSecret: envVars.JWT_SECRET,
  jwtRefreshSecret: envVars.JWT_REFRESH_SECRET,
  jwtExpiration: envVars.JWT_EXPIRATION,
  jwtRefreshExpiration: envVars.JWT_REFRESH_EXPIRATION,
};
