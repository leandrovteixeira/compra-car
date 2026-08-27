import type { ComparisonVehiclePresentationDto } from '@compra-car/contracts';

import { formatProductionModelYears } from '@/application/catalog/vehicle-presentation';

interface ComparisonVehicleHeaderProps {
  readonly vehicle: ComparisonVehiclePresentationDto;
  readonly isReference: boolean;
}

function contentOrFallback(value: string, fallback: string): string {
  return value.trim() || fallback;
}

export function ComparisonVehicleHeader({ vehicle, isReference }: ComparisonVehicleHeaderProps) {
  const brand = contentOrFallback(vehicle.brand, 'Marca não informada');
  const model = contentOrFallback(vehicle.model, 'Modelo não informado');
  const version = contentOrFallback(vehicle.version, 'Versão não informada');
  const years = formatProductionModelYears(vehicle.productionYear, vehicle.modelYear);
  const accessibleName = `${brand} ${model} · ${version} · ${years}`;

  return (
    <div className="min-w-0 py-0.5" title={accessibleName}>
      <span
        className={`inline-flex rounded-full px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[0.08em] ${
          isReference ? 'bg-selection text-text-primary' : 'bg-surface-muted text-text-muted'
        }`}
      >
        {isReference ? 'Principal' : 'Concorrente'}
      </span>
      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-4 text-text-primary min-[769px]:text-sm min-[769px]:leading-5">
        {brand} {model}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[0.6875rem] font-medium leading-4 text-text-secondary min-[769px]:text-xs">
        {version} · {years}
      </p>
    </div>
  );
}
