/**
 * Reúne una consulta paginada hasta recibir una página incompleta.
 * Supabase usa rangos inclusivos y limita por defecto cada respuesta a 1.000 filas.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 500
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('El tamaño de página debe ser positivo.');

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
