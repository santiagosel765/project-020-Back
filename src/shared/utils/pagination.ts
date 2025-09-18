export function buildPageMeta(total: number, page: number, limit: number) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return { total, page, limit, pages };
}
