import 'server-only';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export type AgentHandoffRow = Readonly<{
  id: string;
  taskType: string;
  sourceAgent: string;
  targetAgent: string;
  brand: string;
  model: string;
  versionLabel: string;
  status: string;
  dispatchEnabled: boolean;
  observations: number;
  updatedAt: string;
}>;
export type AgentHandoffSummary = Readonly<{
  total: number;
  queued: number;
  blocked: number;
  completed: number;
  items: readonly AgentHandoffRow[];
}>;
/** Read-only operational introspection. Never triggers dispatch or paid provider calls. */
export async function loadAgentHandoffSummary(): Promise<AgentHandoffSummary> {
  await requireRole('admin');
  if (process.env.APP_ENV !== 'qa') return {
    total:0,queued:0,blocked:0,completed:0,items:[],
  };
  const client=createPrivilegedAdminClient();
  const [counts,queue]=await Promise.all([
    client.from('agent_handoff_tasks').select('status'),
    client.from('agent_handoff_tasks').select(
      'id,task_type,source_agent,target_agent,brand,model,version_label,status,dispatch_enabled,updated_at'
    ).order('updated_at',{ascending:false}).limit(20),
  ]);
  if (counts.error||queue.error) throw new Error('AGENT_HANDOFFS_READ_UNAVAILABLE');
  const all=counts.data??[];
  return {
    total:all.length,
    queued:all.filter(x=>x.status==='QUEUED').length,
    blocked:all.filter(x=>['BLOCKED','EXHAUSTED'].includes(x.status)).length,
    completed:all.filter(x=>x.status==='COMPLETED').length,
    items:(queue.data??[]).map(x=>({
      id:x.id,taskType:x.task_type,sourceAgent:x.source_agent,targetAgent:x.target_agent,
      brand:x.brand,model:x.model,versionLabel:x.version_label,status:x.status,
      dispatchEnabled:x.dispatch_enabled,updatedAt:x.updated_at,observations:0,
    })),
  };
}
