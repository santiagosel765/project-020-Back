import { PrismaClient } from 'generated/prisma';

export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  prisma: PrismaClient,
  retries = 2,
): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try { return await fn(); } catch (e: any) {
      const code = e?.code ?? '';
      const msg = e?.message ?? '';
      const retryable = ['P1001','P1002','P1017'].includes(code)
        || msg.includes('ECONNRESET')
        || msg.includes('server has closed the connection');
      if (!retryable || attempt === retries) throw e;
      attempt++;
      await prisma.$disconnect().catch(() => {});
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
