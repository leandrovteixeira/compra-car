'use server';
import { manageBrandConnector, type BrandActionState } from '@/application/admin/brand-connectors';
export async function brandConnectorAction(
  _state: BrandActionState,
  data: FormData,
): Promise<BrandActionState> {
  return manageBrandConnector(data);
}
