import { describe, expect, it, vi } from 'vitest';
import {
  approveInviteRequest,
  createInviteRequest,
  rejectInviteRequest,
  type InviteRequestDependencies,
} from '../src/application/invite-requests';
const request = {
  id: '1',
  requestedBy: 'seller',
  inviteeName: 'Maria Silva',
  inviteeEmail: 'maria@example.com',
  status: 'pending' as const,
  createdAt: '2026-08-24T00:00:00Z',
  reviewedAt: null,
  reviewedBy: null,
};
function deps(): InviteRequestDependencies {
  const repo = {
    create: vi.fn(async () => request),
    listMine: vi.fn(async () => [request]),
    listPending: vi.fn(async () => [request]),
    get: vi.fn(async () => request),
    review: vi.fn(async () => true),
  };
  const users = {
    countActiveAdmins: vi.fn(async () => 2),
    findAdminUserByEmail: vi.fn(async () => null),
    getAdminUser: vi.fn(async () => null),
    inviteAdminUser: vi.fn(async () => 'id'),
    requestPasswordRecovery: vi.fn(),
    setAdminUserRole: vi.fn(),
    setAdminUserStatus: vi.fn(),
  };
  return {
    authorizeActive: vi.fn(async () => ({ user: { id: 'seller' } })),
    authorizeAdmin: vi.fn(async () => ({ user: { id: 'admin' } })),
    repository: () => repo,
    users: () => users,
    adminInviteDependencies: {
      authorize: vi.fn(async () => ({ user: { id: 'admin' } })),
      createManager: () => users,
      inviteRedirectUrl: () => 'https://app.test/invite',
      recoveryRedirectUrl: () => '',
      revalidate: vi.fn(),
    },
    revalidate: vi.fn(),
  };
}
const form = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, x] of Object.entries(v)) f.set(k, x);
  return f;
};
describe('invite requests', () => {
  it('normalizes and creates for authenticated actor without role input', async () => {
    const d = deps();
    expect(
      await createInviteRequest(
        form({ name: '  Maria   Silva ', email: ' MARIA@EXAMPLE.COM ', role: 'admin' }),
        d,
      ),
    ).toMatchObject({ status: 'success' });
    expect(d.repository(false).create).toHaveBeenCalledWith(
      'seller',
      'Maria Silva',
      'maria@example.com',
    );
  });
  it('rejects malformed, existing and duplicate requests', async () => {
    const d = deps();
    expect(await createInviteRequest(form({ name: '', email: 'bad' }), d)).toMatchObject({
      status: 'error',
    });
    vi.mocked(d.users().findAdminUserByEmail).mockResolvedValue({} as never);
    expect(await createInviteRequest(form({ name: 'Maria', email: 'm@e.com' }), d)).toMatchObject({
      message: expect.stringContaining('Já existe um usuário'),
    });
    const d2 = deps();
    vi.mocked(d2.repository(false).create).mockRejectedValue(new Error('INVITE_REQUEST_DUPLICATE'));
    expect(await createInviteRequest(form({ name: 'Maria', email: 'm@e.com' }), d2)).toMatchObject({
      message: expect.stringContaining('pedido pendente'),
    });
  });
  it('approves only pending after shared seller invitation and records server reviewer', async () => {
    const d = deps();
    expect(await approveInviteRequest(form({ requestId: '1', role: 'admin' }), d)).toMatchObject({
      status: 'success',
    });
    expect(d.users().inviteAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'seller' }),
    );
    expect(d.repository(true).review).toHaveBeenCalledWith('1', 'approved', 'admin');
  });
  it('keeps pending when invite fails or existing user makes request stale', async () => {
    const d = deps();
    vi.mocked(d.users().inviteAdminUser).mockRejectedValue(new Error('fail'));
    expect(await approveInviteRequest(form({ requestId: '1' }), d)).toMatchObject({
      status: 'error',
    });
    expect(d.repository(true).review).not.toHaveBeenCalled();
    const d2 = deps();
    vi.mocked(d2.users().findAdminUserByEmail).mockResolvedValue({} as never);
    expect(await approveInviteRequest(form({ requestId: '1' }), d2)).toMatchObject({
      message: expect.stringContaining('Já existe'),
    });
  });
  it('reports partial/concurrent review and rejects pending only', async () => {
    const d = deps();
    vi.mocked(d.repository(true).review).mockResolvedValue(false);
    expect(await approveInviteRequest(form({ requestId: '1' }), d)).toMatchObject({
      message: expect.stringContaining('convite foi enviado'),
    });
    expect(await rejectInviteRequest(form({ requestId: '1' }), d)).toMatchObject({
      message: expect.stringContaining('já foi analisado'),
    });
  });
  it('does not continue when authorization rejects', async () => {
    const d = {
      ...deps(),
      authorizeActive: vi.fn(async () => {
        throw new Error('denied');
      }),
    };
    await expect(createInviteRequest(form({ name: 'Maria', email: 'm@e.com' }), d)).rejects.toThrow(
      'denied',
    );
  });
});
