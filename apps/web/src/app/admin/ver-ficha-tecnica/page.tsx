import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { requireRole } from '@/auth/authorization';
import { loadCurrentModelCards } from '@/server/public-model-catalog';
import { CurrentModelCards } from '@/components/admin/current-model-cards';

export default async function ViewModelCardsPage() {
  await requireRole('admin');
  const cards = await loadCurrentModelCards();
  return (
    <section className="min-h-[calc(100dvh-6rem)]">
      <CatalogPageHeading title="Fichas Técnicas" description="Escolha a marca e o modelo para consultar as versões atuais." />
      <CurrentModelCards cards={cards} />
    </section>
  );
}
