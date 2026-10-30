DO $do$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef('public.s26_decide_fipe_candidate(uuid,text,uuid)'::regprocedure) INTO body;
 IF position($x$  INSERT INTO public.agent_dependency_events(event_key,node_key,event_type,payload)$x$ in body)=0
 THEN RAISE EXCEPTION 'FIPE_FUNCTION_CONTRACT_CHANGED'; END IF;
 body:=replace(body,
 $x$  INSERT INTO public.agent_dependency_events(event_key,node_key,event_type,payload)$x$,
 $x$  INSERT INTO public.agent_dependency_nodes(node_key,entity_kind,entity_ref,state)
   VALUES('my:mmv:'||c.mmv_id,'MODEL_YEAR',c.mmv_id::text,'BLOCKED')
   ON CONFLICT(node_key) DO NOTHING;
  INSERT INTO public.agent_dependency_edges(predecessor_key,successor_key)
   VALUES('fipe-candidate:'||c.id,'my:mmv:'||c.mmv_id)
   ON CONFLICT DO NOTHING;
  PERFORM public.agent_dependency_recalculate('my:mmv:'||c.mmv_id);
  INSERT INTO public.agent_dependency_events(event_key,node_key,event_type,payload)
   VALUES('my-ready:fipe:'||c.id,'my:mmv:'||c.mmv_id,'DEPENDENCY_READY',
     jsonb_build_object('mmvId',c.mmv_id,'fipeCode',c.fipe_code,'source','FIPE_APPROVAL'))
   ON CONFLICT(event_key) DO NOTHING;
  INSERT INTO public.agent_dependency_events(event_key,node_key,event_type,payload)$x$);
 EXECUTE body;
END $do$;