'use server';

import {
  launchSourceMonitor,
  launchForceMmv,
  type AgentLaunchState,
} from '@/application/admin/agent-runner';

export async function launchSourceMonitorAction(
  _state: AgentLaunchState,
  data: FormData,
): Promise<AgentLaunchState> {
  return launchSourceMonitor(data);
}

export async function launchForceMmvAction(
  _state: AgentLaunchState,
  data: FormData,
): Promise<AgentLaunchState> {
  return launchForceMmv(data);
}
