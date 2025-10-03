import { Injectable } from '@nestjs/common';
import { ChatSession, OpenAiProvider } from './providers/open-ai.provider';

@Injectable()
export class AiService {
  constructor(private readonly openai: OpenAiProvider) {}

  generateText(prompt: string) {
    return this.openai.generateText(prompt);
  }

  summarizePDF(pdfContent: string) {
    return this.openai.summarizePDF(pdfContent);
  }

  processVision(base64Image: string) {
    return this.openai.processVision(base64Image);
  }

  // Método que te falta para crear sesiones de chat
  async createChatSession(userId: number, cuadroFirmaId: number, pdfContent: string): Promise<string> {
    return this.openai.createChatSession(userId, cuadroFirmaId, pdfContent);
  }

  async chatWithDocument(sessionId: string, userMessage: string): Promise<{ stream: AsyncIterable<unknown>; sessionId: string }> {
    return this.openai.chatWithDocument(sessionId, userMessage);
  }

  async updateSessionWithAssistantResponse(sessionId: string, assistantResponse: string): Promise<void> {
    return this.openai.updateSessionWithAssistantResponse(sessionId, assistantResponse);
  }

  // Métodos de gestión de sesiones
  getUserSessions(userId: number): ChatSession[] {
    return this.openai.getUserSessions(userId);
  }

  getSession(sessionId: string) {
    return this.openai.getSession(sessionId);
  }

  deleteSession(sessionId: string): boolean {
    return this.openai.deleteSession(sessionId);
  }

  getActiveSessions(): number {
    return this.openai.getActiveSessions();
  }

  manualCleanup(): number {
    return this.openai.manualCleanup();
  }
}