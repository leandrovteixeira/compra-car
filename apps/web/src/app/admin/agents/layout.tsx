import type { ReactNode } from 'react';
import { requireFeature23C } from '@/auth/account-tier-server';

export default async function AgentsMasterLayout({ children }: { readonly children: ReactNode }) {
  await requireFeature23C('agents');
  return children;
}
