import { notFound } from 'next/navigation';
import Link from 'next/link';

import { IMPORT_DOCUMENT_ROLES, IMPORT_ENGINE_MAX_DOCUMENTS } from '@compra-car/core';
import { requireRole } from '@/auth/authorization';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminImportBatch } from '@/server/import-engine-service';
import {
  archiveImportBatchAction,
  openImportDocumentAction,
  rejectImportDocumentAction,
  updateImportDocumentRoleAction,
  processImportBatchAction,
} from '../actions';

const ROLE_LABELS: Readonly<Record<string, string>> = {
  primary: 'Carta principal',
  errata: 'Errata',
  complement: 'Complemento',
  financial_appendix: 'Anexo financeiro',
  trade_in_appendix: 'Anexo de Trade-In',
  technical_appendix: 'Anexo técnico',
  other: 'Outro',
};

function bytes(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1024 / 1024)} MB`;
}

export default async function AdminImportDetailsPage({
  params,
}: {
  readonly params: Promise<{ batchId: string }>;
}) {
  await requireRole('admin');
  const { batchId } = await params;
  const batch = await loadAdminImportBatch(batchId);
  if (!batch) notFound();
  const editable = ['uploaded', 'validated', 'ready', 'failed'].includes(batch.status);
  return (
    <>
      <PageHeader
        description="Dossiê privado e auditável do Import Engine."
        eyebrow="Import Engine"
        title={`Importação: ${batch.title}`}
      />
      <section className="mt-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-xs text-slate-500">Plugin</p>
          <p className="text-sm text-white">Cartas Comerciais</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Competência</p>
          <p className="text-sm text-white">{batch.competence ?? 'Não informada'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Status</p>
          <p className="text-sm font-bold text-emerald-300">{batch.status}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Criado por</p>
          <p className="text-sm text-white">{batch.createdByName ?? 'Usuário removido'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Documentos</p>
          <p className="text-sm text-white">{batch.documentCount}</p>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Documentos</h2>
            <p className="text-sm text-slate-500">
              Acesso somente por URL assinada de curta duração.
            </p>
          </div>
          {editable && batch.documentCount < IMPORT_ENGINE_MAX_DOCUMENTS ? (
            <Link className="ui-button ui-button--primary" href={`/admin/imports/${batch.id}/add`}>
              Adicionar documento
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3">
          {batch.documents.map((document) => (
            <article
              className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 xl:grid-cols-[minmax(0,2fr)_11rem_6rem_8rem_minmax(9rem,1fr)_auto] xl:items-center"
              key={document.id}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{document.originalFileName}</p>
                <p className="truncate text-xs text-slate-500" title={document.contentSha256}>
                  SHA-256 {document.contentSha256.slice(0, 16)}…
                </p>
              </div>
              <form action={updateImportDocumentRoleAction} className="grid gap-1">
                <input name="batchId" type="hidden" value={batch.id} />
                <input name="documentId" type="hidden" value={document.id} />
                <input name="lockVersion" type="hidden" value={document.lockVersion} />
                <label className="text-xs text-slate-500">Papel</label>
                <select
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-2 text-sm text-white"
                  defaultValue={document.documentRole}
                  disabled={!editable}
                  name="documentRole"
                >
                  {IMPORT_DOCUMENT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                {editable ? (
                  <button className="text-left text-xs font-semibold text-sky-300" type="submit">
                    Salvar papel
                  </button>
                ) : null}
              </form>
              <div>
                <p className="text-xs text-slate-500">Páginas</p>
                <p className="text-sm text-white">{document.pageCount ?? 'Pendente'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tamanho</p>
                <p className="text-sm text-white">{bytes(document.fileSizeBytes)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-sm font-semibold text-emerald-300">{document.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={openImportDocumentAction}>
                  <input name="documentId" type="hidden" value={document.id} />
                  <button
                    className="min-h-11 rounded-xl border border-sky-700 px-3 text-sm font-bold text-sky-200"
                    type="submit"
                  >
                    Visualizar
                  </button>
                </form>
                {editable && document.status !== 'rejected' ? (
                  <form action={rejectImportDocumentAction} className="flex flex-wrap gap-2">
                    <input name="batchId" type="hidden" value={batch.id} />
                    <input name="documentId" type="hidden" value={document.id} />
                    <input name="lockVersion" type="hidden" value={document.lockVersion} />
                    <input
                      aria-label={`Motivo para rejeitar ${document.originalFileName}`}
                      className="min-h-11 w-36 rounded-xl border border-slate-700 bg-slate-950 px-2 text-sm text-white"
                      name="reason"
                      placeholder="Motivo"
                      required
                    />
                    <button
                      className="min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-bold text-rose-300"
                      type="submit"
                    >
                      Rejeitar
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {batch.status === 'ready' ? (
        <div className="mt-7 rounded-2xl border border-emerald-800 bg-emerald-950/20 p-5 text-emerald-100">
          <p className="font-bold">Documentos recebidos com sucesso.</p>
          <p className="mt-1 text-sm">
            A extração e a identificação dos modelos serão habilitadas na próxima etapa do Import
            Engine.
          </p>
          <span className="mt-3 inline-flex rounded-full border border-emerald-700 px-3 py-1 text-xs font-bold">
            Pronto para extração
          </span>
          <form action={processImportBatchAction} className="mt-3">
            <input name="batchId" type="hidden" value={batch.id} />
            <button
              className="min-h-11 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-slate-950"
              type="submit"
            >
              Processar documentos
            </button>
          </form>
        </div>
      ) : null}

      {editable ? (
        <form
          action={archiveImportBatchAction}
          className="mt-7 flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-5"
        >
          <input name="batchId" type="hidden" value={batch.id} />
          <input name="lockVersion" type="hidden" value={batch.lockVersion} />
          <input
            aria-label="Motivo do arquivamento"
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            name="reason"
            placeholder="Motivo do arquivamento"
            required
          />
          <button
            className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200"
            type="submit"
          >
            Arquivar dossiê
          </button>
        </form>
      ) : null}
    </>
  );
}
