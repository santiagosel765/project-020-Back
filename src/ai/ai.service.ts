import { Injectable } from '@nestjs/common';
import { AIProvider } from './providers/ai-provider.interface';
import { OpenAiProvider } from './providers/open-ai.provider';

@Injectable()
export class AiService {
  private providers: AIProvider[];

  constructor() {
    this.providers = [
      new OpenAiProvider(),
    ]
  }

  async generateText( prompt: any ) {
    for(const provider of this.providers) {
      try {
        const result = await provider.generateText(prompt);
        if(result) return result;
      } catch (error) {
        throw new Error(`Provider failed: ${error}`);
      }
    }
  }

}
