export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AIProvider {
    generateText(prompt: string): Promise<string>;
}