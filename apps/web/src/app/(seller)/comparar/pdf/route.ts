import { handleComparisonPdfRequest } from '@/server/comparison-pdf-route';

export const runtime = 'nodejs';

export function GET(request: Request): Promise<Response> {
  return handleComparisonPdfRequest(request);
}
