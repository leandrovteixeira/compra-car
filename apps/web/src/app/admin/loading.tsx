/** Shared route-transition fallback. Next.js displays this while admin segments suspend. */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando página" className="flex min-h-[55dvh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid size-20 place-items-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-2xl border-2 border-[#9ABCC8]/30 border-t-[#EF7732] animate-spin" />
          <img src="/carboot/icon_logo_official.svg" alt="" aria-hidden="true" className="size-14 object-contain" />
        </div>
        <span className="text-sm font-medium text-[#61747B]">Carregando...</span>
      </div>
    </div>
  );
}
