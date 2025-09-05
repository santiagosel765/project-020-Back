import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
    PORT: number;
    GLOBAL_PREFIX: string;
    OPENAI_API_KEY: string;
    OPENAI_MODEL: string;
}


const envsSchema = joi.object({
    PORT: joi.number().required(),
    GLOBAL_PREFIX: joi.string().required(),
    OPENAI_API_KEY: joi.string().required(),
    OPENAI_MODEL: joi.string().required(),
})
.unknown( true );

const { error, value } = envsSchema.validate( process.env );

if( error ) throw new Error( `Config validation error: ${ error.message }` );

const envVars: EnvVars = value;

export const envs = {
    port: envVars.PORT,
    gobalPrefix: envVars.GLOBAL_PREFIX,
    openAiAPIKey: envVars.OPENAI_API_KEY,
    openAiModel: envVars.OPENAI_MODEL,
}
