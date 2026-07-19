import type {
  ComparisonCategoryPresentationDto,
  ComparisonVehiclePresentationDto,
} from '@compra-car/contracts';

interface ComparisonTableProps {
  readonly vehicles: readonly ComparisonVehiclePresentationDto[];
  readonly categories: readonly ComparisonCategoryPresentationDto[];
  readonly onlyDifferences: boolean;
}

export function ComparisonTable({ vehicles, categories, onlyDifferences }: ComparisonTableProps) {
  if (categories.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-slate-300">
        {onlyDifferences
          ? 'Nenhuma diferença foi encontrada entre os veículos selecionados.'
          : 'Não há itens de comparação disponíveis para esta seleção.'}
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      {categories.map((category) => (
        <section aria-labelledby={`category-${category.name}`} key={category.name}>
          <h2
            className="mb-3 text-xl font-semibold tracking-tight"
            id={`category-${category.name}`}
          >
            {category.name}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[760px] border-collapse bg-slate-900 text-left">
              <caption className="sr-only">Comparação da categoria {category.name}</caption>
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900">
                  <th
                    className="sticky left-0 z-20 min-w-56 bg-slate-900 p-4 text-sm font-semibold text-slate-300"
                    scope="col"
                  >
                    Item
                  </th>
                  {vehicles.map((vehicle) => (
                    <th className="min-w-48 p-4 align-top" key={vehicle.id} scope="col">
                      <span className="block text-sm font-semibold text-cyan-400">
                        {vehicle.brand} {vehicle.model}
                      </span>
                      <span className="mt-1 block text-sm font-medium">{vehicle.version}</span>
                      <span className="mt-1 block text-xs font-normal text-slate-400">
                        Ano-modelo {vehicle.modelYear}
                      </span>
                      <span className="block text-xs font-normal text-slate-500">
                        Produção {vehicle.productionYear}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {category.rows.map((row) => (
                  <tr
                    className={`border-b border-slate-800 last:border-b-0 ${
                      row.isDifferent ? 'bg-cyan-950/20' : ''
                    }`}
                    key={row.code}
                  >
                    <th
                      className={`sticky left-0 z-10 p-4 align-top ${
                        row.isDifferent ? 'bg-slate-800' : 'bg-slate-900'
                      }`}
                      scope="row"
                    >
                      <span className="block text-sm font-medium">{row.label}</span>
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        {row.equipmentGroup}
                      </span>
                      {row.isDifferent ? (
                        <span className="mt-2 inline-flex rounded-full bg-cyan-400/15 px-2 py-1 text-xs font-semibold text-cyan-300">
                          Diferente
                        </span>
                      ) : null}
                    </th>
                    {row.values.map((value, index) => (
                      <td
                        className="p-4 text-sm font-medium text-slate-100"
                        key={vehicles[index]?.id}
                      >
                        {value.displayValue}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
