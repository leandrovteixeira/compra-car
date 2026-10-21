interface UpgradeRequest {
  readonly id: string;
  readonly company: string;
  readonly job_title: string;
  readonly contact_phone: string;
  readonly message: string | null;
  readonly created_at: string;
  readonly status: string;
}

export function CorporateUpgradeList({ requests }: { readonly requests: readonly UpgradeRequest[] }) {
  return (
    <section aria-labelledby="corporate-requests-heading">
      <h2 id="corporate-requests-heading" className="text-lg font-semibold">
        Solicitações Corporate
      </h2>
      {requests.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">Nenhuma solicitação Corporate registrada.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{request.company}</h3>
                <span className="text-xs text-text-muted">{request.status}</span>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {request.job_title} · {request.contact_phone}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {new Intl.DateTimeFormat('pt-BR').format(new Date(request.created_at))}
              </p>
              {request.message ? <p className="mt-3 whitespace-pre-wrap text-sm">{request.message}</p> : null}
              <p className="mt-4 text-xs text-text-muted">
                Aprovação indisponível até concluir a validação da operação Master auditável.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
