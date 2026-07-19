import type { ComparisonVehiclePresentationDto } from '@compra-car/contracts';

interface ComparisonVehicleHeaderProps {
  readonly vehicle: ComparisonVehiclePresentationDto;
  readonly isReference: boolean;
}

function contentOrFallback(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function VehicleArtwork() {
  return (
    <div
      aria-hidden="true"
      className="grid h-8 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-700/70 bg-gradient-to-br from-slate-700/80 via-slate-800 to-slate-950 min-[769px]:h-12 min-[769px]:w-[4.75rem] min-[769px]:rounded-xl"
    >
      <svg
        className="h-6 w-9 text-slate-400 min-[769px]:h-8 min-[769px]:w-14"
        fill="none"
        viewBox="0 0 64 36"
      >
        <path
          d="m12 23 4-9.2A5 5 0 0 1 20.6 11h21.8a5 5 0 0 1 4.3 2.45L52 23"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M8 22.5h48a3 3 0 0 1 3 3V28a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2.5a3 3 0 0 1 3-3Z"
          fill="currentColor"
          fillOpacity=".14"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="16" cy="29" fill="#0f172a" r="4" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="48" cy="29" fill="#0f172a" r="4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    </div>
  );
}

export function ComparisonVehicleHeader({ vehicle, isReference }: ComparisonVehicleHeaderProps) {
  const brand = contentOrFallback(vehicle.brand, 'Marca não informada');
  const model = contentOrFallback(vehicle.model, 'Modelo não informado');
  const version = contentOrFallback(vehicle.version, 'Versão não informada');
  const modelYear = contentOrFallback(vehicle.modelYear, '—');
  const productionYear = contentOrFallback(vehicle.productionYear, '—');

  return (
    <div className="relative min-w-0 py-1">
      <div className="min-w-0 pr-10 min-[769px]:pr-20">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-5 items-center gap-2">
            {isReference ? (
              <span className="inline-flex max-w-full truncate rounded-full border border-cyan-300/15 bg-cyan-300/10 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.08em] text-cyan-200 min-[769px]:px-2 min-[769px]:text-[0.625rem] min-[769px]:tracking-[0.13em]">
                Principal
              </span>
            ) : (
              <span className="truncate text-[0.5rem] font-semibold uppercase tracking-[0.08em] text-slate-500 min-[769px]:text-[0.625rem] min-[769px]:tracking-[0.13em]">
                Concorrente
              </span>
            )}
          </div>
          <span className="mt-1 block truncate text-[0.625rem] font-semibold uppercase tracking-wider text-slate-400 min-[769px]:text-xs">
            {brand}
          </span>
          <span
            className="block truncate text-xs font-semibold text-slate-50 min-[769px]:text-sm"
            title={`${brand} ${model}`}
          >
            {model}
          </span>
        </div>
      </div>
      <div className="absolute right-0 top-0">
        <VehicleArtwork />
      </div>
      <p
        className="mt-1.5 truncate text-[0.625rem] font-medium text-slate-300 min-[769px]:mt-2 min-[769px]:text-xs"
        title={version}
      >
        {version}
      </p>
      <p className="mt-1 line-clamp-2 text-[0.5625rem] font-normal leading-3 text-slate-500 min-[769px]:text-[0.6875rem] min-[769px]:leading-normal">
        Ano {modelYear}
        {productionYear !== '—' && productionYear !== modelYear
          ? ` · Produção ${productionYear}`
          : ''}
      </p>
    </div>
  );
}
