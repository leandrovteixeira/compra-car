import { loadMyInviteRequests } from '@/server/invite-requests';
import { InviteRequestForm } from '@/components/invite-request-form';
const labels = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado' } as const;
export default async function InviteRequestsPage() {
  const requests = await loadMyInviteRequests();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Convidar alguém</h1>
      <p className="mt-2 text-slate-400">Solicite a um administrador o acesso de outra pessoa.</p>
      <div className="mt-7">
        <InviteRequestForm />
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Pedidos recentes</h2>
        {requests.length ? (
          <div className="mt-4 grid gap-3">
            {requests.map((r) => (
              <article
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                key={r.id}
              >
                <p className="font-semibold">{r.inviteeName}</p>
                <p className="break-all text-sm text-slate-400">{r.inviteeEmail}</p>
                <p className="mt-2 text-sm">
                  {labels[r.status]} ·{' '}
                  {new Intl.DateTimeFormat('pt-BR').format(new Date(r.createdAt))}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-slate-400">Nenhum pedido enviado.</p>
        )}
      </section>
    </main>
  );
}
