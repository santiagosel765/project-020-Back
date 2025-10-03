import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { envs } from 'src/config/envs';
import { AIProvider } from './ai-provider.interface';
import { SignatureAnalysis } from '../interfaces/signature-analysis.interface';

export interface ChatSession {
  id: string;
  userId: number;
  cuadroFirmaId: number;
  pdfContent: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: Date;
  lastActivity: Date;
}

@Injectable()
export class OpenAiProvider implements AIProvider {
  private readonly client = new OpenAI({ apiKey: envs.openAiAPIKey });
  private readonly chatSessions = new Map<string, ChatSession>();
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Inicia la limpieza automática cada 10 minutos
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldSessions();
      },
      10 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    // Limpia el intervalo cuando el módulo se destruye
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private cleanupOldSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.chatSessions.entries()) {
      const timeSinceLastActivity =
        now.getTime() - session.lastActivity.getTime();
      if (timeSinceLastActivity > this.SESSION_TIMEOUT_MS) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach((sessionId) => {
      this.chatSessions.delete(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(
        `Limpiadas ${expiredSessions.length} sesiones de chat expiradas`,
      );
    }
  }

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
            - No vuelvas a colocar el titulo del documento
            - Respeta el espaciado entre párrafos
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

  async processVision(base64Image: string): Promise<SignatureAnalysis> {
    const response = await this.client.responses.create({
      model: envs.openAiModel,
      input: [
        {
          role: 'system',
          content: `
            Eres un asistente que analiza imágenes.  

            Tu tarea es determinar si la imagen proporcionada corresponde a una firma manuscrita.  

            - Si la imagen es una firma válida (ya sea manuscrita o en estilo digital de firma), responde únicamente con:  
            {
              "isSignature": true
            }

            - Si la imagen NO es una firma (por ejemplo: texto, documento impreso, foto, dibujo, sello, objeto u otra cosa), responde únicamente con:  
            {
              "isSignature": false,
              "message": "La imagen no corresponde a una firma."
            }
          `,
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: "what's in this image?" },
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${base64Image}`,
              detail: 'auto', // or 'low' | 'high' depending on your use case
            },
          ],
        },
      ],
    });
    try {
      return JSON.parse(response.output_text) as SignatureAnalysis;
    } catch (error) {
      throw new Error(`El formato de la respuesta no es válido: ${error}`);
    }
  }

  // Agrega este método en open-ai.provider.ts
async createChatSession(userId: number, cuadroFirmaId: number, pdfContent: string): Promise<string> {
  const sessionId = require('crypto').randomUUID(); // o usa uuid v4
  const now = new Date();
  const session: ChatSession = {
    id: sessionId,
    userId,
    cuadroFirmaId,
    pdfContent,
    conversationHistory: [],
    createdAt: now,
    lastActivity: now,
  };

  this.chatSessions.set(sessionId, session);
  return sessionId;
}

  async chatWithDocument(
    sessionId: string,
    userMessage: string,
  ): Promise<{ stream: AsyncIterable<unknown>; sessionId: string }> {
    const session = this.chatSessions.get(sessionId);

    if (!session) {
      throw new Error('Sesión de chat no encontrada');
    }

    // Actualiza la última actividad
    session.lastActivity = new Date();

    const messages = [
      {
        role: 'system',
        content: `
          Eres un asistente especializado en analizar y responder preguntas sobre documentos PDF.
          
          Tienes acceso al siguiente documento:
          ${session.pdfContent}
          
          Instrucciones:
          - Responde únicamente basándote en el contenido del documento proporcionado.
          - Si la pregunta no se puede responder con la información del documento, indícalo claramente.
          - Sé preciso, claro y conciso en tus respuestas
          - Retorna la respuesta en formato markdown
          - Respeta el espaciado entre párrafos
        `.trim(),
      },
      ...session.conversationHistory,
      { role: 'user', content: userMessage },
    ];

    // Agregar el mensaje del usuario al historial
    session.conversationHistory.push({ role: 'user', content: userMessage });

    const inputText = messages
      .map((msg) => {
        const roleLabel =
          msg.role === 'system'
            ? '[Sistema]'
            : msg.role === 'user'
              ? '[Usuario]'
              : '[Asistente]';
        return `${roleLabel}: ${msg.content}`;
      })
      .join('\n\n');

    const stream = await this.client.responses.create({
      model: envs.openAiModel,
      stream: true,
      input: inputText,
    });

    return { stream, sessionId };
  }

  async updateSessionWithAssistantResponse(
    sessionId: string,
    assistantResponse: string,
  ): Promise<void> {
    const session = this.chatSessions.get(sessionId);
    if (session) {
      session.conversationHistory.push({
        role: 'assistant',
        content: assistantResponse,
      });
      session.lastActivity = new Date();
    }
  }

  getUserSessions(userId: number): ChatSession[] {
    return Array.from(this.chatSessions.values()).filter(
      (session) => session.userId === userId,
    );
  }

  getSession(sessionId: string): ChatSession | null {
    return this.chatSessions.get(sessionId) || null;
  }

  deleteSession(sessionId: string): boolean {
    return this.chatSessions.delete(sessionId);
  }

  getActiveSessions(): number {
    return this.chatSessions.size;
  }

  
  manualCleanup(): number {
    const beforeCount = this.chatSessions.size;
    this.cleanupOldSessions();
    return beforeCount - this.chatSessions.size;
  }

}
