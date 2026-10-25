'use client';
import { useActionState } from 'react';
import { reviewCorporateRequest, type CorporateReviewState } from '@/app/admin/users/corporate-actions';
const initial: CorporateReviewState = { status: 'idle' };
interface Organization { readonly id: string; readonly name: string; readonly status: string; }
interface UpgradeRequest {
  readonly id: string;
  readonly company: string;
  readonly job_title: string;
  readonly contact_phone: string;
  readonly message: string | null;
  readonly created_at: string;
  readonly status: string;
}

export function CorporateUpgradeList({ requests, organizations }: { readonly requests: readonly UpgradeRequest[]; readonly organizations: readonly Organization[] }) {
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
            <CorporateRequestRow key={request.id} request={request} organizations={organizations} />

          ))}
        </div>
      )}
    </section>
  );
}

function CorporateRequestRow({ request, organizations }: { readonly request: UpgradeRequest; readonly organizations: readonly Organization[] }) {
 const [state, action, pending] = useActionState(reviewCorporateRequest, initial);
 return <article className="rounded-xl border border-border bg-surface p-5">
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
                A decisão é registrada em auditoria.
              </p>

 {request.status === 'pending' ? <form action={action} className="mt-4 flex flex-wrap gap-3">
 <input type="hidden" name="requestId" value={request.id} />
 <select aria-label="Organização" name="organizationId" defaultValue="" className="ui-field min-w-40" required>
 <option value="" disabled>Organização</option>
 {organizations.filter(org => org.status === 'active').map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
 </select>
 <button className="rounded-lg bg-[#EF7732] px-4 py-2 font-semibold text-white" disabled={pending} type="submit" name="decision" value="approved">Aprovar</button>
 <button className="rounded-lg border border-border px-4 py-2" disabled={pending} type="submit" name="decision" value="rejected" formNoValidate>Rejeitar</button>
 </form> : null}
 {state.message ? <p role={state.status === 'error' ? 'alert' : 'status'} className="mt-3 text-sm">{state.message}</p> : null}
 </article>;
}
