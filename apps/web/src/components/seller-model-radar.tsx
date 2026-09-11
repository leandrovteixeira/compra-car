import type { SellerCategoryScore } from '@/server/seller-model-score-service';

interface SellerModelRadarProps {
  readonly categories: readonly SellerCategoryScore[];
}

function point(index: number, total: number, value: number, radius = 112) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  const r = radius * value;
  return [150 + Math.cos(angle) * r, 150 + Math.sin(angle) * r] as const;
}

export function SellerModelRadar({ categories }: SellerModelRadarProps) {
  const total = categories.length;
  if (!total) return null;

  const grid = [0.25, 0.5, 0.75, 1].map((level) =>
    categories.map((_, index) => point(index, total, level).join(',')).join(' '),
  );
  const polygon = categories
    .map((category, index) => point(index, total, (category.score ?? 0) / 10).join(','))
    .join(' ');

  return (
    <div className="ui-surface flex min-h-0 flex-col overflow-hidden !p-4">
      <div className="mb-1">
        <h2 className="text-base font-semibold">Radar de valor percebido</h2>
        <p className="text-xs text-text-muted">Notas relativas aos modelos no raio de preço selecionado.</p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <svg aria-label="Radar de notas por categoria" className="block h-auto max-h-[24rem] w-full max-w-[36rem]" viewBox="0 0 300 300" role="img">
          {grid.map((points, index) => (
            <polygon key={index} points={points} fill="none" stroke="currentColor" className="text-border" strokeWidth="1" />
          ))}
          {categories.map((_, index) => {
            const [x, y] = point(index, total, 1);
            return <line key={index} x1="150" y1="150" x2={x} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />;
          })}
          <polygon points={polygon} fill="color-mix(in srgb, var(--color-selection-strong) 28%, transparent)" stroke="var(--color-interactive)" strokeWidth="2" />
          {categories.map((category, index) => {
            const [x, y] = point(index, total, 1.14);
            return (
              <text key={category.key} x={x} y={y} textAnchor={x < 135 ? 'end' : x > 165 ? 'start' : 'middle'} dominantBaseline="middle" className="fill-text-secondary text-[7px] font-semibold">
                {category.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
