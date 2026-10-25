import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';

export default function Page() {
  return <main className="min-w-0 text-text-primary">
    <CatalogPageHeading title="Chat" description="Canal de atendimento em preparação." />
    <div className="mt-3 rounded-lg border border-[#D6DEE3] bg-white p-8 text-center">
      <p className="text-base font-semibold">Em breve</p>
      <p className="mt-1 text-sm text-[#61747B]">Esta funcionalidade ainda não está disponível.</p>
    </div>
  </main>;
}
