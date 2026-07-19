export class LegacyAdapterError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class LegacyAdapterConfigurationError extends LegacyAdapterError {}
export class LegacyAdapterServerOnlyError extends LegacyAdapterError {}
export class LegacyAdapterQueryError extends LegacyAdapterError {}
export class LegacyAdapterMappingError extends LegacyAdapterError {}

export class UnknownLegacySpecTypeError extends LegacyAdapterMappingError {
  constructor(type: unknown, specId: unknown) {
    super(`Tipo de especificação legado desconhecido no spec ${String(specId)}: ${String(type)}.`);
  }
}

export class InvalidLegacyNumericValueError extends LegacyAdapterMappingError {
  constructor(value: unknown, productId: unknown, specId: unknown) {
    super(
      `Valor numérico legado inválido para product ${String(productId)} e spec ${String(specId)}: ${String(value)}.`,
    );
  }
}
