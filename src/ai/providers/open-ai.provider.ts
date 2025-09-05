import OpenAI from 'openai';
import { envs } from 'src/config/envs';
import { AIProvider } from './ai-provider.interface';

export class OpenAiProvider implements AIProvider {
  private openAi: OpenAI;

  constructor() {
    this.openAi = new OpenAI({ apiKey: envs.openAiAPIKey });
  }

  async generateText(prompt: string): Promise<string> {
    const response = await this.openAi.responses.create({
      model: envs.openAiModel,
      input: [
        { role: 'user', content: prompt },
      ],
    });
    return response.output_text;
  }
}