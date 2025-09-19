import { PaginasService } from './paginas.service';
import { stableOrder } from 'src/shared/utils/pagination';

describe('PaginasService pagination', () => {
  const dataset = Array.from({ length: 16 }, (_, index) => ({
    id: index + 1,
    add_date: new Date(2024, 0, index + 1),
    activo: true,
  }));

  const createPrismaMock = () => {
    const count = jest.fn(() => Promise.resolve(dataset.length));
    const findMany = jest.fn((args: any) => {
      const { orderBy, skip = 0, take } = args ?? {};

      if (!Array.isArray(orderBy) || orderBy.length === 0) {
        throw new Error('Expected stable order definition');
      }

      if (typeof skip !== 'number') {
        throw new Error('Expected skip to be provided to the ORM');
      }

      if (typeof take !== 'number') {
        throw new Error('Expected take to be provided to the ORM');
      }

      const direction: 'asc' | 'desc' = orderBy[0]?.add_date ?? 'desc';

      const sorted = [...dataset].sort((a, b) => {
        const dateDiff = a.add_date.getTime() - b.add_date.getTime();
        if (dateDiff !== 0) {
          return direction === 'asc' ? dateDiff : -dateDiff;
        }
        return direction === 'asc' ? a.id - b.id : b.id - a.id;
      });

      const start = skip;
      const end = start + take;
      return Promise.resolve(sorted.slice(start, end));
    });

    const transaction = jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );

    const prisma = {
      pagina: {
        count,
        findMany,
      },
      $transaction: transaction,
    } as const;

    return { prisma: prisma as unknown, count, findMany, transaction };
  };

  it('paginates with stable order and envelope metadata', async () => {
    const { prisma, count, findMany } = createPrismaMock();
    const service = new PaginasService(prisma as any);

    const firstPage = await service.findAll(false, {
      page: 1,
      limit: 10,
      sort: 'desc',
    });

    const secondPage = await service.findAll(false, {
      page: 2,
      limit: 10,
      sort: 'desc',
    });

    expect(firstPage.items).toHaveLength(10);
    expect(secondPage.items).toHaveLength(6);

    const ids = [...firstPage.items, ...secondPage.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(dataset.length);

    expect(firstPage).toMatchObject({
      page: 1,
      limit: 10,
      sort: 'desc',
      total: dataset.length,
      pages: 2,
      hasPrev: false,
      hasNext: true,
    });

    expect(secondPage).toMatchObject({
      page: 2,
      limit: 10,
      sort: 'desc',
      total: dataset.length,
      pages: 2,
      hasPrev: true,
      hasNext: false,
    });

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: stableOrder('desc'),
        skip: 0,
        take: 10,
      }),
    );

    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: stableOrder('desc'),
        skip: 10,
        take: 10,
      }),
    );

    const countWhereArgs = count.mock.calls.map((call) => call[0]?.where);
    const findManyWhereArgs = findMany.mock.calls.map((call) => call[0]?.where);
    expect(countWhereArgs).toEqual(findManyWhereArgs);
  });
});
