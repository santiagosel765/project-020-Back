import { PrismaClient } from 'generated/prisma';

export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  prisma: PrismaClient,
  retries = 2,
): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error: any) {
      const code = error?.code;
      const message = error?.message ?? '';
      const retryable =
        code === 'P1001' ||
        code === 'P1002' ||
        code === 'P1017' ||
        message.includes('ECONNRESET') ||
        message.includes('server has closed the connection');
      if (!retryable || attempt === retries) {
        throw error;
      }
      attempt++;
      await prisma.$disconnect().catch(() => {});
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
