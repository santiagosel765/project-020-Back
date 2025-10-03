// src/ai/entities/chat-session.entity.ts
export interface ChatSession {
  id: string;
  userId: number;
  documentId: number;
  pdfContent: string; // Texto extraído del PDF (se guarda una vez)
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: Date;
  updatedAt: Date;
}