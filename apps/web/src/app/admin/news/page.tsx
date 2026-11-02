import 'server-only';

import Link from 'next/link';
import { getNewsCover } from '@/server/news-cover';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';

export const dynamic = 'force-dynamic';

type Query = { q?: string; status?: string; page?: string };
type NewsRow = {
  id: string;
  first_observed_at: string;
  item_payload: { title?: string; url?: string; excerpt?: string } | null;
};
type Analysis = {
  revision_id: string;
  state: string;
  events: unknown;
  launches: unknown;
  failure_code: string | null;
};
const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}
function analysisLabel(state?: string) {
  if (state === 'COMPLETED') return 'Analisada';
  if (state === 'FAILED') return 'Falha na IA';
  if (state === 'RUNNING') return 'Processando';
  return 'Pendente';
}
function eventCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export default async function NewsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}) {
  await requireRole('admin');
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const status = ['all', 'COMPLETED', 'FAILED', 'PENDING'].includes(params.status ?? '')
    ? params.status! : 'all';
  const requested = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 10000) : 1;

  if (process.env.APP_ENV !== 'qa') {
    return <main className="min-w-0 text-text-primary">
      <CatalogPageHeading title="News" description="Notícias e inteligência do mercado automotivo." />
      <div className="mt-4 rounded-lg border border-[#D6DEE3] bg-white p-6 text-sm text-[#61747B]">
        O painel de notícias está disponível apenas no ambiente QA nesta etapa.
      </div>
    </main>;
  }

  const client = createPrivilegedAdminClient();
  const { data: articles, error: articlesError } = await client
    .from('watcher_article_revisions')
    .select('id,first_observed_at,item_payload')
    .order('first_observed_at', { ascending: false })
    .limit(500);
  const items = (articles ?? []) as NewsRow[];
  const { data: analyses, error: analysisError } = await client
    .from('watcher_ai_revision_jobs')
    .select('revision_id,state,events,launches,failure_code')
    .in('revision_id', items.length ? items.map((i) => i.id) : ['00000000-0000-0000-0000-000000000000']);
  const byRevision = new Map(((analyses ?? []) as Analysis[]).map((a) => [a.revision_id, a]));
  const filtered = items.filter((article) => {
    const ai = byRevision.get(article.id);
    const matchesStatus = status === 'all' ||
      (status === 'PENDING' ? !ai || ai.state === 'RUNNING' : ai?.state === status);
    const haystack = [article.item_payload?.title, article.item_payload?.excerpt].join(' ').toLocaleLowerCase('pt-BR');
    return matchesStatus && (!q || haystack.includes(q.toLocaleLowerCase('pt-BR')));
  });
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const covers = await Promise.all(visible.map((article) => getNewsCover(article.item_payload?.url)));
  const coverById = new Map(visible.map((article, index) => [article.id, covers[index]]));
  const counts = {
    total: items.length,
    completed: items.filter((i) => byRevision.get(i.id)?.state === 'COMPLETED').length,
    failed: items.filter((i) => byRevision.get(i.id)?.state === 'FAILED').length,
  };
  const linkFor = (nextPage: number) => '/admin/news?' + new URLSearchParams({
    ...(q ? { q } : {}), ...(status !== 'all' ? { status } : {}), page: String(nextPage),
  }).toString();

  return <main className="min-w-0 space-y-4 text-text-primary">
    <CatalogPageHeading title="News" description="Notícias coletadas pelo Watcher, com extrações da IA e links para as fontes." />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { value: counts.total, label: 'Notícias coletadas' },
        { value: counts.completed, label: 'Analisadas pela IA' },
        { value: counts.failed, label: 'Falhas de interpretação' },
      ].map((metric) => <div key={metric.label} className="rounded-lg border border-[#D6DEE3] bg-white px-5 py-4">
        <div className="text-2xl font-semibold text-[#1A1D21]">{metric.value}</div>
        <div className="text-xs text-[#61747B]">{metric.label}</div>
      </div>)}
    </div>
    <form action="/admin/news" method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-[#D6DEE3] bg-white p-4">
      <label className="min-w-[220px] flex-1 text-xs text-[#526670]">
        Buscar notícias
        <input name="q" defaultValue={q} placeholder="Título ou conteúdo" maxLength={100}
          className="mt-1 block w-full rounded-md border border-[#D6DEE3] px-3 py-2 text-sm text-[#1A1D21]" />
      </label>
      <label className="text-xs text-[#526670]">
        Análise
        <select name="status" defaultValue={status}
          className="mt-1 block rounded-md border border-[#D6DEE3] bg-white px-3 py-2 text-sm text-[#1A1D21]">
          <option value="all">Todas</option>
          <option value="COMPLETED">Analisadas</option>
          <option value="PENDING">Pendentes</option>
          <option value="FAILED">Com falha</option>
        </select>
      </label>
      <button type="submit" className="rounded-md bg-[#1A1D21] px-4 py-2 text-sm font-medium text-white">Filtrar</button>
      <Link href="/admin/news" className="px-2 py-2 text-sm text-[#526670] underline">Limpar</Link>
    </form>
    {articlesError || analysisError ? (
      <div role="alert" className="rounded-lg border border-[#EF7732] bg-white p-5 text-sm">
        Não foi possível consultar os dados do Watcher. Tente novamente mais tarde.
      </div>
    ) : <div className="overflow-hidden rounded-lg border border-[#D6DEE3] bg-white">
      {visible.length === 0 ? <p className="p-8 text-center text-sm text-[#61747B]">Nenhuma notícia encontrada.</p> : (
        <div className="divide-y divide-[#E6EBEE]">
          {visible.map((article) => {
            const ai = byRevision.get(article.id);
            const title = article.item_payload?.title || 'Notícia sem título';
            const sourceUrl = article.item_payload?.url;
            const safeUrl = sourceUrl && /^https:\/\//i.test(sourceUrl) ? sourceUrl : null;
            return <article key={article.id} className="flex gap-4 p-4 transition-colors hover:bg-[#F7F9FA] sm:p-5">
              {coverById.get(article.id) ? <img src={coverById.get(article.id)!} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-24 w-32 shrink-0 rounded-md bg-[#F0F3F5] object-cover sm:h-28 sm:w-44" /> : <div aria-hidden="true" className="flex h-24 w-32 shrink-0 items-center justify-center rounded-md bg-[#F0F3F5] text-xs text-[#61747B] sm:h-28 sm:w-44">News</div>}
              <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#61747B]">
                <span>Motor1 Brasil</span><span>·</span><time dateTime={article.first_observed_at}>{formatDate(article.first_observed_at)}</time>
                <span className={`rounded px-2 py-0.5 font-medium ${ai?.state === 'COMPLETED' ? 'bg-[#E8F4EF] text-[#237350]' : ai?.state === 'FAILED' ? 'bg-[#FFF1E7] text-[#B85C1B]' : 'bg-[#F0F3F5] text-[#526670]'}`}>{analysisLabel(ai?.state)}</span>
              </div>
              <h2 className="text-base font-semibold text-[#1A1D21]">{title}</h2>
              {article.item_payload?.excerpt ? <p className="mt-1 text-sm text-[#61747B]">{article.item_payload.excerpt}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#526670]">
                {ai?.state === 'COMPLETED' && <>
                  <span>{eventCount(ai.events)} eventos extraídos</span>
                  <span>{eventCount(ai.launches)} candidatos a lançamento</span>
                </>}
                {ai?.state === 'FAILED' && <span>Erro: {ai.failure_code ?? 'não informado'}</span>}
                {safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#B85C1B] underline">Ler na fonte original ↗</a>}
              </div>
              </div>
            </article>;
          })}
        </div>
      )}
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#61747B]">
      <span>{filtered.length} resultado(s) · Página {page}</span>
      <nav aria-label="Paginação de notícias" className="flex items-center gap-4">
        {page > 1 && <Link href={linkFor(page - 1)} className="underline">Anterior</Link>}
        {page * PAGE_SIZE < filtered.length && <Link href={linkFor(page + 1)} className="underline">Próxima</Link>}
      </nav>
    </div>
    <p className="text-xs text-[#61747B]">Fonte inicial: Motor1 Brasil. Resultados de IA são indícios para revisão, não confirmação de lançamentos.</p>
  </main>;
}
