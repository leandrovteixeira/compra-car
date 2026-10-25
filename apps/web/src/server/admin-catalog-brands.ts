import 'server-only';
import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';

/** Existing brands only; creating new brands belongs to a separate admin workflow. */
export async function loadExistingCatalogBrands(): Promise<readonly string[]> {
  const {data,error}=await createLegacySupabaseClientFromEnv()
    .from('products').select('brand').order('brand').limit(5000);
  if(error) throw error;
  return [...new Set((data??[]).map(row=>String(row.brand??'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
