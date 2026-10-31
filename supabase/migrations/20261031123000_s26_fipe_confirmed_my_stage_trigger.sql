CREATE OR REPLACE FUNCTION public.agent_fipe_on_confirmed_mapping()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
 IF NEW.status = 'CONFIRMED' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'CONFIRMED') THEN
   PERFORM public.s26_stage_fipe_model_years();
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS agent_fipe_confirmed_mapping_stage_my ON public.catalog_mmv_fipe_mappings;
CREATE TRIGGER agent_fipe_confirmed_mapping_stage_my
AFTER INSERT OR UPDATE OF status ON public.catalog_mmv_fipe_mappings
FOR EACH ROW EXECUTE FUNCTION public.agent_fipe_on_confirmed_mapping();
REVOKE ALL ON FUNCTION public.agent_fipe_on_confirmed_mapping() FROM PUBLIC,anon,authenticated;