import { describe, expect, it, vi } from 'vitest';
import { UpdateAdministrativeVehicleStatus } from '../src';

describe('UpdateAdministrativeVehicleStatus', () => {
  it.each([{ isActive: true }, { isActive: false }, { isPublic: true }, { isPublic: false }])(
    'forwards only %j',
    async (patch) => {
      const updateAdministrativeVehicleStatus = vi.fn(async () => ({ status: 'updated' as const }));
      expect(
        await new UpdateAdministrativeVehicleStatus({ updateAdministrativeVehicleStatus }).execute(
          '42',
          patch,
        ),
      ).toEqual({ ok: true });
      expect(updateAdministrativeVehicleStatus).toHaveBeenCalledExactlyOnceWith('42', patch);
    },
  );

  it.each(['', ' ', '0', '-1', '1.2', '1e2', 'abc', '9007199254740992'])(
    'rejects ID %j without writing',
    async (id) => {
      const updateAdministrativeVehicleStatus = vi.fn();
      expect(
        await new UpdateAdministrativeVehicleStatus({ updateAdministrativeVehicleStatus }).execute(
          id,
          { isPublic: true },
        ),
      ).toEqual({ ok: false, code: 'INVALID_STATUS_UPDATE' });
      expect(updateAdministrativeVehicleStatus).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    [],
    {},
    { isActive: 'true' },
    { isPublic: 1 },
    { is_active: true },
    { isPublic: true, isActive: false },
    { isActive: true, model: 'changed' },
  ])('rejects payload %j without writing', async (patch) => {
    const updateAdministrativeVehicleStatus = vi.fn();
    expect(
      await new UpdateAdministrativeVehicleStatus({ updateAdministrativeVehicleStatus }).execute(
        '42',
        patch,
      ),
    ).toEqual({ ok: false, code: 'INVALID_STATUS_UPDATE' });
    expect(updateAdministrativeVehicleStatus).not.toHaveBeenCalled();
  });

  it('reports missing records and propagates repository failures', async () => {
    const updateAdministrativeVehicleStatus = vi.fn(async () => ({ status: 'not_found' as const }));
    const useCase = new UpdateAdministrativeVehicleStatus({ updateAdministrativeVehicleStatus });
    expect(await useCase.execute('42', { isPublic: true })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
    updateAdministrativeVehicleStatus.mockRejectedValue(new Error('database unavailable'));
    await expect(useCase.execute('42', { isPublic: true })).rejects.toThrow('database unavailable');
  });
});
