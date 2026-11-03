CREATE TABLE IF NOT EXISTS public.agent_dependency_nodes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 node_key text NOT NULL UNIQUE,
 entity_kind text NOT NULL CHECK(entity_kind IN ('BRAND','MMV','FIPE_MAPPING','MODEL_YEAR','PRICE','SPEC')),
 entity_ref text NOT NULL,
 state text NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','BLOCKED','REVALIDATING','APPLIED')),
 revision integer NOT NULL DEFAULT 0,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.agent_dependency_edges(
 predecessor_key text NOT NULL REFERENCES public.agent_dependency_nodes(node_key),
 successor_key text NOT NULL REFERENCES public.agent_dependency_nodes(node_key),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(predecessor_key,successor_key),
 CHECK(predecessor_key<>successor_key)
);
CREATE TABLE IF NOT EXISTS public.agent_dependency_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 node_key text NOT NULL REFERENCES public.agent_dependency_nodes(node_key),
 event_type text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_dependency_edges_successor_idx ON public.agent_dependency_edges(successor_key);
CREATE INDEX IF NOT EXISTS agent_dependency_nodes_state_idx ON public.agent_dependency_nodes(state);
ALTER TABLE public.agent_dependency_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_dependency_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_dependency_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_dependency_nodes,public.agent_dependency_edges,public.agent_dependency_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.agent_dependency_nodes TO service_role;
GRANT SELECT,INSERT,DELETE ON public.agent_dependency_edges TO service_role;
GRANT SELECT,INSERT ON public.agent_dependency_events TO service_role;
CREATE OR REPLACE FUNCTION public.agent_dependency_recalculate(p_node_key text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE current_state text; blocked_count integer; desired text;
BEGIN
 SELECT state INTO current_state FROM public.agent_dependency_nodes WHERE node_key=p_node_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DEPENDENCY_NODE_NOT_FOUND';END IF;
 IF current_state='APPLIED' THEN RETURN current_state;END IF;
 SELECT count(*) INTO blocked_count FROM public.agent_dependency_edges e
 JOIN public.agent_dependency_nodes n ON n.node_key=e.predecessor_key
 WHERE e.successor_key=p_node_key AND n.state<>'APPLIED';
 desired:=CASE WHEN blocked_count>0 THEN 'BLOCKED' ELSE 'READY' END;
 UPDATE public.agent_dependency_nodes SET state=desired,revision=revision+1,updated_at=now()
 WHERE node_key=p_node_key AND state IS DISTINCT FROM desired;
 RETURN desired;
END $$;
REVOKE ALL ON FUNCTION public.agent_dependency_recalculate(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.agent_dependency_recalculate(text) TO service_role;