export type GoldenFactType =
  | 'public_price'
  | 'promotional_price'
  | 'bonus'
  | 'discount'
  | 'trade_in'
  | 'financing_rate'
  | 'financing_down_payment'
  | 'financing_installments'
  | 'grace_period'
  | 'registration_bonus'
  | 'wallbox'
  | 'charging'
  | 'insurance'
  | 'channel_rule';

export interface GoldenCommercialFact {
  readonly id: string;
  readonly document: 'BYD 202606-01.pdf' | 'Geely 202602-01.pdf' | 'GWM 202603-01.pdf' | 'Jeep 202606-01.pdf';
  readonly page: number;
  readonly channel: string;
  readonly model: string;
  readonly version?: string;
  readonly productionYear?: number;
  readonly modelYear?: number;
  readonly factType: GoldenFactType;
  readonly value: string;
  readonly unit: 'BRL' | 'percent' | 'months' | 'days' | 'text';
  readonly evidence: string;
  readonly critical: boolean;
}

export interface GoldenOfferComposition {
  readonly id: string;
  readonly document: GoldenCommercialFact['document'];
  readonly page: number;
  readonly channel: string;
  readonly model: string;
  readonly version?: string;
  readonly relation: 'AND' | 'OR';
  readonly memberFactIds: readonly string[];
  readonly evidence: string;
}

/**
 * Human-audited facts from the four real letters used as the Sprint 10R acceptance corpus.
 * This fixture intentionally records documentary semantics, not database rows.
 * Values are normalized only when the source meaning is explicit.
 */
export const COMMERCIAL_LETTER_GOLDEN_FACTS: readonly GoldenCommercialFact[] = [
  // Jeep — channel + de/por + alternatives (p.6)
  { id: 'jeep-compass-vd-channel', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'channel_rule', value: 'VD-CPF / categoria 36', unit: 'text', evidence: 'VENDAS DIRETAS PARA CPF - CATEGORIA 36', critical: true },
  { id: 'jeep-compass-vd-reference-price', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'public_price', value: '174990', unit: 'BRL', evidence: 'de R$ 174.990 por R$ 147.990', critical: true },
  { id: 'jeep-compass-vd-customer-price', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'promotional_price', value: '147990', unit: 'BRL', evidence: 'PREÇO CLIENTE: R$ 147.990', critical: true },
  { id: 'jeep-compass-vd-discount', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'discount', value: '15.5', unit: 'percent', evidence: 'DESCONTO de até: 15,5%', critical: true },
  { id: 'jeep-compass-vd-tradein', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'trade_in', value: '3000', unit: 'BRL', evidence: 'Bônus de Trade-In no valor de R$ 3.000', critical: true },
  { id: 'jeep-compass-vd-tradein-pack', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport + Pack Tech', productionYear: 2026, modelYear: 2026, factType: 'trade_in', value: '9000', unit: 'BRL', evidence: 'TRADE-IN TOTAL de R$ 9.000', critical: true },
  { id: 'jeep-compass-vd-fin-rate', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'financing_rate', value: '0', unit: 'percent', evidence: 'Taxa 0% com 60% de entrada em 24x', critical: true },
  { id: 'jeep-compass-vd-fin-down', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'financing_down_payment', value: '60', unit: 'percent', evidence: 'Taxa 0% com 60% de entrada em 24x', critical: true },
  { id: 'jeep-compass-vd-fin-term', document: 'Jeep 202606-01.pdf', page: 6, channel: 'VD-CPF', model: 'Compass', version: 'Sport', productionYear: 2026, modelYear: 2026, factType: 'financing_installments', value: '24', unit: 'months', evidence: 'Taxa 0% com 60% de entrada em 24x', critical: true },

  // Jeep retail — explicit retail bonus / trade-in / financing
  { id: 'jeep-renegade-longitude-retail-tradein', document: 'Jeep 202606-01.pdf', page: 10, channel: 'VAREJO', model: 'Renegade', version: 'Longitude T270 MHEV', productionYear: 2026, modelYear: 2027, factType: 'trade_in', value: '6000', unit: 'BRL', evidence: 'LONGITUDE T270 MHEV ... 6.000', critical: true },
  { id: 'jeep-renegade-longitude-retail-fin-rate', document: 'Jeep 202606-01.pdf', page: 10, channel: 'VAREJO', model: 'Renegade', version: 'Longitude T270 MHEV', productionYear: 2026, modelYear: 2027, factType: 'financing_rate', value: '0', unit: 'percent', evidence: '0%/50%/30x ou 0%/60%/36x', critical: true },
  { id: 'jeep-renegade-longitude-retail-bonus-my26', document: 'Jeep 202606-01.pdf', page: 11, channel: 'VAREJO', model: 'Renegade', version: 'Longitude', productionYear: 2025, modelYear: 2026, factType: 'bonus', value: '26500', unit: 'BRL', evidence: 'LONGITUDE 611.1LH.1 26.500', critical: true },

  // Geely — options and shared benefits
  { id: 'geely-ex2-pro-msrp', document: 'Geely 202602-01.pdf', page: 3, channel: 'VAREJO', model: 'EX2', version: 'PRO', factType: 'public_price', value: '119990', unit: 'BRL', evidence: 'Preço Público Sugerido R$ 119.990', critical: true },
  { id: 'geely-ex2-pro-fin-rate', document: 'Geely 202602-01.pdf', page: 3, channel: 'VAREJO', model: 'EX2', version: 'PRO', factType: 'financing_rate', value: '0', unit: 'percent', evidence: 'Financiamento 0,00% | 24x | 60%', critical: true },
  { id: 'geely-ex2-pro-fin-down', document: 'Geely 202602-01.pdf', page: 3, channel: 'VAREJO', model: 'EX2', version: 'PRO', factType: 'financing_down_payment', value: '60', unit: 'percent', evidence: 'Financiamento 0,00% | 24x | 60%', critical: true },
  { id: 'geely-ex2-pro-fin-term', document: 'Geely 202602-01.pdf', page: 3, channel: 'VAREJO', model: 'EX2', version: 'PRO', factType: 'financing_installments', value: '24', unit: 'months', evidence: 'Financiamento 0,00% | 24x | 60%', critical: true },
  { id: 'geely-ex2-grace', document: 'Geely 202602-01.pdf', page: 3, channel: 'VAREJO', model: 'EX2', factType: 'grace_period', value: '90', unit: 'days', evidence: '0,35% 24 60% 90 dias', critical: true },
  { id: 'geely-ex5-pro-msrp', document: 'Geely 202602-01.pdf', page: 4, channel: 'VAREJO', model: 'EX5', version: 'PRO', factType: 'public_price', value: '205800', unit: 'BRL', evidence: 'Preço Público Sugerido R$ 205.800', critical: true },
  { id: 'geely-ex5-pro-bonus-opt1', document: 'Geely 202602-01.pdf', page: 4, channel: 'VAREJO', model: 'EX5', version: 'PRO', factType: 'bonus', value: '25000', unit: 'BRL', evidence: 'Bônus Varejo R$ 25.000', critical: true },
  { id: 'geely-ex5-pro-bonus-opt2', document: 'Geely 202602-01.pdf', page: 4, channel: 'VAREJO', model: 'EX5', version: 'PRO', factType: 'bonus', value: '10000', unit: 'BRL', evidence: 'Bônus Varejo ... R$ 10.000', critical: true },
  { id: 'geely-ex5-pro-registration', document: 'Geely 202602-01.pdf', page: 4, channel: 'VAREJO', model: 'EX5', version: 'PRO', factType: 'registration_bonus', value: '4000', unit: 'BRL', evidence: 'Bônus Emplacamento R$ 4.000', critical: true },
  { id: 'geely-ex5-pro-wallbox', document: 'Geely 202602-01.pdf', page: 4, channel: 'VAREJO', model: 'EX5', version: 'PRO', factType: 'wallbox', value: 'Wallbox ou 1 ano Recarga', unit: 'text', evidence: 'Wallbox ou 1 ano Recarga Incluso', critical: true },

  // GWM — three-way composition
  { id: 'gwm-h6-phev19-2525-msrp', document: 'GWM 202603-01.pdf', page: 3, channel: 'VAREJO', model: 'Haval H6', version: 'PHEV19', productionYear: 2025, modelYear: 2025, factType: 'public_price', value: '245000', unit: 'BRL', evidence: 'HAVAL H6 PHEV19 Preço R$ 245.000', critical: true },
  { id: 'gwm-h6-phev19-2525-fin', document: 'GWM 202603-01.pdf', page: 3, channel: 'VAREJO', model: 'Haval H6', version: 'PHEV19', productionYear: 2025, modelYear: 2025, factType: 'financing_rate', value: '0', unit: 'percent', evidence: 'Tx ZERO / 60% / 36x', critical: true },
  { id: 'gwm-h6-phev19-2525-down', document: 'GWM 202603-01.pdf', page: 3, channel: 'VAREJO', model: 'Haval H6', version: 'PHEV19', productionYear: 2025, modelYear: 2025, factType: 'financing_down_payment', value: '60', unit: 'percent', evidence: 'Tx ZERO / 60% / 36x', critical: true },
  { id: 'gwm-h6-phev19-2525-term', document: 'GWM 202603-01.pdf', page: 3, channel: 'VAREJO', model: 'Haval H6', version: 'PHEV19', productionYear: 2025, modelYear: 2025, factType: 'financing_installments', value: '36', unit: 'months', evidence: 'Tx ZERO / 60% / 36x', critical: true },
  { id: 'gwm-h6-phev19-2525-tradein', document: 'GWM 202603-01.pdf', page: 3, channel: 'VAREJO', model: 'Haval H6', version: 'PHEV19', productionYear: 2025, modelYear: 2025, factType: 'trade_in', value: '20000', unit: 'BRL', evidence: '+ 20.000 Trade-in', critical: true },
  { id: 'gwm-h6-phev19-2525-insurance', document: 'GWM 202603-01.pdf', page: 3, channel: 'VAREJO', model: 'Haval H6', version: 'PHEV19', productionYear: 2025, modelYear: 2025, factType: 'insurance', value: '1 ano de seguro', unit: 'text', evidence: '1 ano de seguro', critical: true },
  { id: 'gwm-ora-skin-price', document: 'GWM 202603-01.pdf', page: 2, channel: 'VAREJO', model: 'ORA 03', version: 'SKIN BEV48', productionYear: 2025, modelYear: 2026, factType: 'public_price', value: '169000', unit: 'BRL', evidence: 'Preço R$ 169.000 → R$ 154.000', critical: true },
  { id: 'gwm-ora-skin-promo', document: 'GWM 202603-01.pdf', page: 2, channel: 'VAREJO', model: 'ORA 03', version: 'SKIN BEV48', productionYear: 2025, modelYear: 2026, factType: 'promotional_price', value: '154000', unit: 'BRL', evidence: 'Preço R$ 169.000 → R$ 154.000', critical: true },
  { id: 'gwm-ora-skin-bonus', document: 'GWM 202603-01.pdf', page: 2, channel: 'VAREJO', model: 'ORA 03', version: 'SKIN BEV48', productionYear: 2025, modelYear: 2026, factType: 'bonus', value: '15000', unit: 'BRL', evidence: '(Bônus de R$ 15K na NF)', critical: true },

  // BYD — dense summary + channel separation
  { id: 'byd-dolphin-gs-2526-msrp', document: 'BYD 202606-01.pdf', page: 14, channel: 'VAREJO', model: 'Dolphin', version: 'GS', productionYear: 2025, modelYear: 2026, factType: 'public_price', value: '149990', unit: 'BRL', evidence: 'DOLPHIN GS 25/26* R$ 149.990', critical: true },
  { id: '