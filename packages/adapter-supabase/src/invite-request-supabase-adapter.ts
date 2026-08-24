import type { InviteRequestDto } from '@compra-car/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminUserAdapterQueryError } from './errors';

type Row = {
  id: number;
  requested_by: string;
  invitee_name: string;
  invitee_email: string;
  status: InviteRequestDto['status'];
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};
const map = (row: Row): InviteRequestDto => ({
  id: String(row.id),
  requestedBy: row.requested_by,
  inviteeName: row.invitee_name,
  inviteeEmail: row.invitee_email,
  status: row.status,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
  reviewedBy: row.reviewed_by,
});
const fields =
  'id,requested_by,invitee_name,invitee_email,status,created_at,reviewed_at,reviewed_by';

export class InviteRequestSupabaseAdapter {
  constructor(private readonly client: SupabaseClient) {}
  async create(
    requestedBy: string,
    inviteeName: string,
    inviteeEmail: string,
  ): Promise<InviteRequestDto> {
    const { data, error } = await this.client
      .from('user_invite_requests')
      .insert({ requested_by: requestedBy, invitee_name: inviteeName, invitee_email: inviteeEmail })
      .select(fields)
      .single();
    if (error || !data)
      throw new AdminUserAdapterQueryError(
        error?.code === '23505' ? 'INVITE_REQUEST_DUPLICATE' : 'INVITE_REQUEST_CREATE_FAILED',
        { cause: error },
      );
    return map(data as Row);
  }
  async listMine(requestedBy: string): Promise<readonly InviteRequestDto[]> {
    const { data, error } = await this.client
      .from('user_invite_requests')
      .select(fields)
      .eq('requested_by', requestedBy)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new AdminUserAdapterQueryError('INVITE_REQUEST_LIST_FAILED', { cause: error });
    return (data as Row[]).map(map);
  }
  async listPending(): Promise<readonly InviteRequestDto[]> {
    const { data, error } = await this.client
      .from('user_invite_requests')
      .select(fields)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw new AdminUserAdapterQueryError('INVITE_REQUEST_LIST_FAILED', { cause: error });
    return (data as Row[]).map(map);
  }
  async get(id: string): Promise<InviteRequestDto | null> {
    const { data, error } = await this.client
      .from('user_invite_requests')
      .select(fields)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new AdminUserAdapterQueryError('INVITE_REQUEST_LOAD_FAILED', { cause: error });
    return data ? map(data as Row) : null;
  }
  async review(id: string, status: 'approved' | 'rejected', reviewedBy: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('user_invite_requests')
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error)
      throw new AdminUserAdapterQueryError('INVITE_REQUEST_REVIEW_FAILED', { cause: error });
    return Boolean(data);
  }
}
