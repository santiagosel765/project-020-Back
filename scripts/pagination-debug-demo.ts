process.env.PAGINATION_DEBUG = process.env.PAGINATION_DEBUG ?? '1';

import { PaginasService } from '../src/paginas/paginas.service';

type PaginaRecord = {
  id: number;
  add_date: Date;
  activo: boolean;
};

const dataset: PaginaRecord[] = Array.from({ length: 15 }, (_, index) => ({
  id: index + 1,
  add_date: new Date(2024, 0, index + 1),
  activo: true,
}));

class PrismaMock {
  pagina = {
    count: async () => dataset.length,
    findMany: async ({ orderBy, skip = 0, take = dataset.length }: any) => {
      const direction: 'asc' | 'desc' = orderBy?.[0]?.add_date === 'asc' ? 'asc' : 'desc';
      const sorted = [...dataset].sort((a, b) => {
        const dateDiff = a.add_date.getTime() - b.add_date.getTime();
        if (dateDiff !== 0) {
          return direction === 'asc' ? dateDiff : -dateDiff;
        }
        return direction === 'asc' ? a.id - b.id : b.id - a.id;
      });

      const start = skip ?? 0;
      const end = typeof take === 'number' ? start + take : undefined;
      return sorted.slice(start, end);
    },
  };

  $transaction<T>(operations: Array<Promise<T>>) {
    return Promise.all(operations);
  }
}

async function main() {
  const prisma = new PrismaMock();
  const service = new PaginasService(prisma as any);

  const firstPage = await service.findAll(false, { page: 1, limit: 10, sort: 'desc' });
  const secondPage = await service.findAll(false, { page: 2, limit: 10, sort: 'desc' });

  console.log('First page IDs:', firstPage.items.map((item) => item.id));
  console.log('Second page IDs:', secondPage.items.map((item) => item.id));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
