import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { requireFeature23C } from '@/auth/account-tier-server';
import { loadCurrentModelCards } from '@/server/public-model-catalog';
import { CurrentModelCards } from '@/components/admin/current-model-cards';

export default async function ViewModelCardsPage() {
  await requireFeature23C('vehicle-specs');
  const cards = await loadCurrentModelCards();
  return (
    <section className="min-h-[calc(100dvh-6rem)]">
      <CatalogPageHeading title="Fichas Técnicas" description="Escolha a marca e o modelo para consultar as versões atuais." />
      <CurrentModelCards cards={cards} />
    </section>
  );
}
