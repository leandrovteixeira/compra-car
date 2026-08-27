import { ModuleCard } from '@/components/admin/module-card';
import { PageHeader } from '@/components/admin/page-header';

export default function AdminPage() {
  return (
    <>
      <PageHeader
        description="O painel administrativo está em construção. Os módulos serão entregues de forma incremental, mantendo as regras de acesso e os contratos do projeto."
        eyebrow="Visão geral"
        title="Administração"
      />

      <section aria-labelledby="admin-modules-title" className="mt-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-100" id="admin-modules-title">
            Módulos
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Próximo módulo: <strong className="text-slate-200">Cadastro de veículos</strong>
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            description="Estrutura inicial para o futuro cadastro e manutenção do catálogo."
            href="/admin/products"
            status="Próxima etapa"
            title="Cadastro de veículos"
          />
          <ModuleCard
            description="Consulta somente leitura do histórico versionado de preços públicos por veículo."
            href="/admin/prices"
            status="Leitura disponível"
            title="Preços públicos"
          />
          <ModuleCard
            description="Organização de equipamentos e categorias será definida em etapa posterior."
            status="Em breve"
            title="Catálogo auxiliar"
          />
          <ModuleCard
            description="Gestão de acesso permanece fora do escopo deste marco."
            status="Planejado"
            title="Usuários e configurações"
          />
        </div>
      </section>
    </>
  );
}
