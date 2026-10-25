'use server';

import type { ManualPriceBatchActionStateDto } from '@compra-car/contracts';
import { randomUUID } from 'node:crypto';

import { requireRole } from '@/auth/authorization';
import { createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';
import { canonicalAmountFromPtBr } from '@/application/admin/product-public-price-form';
import { revalidatePath } from 'next/cache';
import {
  EMPTY_MANUAL_PRICE_BATCH_ROW,
  readManualPriceBatchRows,
} from '@/application/admin/manual-price-batch';

export async function createManualPriceBatchAction(
  _previousState: ManualPriceBatchActionStateDto,
  formData: FormData,
): Promise<ManualPriceBatchActionStateDto> {
  const actionCorrelationId = randomUUID();
  try {
    const rows = readManualPriceBatchRows(formData);
    if (!rows) throw new Error('Invalid manual price payload');
    const filled = rows.filter(row => row.productId || row.amount.trim() || row.startsOn || row.endsOn);
    if (!filled.length || filled.length > 100) {
      return { status:'error',rows,rowErrors:{},message:'Informe de 1 a 100 preços válidos.' };
    }
    const normalized = filled.map(row => {
      const amount = Number(canonicalAmountFromPtBr(row.amount));
      return { ...row, amount: Number.isFinite(amount) ? amount.toFixed(2) : 'invalid', endsOn: row.endsOn || '' };
    });
    const { profile } = await requireRole('admin');
    const { data, error } = await createLegacySupabaseClientFromEnv().rpc(
      'create_and_publish_manual_price_batch',
      { p_rows: normalized, p_actor_id: profile.id, p_correlation_id: actionCorrelationId },
    );
    if (error) {
      console.error('Atomic batch publication rejected.',{code:error.code,correlationId:actionCorrelationId});
      return {status:'error',rows,rowErrors:{},message: error.code==='23505'
        ? 'Já existe preço para esse veículo e início. Corrija o registro na Lista de Preços.'
        : 'Não foi possível publicar o lote. Nenhum preço foi salvo. Verifique datas e conflitos de vigência.'};
    }
    const payload = data as {batchId:number;createdCount:number};
    revalidatePath('/admin/prices');
    return {status:'success',rows:[{...EMPTY_MANUAL_PRICE_BATCH_ROW}],rowErrors:{},
      batchId:String(payload.batchId),createdCount:payload.createdCount,
      message:`${payload.createdCount} preço(s) cadastrado(s) e publicado(s).`};
  } catch (error) {
    console.error('Manual price batch Server Action failed.', { actionCorrelationId, error });
    return {
      status: 'error',
      rows: readManualPriceBatchRows(formData) ?? [{ ...EMPTY_MANUAL_PRICE_BATCH_ROW }],
      rowErrors: {},
      message: `Não foi possível salvar os preços. Referência: ${actionCorrelationId}`,
    };
  }
}
