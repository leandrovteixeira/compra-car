'use client';
import type { InviteRequestDto } from '@compra-car/contracts';
import { useActionState } from 'react';
import {
  approveInviteRequestAction,
  rejectInviteRequestAction,
} from '@/app/admin/users/invite-actions';
const initial = { status: 'idle' } as const;
function Row({ request }: { request: InviteRequestDto }) {
  const [a, approve, p1] = useActionState(approveInviteRequestAction, initial);
  const [r, reject, p2] = useActionState(rejectInviteRequestAction, initial);
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="font-semibold">{request.inviteeName}</p>
      <p className="break-all text-sm text-slate-400">{request.inviteeEmail}</p>
      <p className="mt-1 text-xs text-slate-500">
        Solicitado em {new Intl.DateTimeFormat('pt-BR').format(new Date(request.createdAt))}
      </p>
      <div className="mt-4 flex gap-2">
        <form action={approve}>
          <input name="requestId" type="hidden" value={request.id} />
          <button className="min-h-10 rounded-lg bg-emerald-600 px-3 font-semibold" disabled={p1}>
            Aprovar
          </button>
        </form>
        <form action={reject}>
          <input name="requestId" type="hidden" value={request.id} />
          <button
            className="min-h-10 rounded-lg border border-rose-800 px-3 text-rose-300"
            disabled={p2}
          >
            Recusar
          </button>
        </form>
      </div>
      {a.status !== 'idle' ? <p className="mt-2 text-sm">{a.message}</p> : null}
      {r.status !== 'idle' ? <p className="mt-2 text-sm">{r.message}</p> : null}
    </article>
  );
}
export function AdminInviteRequestList({
  requests,
}: {
  readonly requests: readonly InviteRequestDto[];
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold">Pedidos de convite</h2>
      {requests.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {requests.map((request) => (
            <Row key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-slate-400">Nenhum pedido pendente.</p>
      )}
    </section>
  );
}
