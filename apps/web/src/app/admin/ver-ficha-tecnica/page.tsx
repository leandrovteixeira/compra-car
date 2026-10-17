import { requireRole } from '@/auth/authorization';
import { loadCurrentModelCards } from '@/server/public-model-catalog';
import { CurrentModelCards } from '@/components/admin/current-model-cards';

export default async function ViewModelCardsPage() {
  await requireRole('admin');
  const cards = await loadCurrentModelCards();
  return (
    <section className="min-h-[calc(100dvh-6rem)]">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1A1D21]">Fichas Técnicas</h1>
        <p className="mt-1 text-sm text-[#61747B]">Escolha a marca e o modelo para consultar as versões atuais.</p>
      </header>
      <CurrentModelCards cards={cards} />
    </section>
  );
}
