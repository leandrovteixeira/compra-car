import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { CanonicalMmv } from './mmv-apply-contract';
import type {
  CurrentMmvDiscoverySnapshot,
  OfficialProductCandidate,
} from './new-product-check-types';
import type {
  CanonicalMmvModelYear,
  ModelYearFindingDraft,
  ModelYearObservation,
} from './model-year-contract';
import { vehicleBrandComparisonKey } from './vehicle-brand-normalization';

function validYear(value: number | null): value is number {
  return Number.isInteger(value) && value !== null && value >= 2001 && value <= 2100;
}

function versionLabel(candidate: OfficialProductCandidate): string | null {
  const value = candidate.officialVersionLabel ?? candidate.trim;
  return value?.trim() ? value : null;
}

function exactMmvMatches(
  candidate: OfficialProductCandidate,
  mmvs: readonly CanonicalMmv[],
): readonly CanonicalMmv[] {
  const version = versionLabel(candidate);
  if (!version) return [];
  return mmvs.filter(
    (mmv) =>
      mmv.status === 'ACTIVE' &&
      vehicleBrandComparisonKey(mmv.brand) === vehicleBrandComparisonKey(candidate.brand) &&
      key(mmv.model) === key(candidate.model) &&
      key(mmv.officialVersionLabel) === key(version),
  );
}

function sourceUrls(candidate: OfficialProductCandidate): readonly string[] {
  return [...new Set(candidate.evidence.map((item) => item.url))].sort();
}

function yearPairKey(mmvId: string, productionYear: number, modelYear: number): string {
  return [mmvId, productionYear, modelYear].join(':');
}

export class ModelYearAgent {
  run(input: {
    readonly discovery: CurrentMmvDiscoverySnapshot;
    readonly mmvs: readonly CanonicalMmv[];
    readonly knownYears: readonly CanonicalMmvModelYear[];
  }): {
    readonly observations: readonly ModelYearObservation[];
    readonly findings: readonly ModelYearFindingDraft[];
  } {
    const observations: ModelYearObservation[] = [];
    const findings: ModelYearFindingDraft[] = [];
    const known = new Set(
      input.knownYears.map((item) => yearPairKey(item.mmvId, item.productionYear, item.modelYear)),
    );

    for (const candidate of input.discovery.candidates) {
      if (!validYear(candidate.modelYear)) continue;
      const productionYear = validYear(candidate.productionYear)
        ? candidate.productionYear
        : candidate.modelYear;
      if (productionYear !== candidate.modelYear && productionYear !== candidate.modelYear - 1) {
        const version = versionLabel(candidate);
        findings.push({
          findingType: 'PRODUCTION_MODEL_YEAR_CONFLICT',
          reasonCode: 'PRODUCTION_MODEL_YEAR_CONFLICT',
          mmvId: null,
          title: `${candidate.brand} ${candidate.model} ${version ?? ''}: ano fabricação/modelo inconsistente`.trim(),
          summary: `Foi observado ${productionYear}/${candidate.modelYear}, fora da regra brasileira esperada de mesmo ano ou fabricação um ano anterior.`,
          confidence: candidate.confidence,
          requiresReview: true,
          subject: {
            brand: candidate.brand,
            model: candidate.model,
            officialVersionLabel: version,
            productionYear,
            modelYear: candidate.modelYear,
          },
          proposal: null,
          payload: {
            reasonCode: 'PRODUCTION_MODEL_YEAR_CONFLICT',
            operatorMessage: 'Confirme o ano publicado na fonte oficial antes de criar o produto.',
          },
        });
        continue;
      }

      const matches = exactMmvMatches(candidate, input.mmvs);
      if (matches.length !== 1) {
        const version = versionLabel(candidate);
        findings.push({
          findingType: matches.length === 0 ? 'POSSIBLE_NEW_MMV' : 'PRODUCT_YEAR_CONFLICT',
          reasonCode: matches.length === 0 ? 'POSSIBLE_NEW_MMV' : 'MODEL_YEAR_CONFLICT',
          mmvId: null,
          title:
            matches.length === 0
              ? `${candidate.brand} ${candidate.model} ${version ?? ''}: versão não encontrada no registry MMV`.trim()
              : `${candidate.brand} ${candidate.model} ${version ?? ''}: mais de um MMV compatível`.trim(),
          summary:
            matches.length === 0
              ? 'O ano foi encontrado, mas a identidade não deve ser criada pelo agente de Model Year. O caso volta para o fluxo MMV.'
              : 'O ano não pode ser aplicado enquanto a identidade MMV permanecer ambígua.',
          confidence: candidate.confidence,
          requiresReview: true,
          subject: {
            brand: candidate.brand,
            model: candidate.model,
            officialVersionLabel: version,
            productionYear,
            modelYear: candidate.modelYear,
          },
          proposal: null,
          payload: {
            reasonCode: matches.length === 0 ? 'POSSIBLE_NEW_MMV' : 'MODEL_YEAR_CONFLICT',
            matchingMmvIds: matches.map((item) => item.id),
            operatorMessage:
              matches.length === 0
                ? 'Revise primeiro a identidade na fila de MMV.'
                : 'Escolha/corrija o MMV antes de continuar.',
          },
        });
        continue;
      }

      const mmv = matches[0]!;
      const observation: ModelYearObservation = {
        mmvId: mmv.id,
        brand: mmv.brand,
        model: mmv.model,
        officialVersionLabel: mmv.officialVersionLabel,
        productionYear,
        modelYear: candidate.modelYear,
        confidence: candidate.confidence,
        sourceUrls: sourceUrls(candidate),
      };
      observations.push(observation);

      const pair = yearPairKey(mmv.id, productionYear, candidate.modelYear);
      const isNew = !known.has(pair);
      findings.push({
        findingType: 'NEW_PRODUCT_YEAR',
        reasonCode: isNew ? 'NEW_MODEL_YEAR' : 'CONFIRMED_MODEL_YEAR',
        mmvId: mmv.id,
        title: `${mmv.brand} ${mmv.model} ${mmv.officialVersionLabel} — MY${candidate.modelYear}`,
        summary: isNew
          ? `Novo par fabricação/modelo ${productionYear}/${candidate.modelYear} encontrado para um MMV já conhecido.`
          : `O par ${productionYear}/${candidate.modelYear} foi confirmado novamente nas fontes atuais.`,
        confidence: candidate.confidence,
        requiresReview: isNew,
        subject: {
          mmvId: mmv.id,
          brand: mmv.brand,
          model: mmv.model,
          officialVersionLabel: mmv.officialVersionLabel,
          productionYear,
          modelYear: candidate.modelYear,
        },
        proposal: isNew
          ? {
              action: 'STAGE_PRODUCT_YEAR',
              mmvId: mmv.id,
              productionYear,
              modelYear: candidate.modelYear,
              status: 'ACTIVE',
            }
          : null,
        payload: {
          reasonCode: isNew ? 'NEW_MODEL_YEAR' : 'CONFIRMED_MODEL_YEAR',
          operatorMessage: isNew
            ? 'Confirme o ano-modelo. Aceitar apenas registra a decisão; Aplicar cria o vínculo MMV × MY e o produto privado.'
            : 'Nenhuma ação necessária.',
          sourceCount: observation.sourceUrls.length,
        },
      });
    }

    return { observations, findings };
  }
}
