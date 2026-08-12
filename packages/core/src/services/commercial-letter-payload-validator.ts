import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import {
  CommercialLetterPayloadValidationError,
  IMPORT_PROCESSING_MAX_PAYLOAD_BYTES,
  validateCommercialLetterInvariants,
} from './import-processing';

const byteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;
const safeErrors = (errors: readonly ErrorObject[] | null | undefined): readonly string[] =>
  (errors ?? []).slice(0, 20).map((error) => `${error.instancePath || '/'}: ${error.keyword}`);

const isIsoCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export function createCommercialLetterPayloadValidator(
  schema: Readonly<Record<string, unknown>>,
): (payload: unknown) => void {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
  ajv.addFormat('date', isIsoCalendarDate);
  const validate: ValidateFunction = ajv.compile(schema);
  return (payload: unknown) => {
    if (byteLength(payload) > IMPORT_PROCESSING_MAX_PAYLOAD_BYTES)
      throw new CommercialLetterPayloadValidationError(['/: maxPayloadBytes']);
    if (!validate(payload))
      throw new CommercialLetterPayloadValidationError(safeErrors(validate.errors));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new CommercialLetterPayloadValidationError(['/: type']);
    validateCommercialLetterInvariants(payload as Record<string, unknown>);
  };
}
