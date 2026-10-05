'use server';

import {
  launchMmvDiscovery,
  type AgentLaunchState,
} from '@/application/admin/agent-runner';

export async function launchMmvDiscoveryAction(
  _state: AgentLaunchState,
  data: FormData,
): Promise<AgentLaunchState> {
  return launchMmvDiscovery(data);
}
