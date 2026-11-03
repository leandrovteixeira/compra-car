create or replace function public.qa_sync_fipe_reviews()
returns trigger language plpgsql security definer set search_path='' as $$
declare f record; v_candidate record; existing_id uuid; brand_name text;
begin
 select id,finding_type,subject,proposal into f
   from public.agent_findings where id=new.finding_id;
 if not found or f.finding_type not in
   ('FIPE_MAPPING_CANDIDATE','FIPE_MODEL_YEAR_CANDIDATE') then return new; end if;
 if new.reviewed_by is null then raise exception 'FIPE_OPERATOR_REVIEW_REQUIRED'; end if;
 if new.decision not in ('ACCEPT','REJECT','DEFER') then
   raise exception 'FIPE_REVIEW_DECISION_INVALID'; end if;
 if f.proposal->>'candidateId' is distinct from f.subject->>'candidateId' then
   raise exception 'FIPE_REVIEW_STALE_PROPOSAL'; end if;
 if f.finding_type='FIPE_MAPPING_CANDIDATE' then
   perform public.s26_decide_fipe_candidate(
     (f.subject->>'candidateId')::uuid,new.decision,new.reviewed_by);
   if new.decision='ACCEPT' then
     select m.brand into brand_name
       from public.agent_fipe_mapping_candidates candidate
       join public.catalog_mmvs m on m.id=candidate.mmv_id
       where candidate.id=(f.subject->>'candidateId')::uuid;
     perform public.qa_stage_fipe_review_findings(brand_name);
   end if;
 else
   select candidate.* into v_candidate from public.agent_fipe_model_year_candidates candidate
     where candidate.id=(f.subject->>'candidateId')::uuid for update;
   if not found or v_candidate.mmv_id::text is distinct from f.subject->>'mmvId'
     or v_candidate.model_year::text is distinct from f.subject->>'modelYear'
     or v_candidate.fipe_code is distinct from f.proposal->>'fipeCode'
     then raise exception 'FIPE_MY_CANDIDATE_STALE'; end if;
   if v_candidate.decision='ACCEPT' and new.decision<>'ACCEPT' then
     raise exception 'FIPE_MY_ALREADY_APPLIED'; end if;
   if new.decision='ACCEPT' then
     if not exists(select 1 from public.catalog_mmv_fipe_mappings mp
       where mp.mmv_id=v_candidate.mmv_id and mp.fipe_code=v_candidate.fipe_code
         and mp.status='CONFIRMED')
       then raise exception 'FIPE_MY_MAPPING_NOT_CONFIRMED'; end if;
     select id into existing_id from public.catalog_mmv_model_years
       where mmv_id=v_candidate.mmv_id and model_year=v_candidate.model_year limit 1;
     if existing_id is null then
       insert into public.catalog_mmv_model_years(mmv_id,production_year,
         model_year,status,confidence,source_finding_id,
         last_confirmed_finding_id,created_by)
       values(v_candidate.mmv_id,null,v_candidate.model_year,'UNKNOWN',0.90,f.id,f.id,new.reviewed_by);
     end if;
   end if;
   update public.agent_fipe_model_year_candidates
     set decision=new.decision,reviewed_by=new.reviewed_by,reviewed_at=now()
     where id=v_candidate.id;
 end if;
 return new;
end $$;
