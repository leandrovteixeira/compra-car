interface ComparisonSearchParams {
  get(name: string): string | null;
  getAll(name: string): string[];
}

export function buildComparisonPdfUrl(searchParams: ComparisonSearchParams): string {
  const pdfParams = new URLSearchParams();

  for (const vehicles of searchParams.getAll('vehicles')) {
    pdfParams.append('vehicles', vehicles);
  }

  const mode = searchParams.get('mode');
  if (mode === 'complete' || mode === 'differences' || mode === 'advantages') {
    pdfParams.set('mode', mode);
  } else if (searchParams.get('highlights') === 'true') pdfParams.set('mode', 'advantages');

  const query = pdfParams.toString();
  return query.length > 0 ? `/comparar/pdf?${query}` : '/comparar/pdf';
}
