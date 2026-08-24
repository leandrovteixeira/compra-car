interface ComparisonSearchParams {
  get(name: string): string | null;
  getAll(name: string): string[];
}

export function buildComparisonPdfUrl(searchParams: ComparisonSearchParams): string {
  const pdfParams = new URLSearchParams();

  for (const vehicles of searchParams.getAll('vehicles')) {
    pdfParams.append('vehicles', vehicles);
  }

  if (searchParams.get('highlights') === 'true') {
    pdfParams.set('highlights', 'true');
  }

  const query = pdfParams.toString();
  return query.length > 0 ? `/comparar/pdf?${query}` : '/comparar/pdf';
}
