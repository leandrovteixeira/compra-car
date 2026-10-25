import { getAccountTier } from '@/auth/account-tier-server';
import { canExecuteFeature } from '@/auth/entitlements-23c';
import { handleComparisonPdfRequest } from '@/server/comparison-pdf-route';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  if (!canExecuteFeature(await getAccountTier(), 'export')) return Response.json({ error: 'Autenticação necessária' }, { status: 401 });
  return handleComparisonPdfRequest(request);
}
