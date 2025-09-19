import { Injectable } from '@nestjs/common';
import { OpenAiProvider } from './providers/open-ai.provider';

@Injectable()
export class AiService {
  constructor(private readonly openai: OpenAiProvider) {}

  generateText(prompt: string) {
    return this.openai.generateText(prompt);
  }

  summarizePDF(pdfContent: string) {
    return this.openai.summarizePDF(pdfContent);
  }
}
