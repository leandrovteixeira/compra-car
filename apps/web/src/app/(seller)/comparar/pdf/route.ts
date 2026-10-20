import { getAccountTier } from '@/auth/account-tier-server';
import { canExecuteFeature } from '@/auth/entitlements-23c';
import { handleComparisonPdfRequest } from '@/server/comparison-pdf-route';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const tier = await getAccountTier();
  if (!canExecuteFeature(tier, 'export')) {
    return Response.json(
      { error: 'LOGIN_REQUIRED', message: 'Entre na sua conta para exportar comparações.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return handleComparisonPdfRequest(request);
}
