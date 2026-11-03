import Link from 'next/link';

export default function WelcomePage() {
  return <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
    <p className="text-xs font-bold uppercase tracking-[.17em] text-[#EF7732]">Bem-vindo ao Compra Car</p>
    <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">Inteligência automotiva, de forma simples.</h1>
    <p className="mt-4 max-w-2xl text-base text-text-secondary">Explore os modelos disponíveis, conheça equipamentos e compare versões lado a lado. Selecione uma opção no menu para começar.</p>
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      <Link href="/fichas-tecnicas" className="rounded-xl border border-border bg-surface p-6 transition hover:border-[#9ABCC8]">
        <span className="text-xs font-bold uppercase tracking-widest text-[#EF7732]">Explorar</span>
        <h2 className="mt-3 text-xl font-semibold">Fichas Técnicas</h2>
        <p className="mt-2 text-sm text-text-secondary">Conheça modelos, versões e especificações.</p>
      </Link>
      <Link href="/comparar-modelos" className="rounded-xl border border-border bg-surface p-6 transition hover:border-[#9ABCC8]">
        <span className="text-xs font-bold uppercase tracking-widest text-[#EF7732]">Analisar</span>
        <h2 className="mt-3 text-xl font-semibold">Comparar Modelos</h2>
        <p className="mt-2 text-sm text-text-secondary">Selecione os veículos e veja as diferenças.</p>
      </Link>
    </div>
  </div>;
}
