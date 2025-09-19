import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { envs } from 'src/config/envs';
import { AIProvider } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AIProvider {
  private readonly client = new OpenAI({ apiKey: envs.openAiAPIKey });

  async summarizePDF(pdfContent: string): Promise<AsyncIterable<unknown>> {
    if (!envs.openAiAPIKey) {
      throw new Error('OpenAI API key is not configured');
    }

    return this.client.responses.create({
      model: envs.openAiModel,
      stream: true,
      input: [
        {
          role: 'system',
          content: `
Eres un asistente que resume PDFs. Lee el contenido y genera un RESUMEN en formato **Markdown**:
- Claro y conciso, orientado a negocio.
- Mínimo 1 página, máximo 2 páginas.
- Usa títulos, viñetas y secciones (Resumen, Puntos Clave, Riesgos, Próximos pasos).
- Evita redundancias.
          `.trim(),
        },
        { role: 'user', content: pdfContent },
      ],
    });
  }

  async generateText(prompt: string): Promise<string> {
    if (!envs.openAiAPIKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await this.client.responses.create({
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
