'use server';

import {
  launchSourceMonitor,
  type AgentLaunchState,
} from '@/application/admin/agent-runner';

export async function launchSourceMonitorAction(
  _state: AgentLaunchState,
  data: FormData,
): Promise<AgentLaunchState> {
  return launchSourceMonitor(data);
}
