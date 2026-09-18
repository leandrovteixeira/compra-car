import { describe, expect, it, vi } from 'vitest';
import { specSourceReadTransport } from '../src/spec-source-context';
describe('Spec Source capability boundary', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('blocks %s before network', async (method) => {
    const network = vi.fn();
    await expect(
      specSourceReadTransport('https://db.example', network)(
        'https://db.example/rest/v1/products',
        { method },
      ),
    ).rejects.toThrow('SPEC_SOURCE_READ_ONLY_VIOLATION');
    expect(network).not.toHaveBeenCalled();
  });
  it.each(['specs', 'product_specs', 'rpc/activate_brand_connector', 'auth/v1/token'])(
    'blocks forbidden context %s',
    async (table) => {
      const network = vi.fn();
      await expect(
        specSourceReadTransport(
          'https://db.example',
          network,
        )('https://db.example/rest/v1/' + table),
      ).rejects.toThrow('SPEC_SOURCE_READ_ONLY_VIOLATION');
      expect(network).not.toHaveBeenCalled();
    },
  );
  it('permits current catalog GET and forbids automatic redirects', async () => {
    const network = vi.fn(async () => new Response('[]'));
    await specSourceReadTransport(
      'https://db.example',
      network,
    )('https://db.example/rest/v1/products?select=id');
    expect(network).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirect: 'error' }),
    );
  });
  it('rejects other project', async () =>
    await expect(
      specSourceReadTransport('https://db.example')('https://other.example/rest/v1/products'),
    ).rejects.toThrow('SPEC_SOURCE_READ_ONLY_VIOLATION'));
});
