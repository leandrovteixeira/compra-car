import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { CurrentModelCards } from '@/components/admin/current-model-cards';
import { loadCurrentModelCards } from '@/server/public-model-catalog';

export default async function PublicTechnicalSheets() {
  const cards = await loadCurrentModelCards();
  return <main className="min-w-0 px-5 py-6">
    <CatalogPageHeading title="Fichas Técnicas" description="Escolha a marca e o modelo para consultar as versões atuais." />
    <CurrentModelCards cards={cards} basePath="/fichas-tecnicas/modelo" />
  </main>;
}
