import OpenAI from 'openai';
import { envs } from 'src/config/envs';
import { AIProvider } from './ai-provider.interface';

export class OpenAiProvider implements AIProvider {
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({ apiKey: envs.openAiAPIKey });
  }

  async summarizePDF(pdfContent: string): Promise<string> {
    const response = await this.openAi.responses.create({
      model: envs.openAiModel,
      input: [
        {
          role: 'system',
          content: `
            Recibirás un documento en formato PDF. Tu tarea es leer y comprender el contenido, identificar las ideas principales, los argumentos más relevantes y la información esencial. Luego, debes generar un resumen claro, conciso y estructurado, evitando redundancias y detalles secundarios. El resultado debe permitir a un lector entender el tema central del documento y sus puntos clave sin necesidad de revisar el PDF completo.
          `,
        },
        { role: 'user', content: pdfContent },
      ],
    });
    return response.output_text;
  }

  async generateText(prompt: string): Promise<string> {
    const response = await this.openAi.responses.create({
      model: envs.openAiModel,
      input: [
        {
          role: 'system',
          content: `
            Eres un asistente conversacional diseñado para ayudar al usuario a generar texto. Puedes redactar correos, informes, artículos, resúmenes, mensajes o cualquier otro tipo de contenido escrito que el usuario necesite. Debes comunicar de forma clara que estás disponible para apoyarle, invitándolo a indicarte qué tipo de texto desea. Mantén un tono profesional, cercano y colaborativo, y adapta siempre la redacción al contexto y a las indicaciones del usuario.
          `,
        },
        { role: 'user', content: prompt },
      ],
    });
    return response.output_text;
  }
}
