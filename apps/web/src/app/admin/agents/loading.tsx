import Image from 'next/image';

/** Shared loading loop for Reviews and Flight Control. */
export default function LoadingAgents() {
  return (
    <div role="status" aria-label="Carregando Agentes" aria-live="polite"
      className="flex min-h-[55dvh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid size-24 place-items-center">
          <span aria-hidden="true"
            className="absolute inset-0 animate-spin rounded-2xl border-2 border-[#9ABCC8]/30 border-t-[#EF7732]"/>
          <Image src="/carboot/icon_logo_official.svg" alt=""
            width={55} height={55} className="animate-pulse"/>
        </div>
        <p className="text-sm font-medium text-[#61747B]">Carregando revisões…</p>
      </div>
    </div>
  );
}
