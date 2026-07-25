


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "cc_v2";


ALTER SCHEMA "cc_v2" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgtap" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'seller'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'pending',
    'active',
    'disabled'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_profile_actor_references_before_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    update public.profiles
       set disabled_by = null,
           disabled_at = null
     where disabled_by = old.id
       and id <> old.id;

    return old;
end;
$$;


ALTER FUNCTION "public"."clear_profile_actor_references_before_delete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."clear_profile_actor_references_before_delete"() IS 'Owned by postgres. Trigger-only function that clears the disabled actor and timestamp together before ON DELETE SET NULL is applied.';



CREATE OR REPLACE FUNCTION "public"."contains_all_tokens"("haystack" "text", "needle" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select not exists (
    select 1
    from regexp_split_to_table(normalize_text(coalesce(needle, '')), '\s+') token
    where length(token) > 1
      and normalize_text(coalesce(haystack, '')) not like '%' || token || '%'
  );
$$;


ALTER FUNCTION "public"."contains_all_tokens"("haystack" "text", "needle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_product_model_year"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean DEFAULT true) RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
declare
  new_product_id bigint;
begin
  insert into products (
    brand,
    model,
    version,
    renavam_reference,
    model_year,
    production_year,
    is_active,
    segment
  )
  select
    brand,
    model,
    version,
    renavam_reference,
    new_model_year,
    new_production_year,
    make_active,
    segment
  from products
  where id = source_product_id
  returning id into new_product_id;

  insert into product_specs (
    product_id,
    equipment_id,
    value,
    is_present,
    input_unit
  )
  select
    new_product_id,
    equipment_id,
    value,
    is_present,
    input_unit
  from product_specs
  where product_id = source_product_id;

  insert into product_price_offers (
    product_id,
    offer_month,
    public_price,
    cash_discount,
    retail_discount,
    direct_sales_discount,
    tax_exemption_discount,
    bonus,
    bonus_description,
    financing_rate,
    financing_term,
    trade_in_bonus,
    trade_in_bonus_description,
    is_current,
    notes,
    source,
    created_at,
    updated_at
  )
  select
    new_product_id,
    offer_month,
    public_price,
    cash_discount,
    retail_discount,
    direct_sales_discount,
    tax_exemption_discount,
    bonus,
    bonus_description,
    financing_rate,
    financing_term,
    trade_in_bonus,
    trade_in_bonus_description,
    is_current,
    notes,
    source,
    now(),
    now()
  from product_price_offers
  where product_id = source_product_id
  order by created_at desc
  limit 1;

  return new_product_id;
end;
$$;


ALTER FUNCTION "public"."duplicate_product_model_year"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_product_simple"("source_product_id" integer, "new_model_year" smallint, "new_production_year" smallint, "make_active" boolean DEFAULT true) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  new_product_id integer;
begin
  insert into products (
    brand,
    model,
    version,
    renavam_reference,
    model_year,
    production_year,
    is_active,
    is_public,
    segment
  )
  select
    brand,
    model,
    version,
    renavam_reference,
    new_model_year,
    new_production_year,
    make_active,
    make_active,
    segment
  from products
  where id = source_product_id
  returning id into new_product_id;

  insert into product_specs (
    product_id,
    equipment_id,
    value,
    is_present,
    input_unit
  )
  select
    new_product_id,
    equipment_id,
    value,
    is_present,
    input_unit
  from product_specs
  where product_id = source_product_id;

  return new_product_id;
end;
$$;


ALTER FUNCTION "public"."duplicate_product_simple"("source_product_id" integer, "new_model_year" smallint, "new_production_year" smallint, "make_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_product_simple"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean DEFAULT true) RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
declare
  new_product_id bigint;
begin
  insert into products (
    brand,
    model,
    version,
    renavam_reference,
    model_year,
    production_year,
    is_active,
    segment
  )
  select
    brand,
    model,
    version,
    renavam_reference,
    new_model_year,
    new_production_year,
    make_active,
    segment
  from products
  where id = source_product_id
  returning id into new_product_id;

  insert into product_specs (
    product_id,
    equipment_id,
    value,
    is_present,
    input_unit
  )
  select
    new_product_id,
    equipment_id,
    value,
    is_present,
    input_unit
  from product_specs
  where product_id = source_product_id;

  return new_product_id;
end;
$$;


ALTER FUNCTION "public"."duplicate_product_simple"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    profile_full_name text;
begin
    profile_full_name := nullif(
        pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'),
        ''
    );

    if profile_full_name is null then
        profile_full_name := nullif(
            pg_catalog.btrim(new.raw_user_meta_data ->> 'name'),
            ''
        );
    end if;

    insert into public.profiles (
        id,
        full_name,
        role,
        status,
        invited_at
    )
    values (
        new.id,
        profile_full_name,
        'seller'::public.app_role,
        'pending'::public.user_status,
        pg_catalog.now()
    );

    return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_auth_user"() IS 'Owned by postgres. Trigger-only Auth hook. It reads only full_name/name presentation metadata and always creates seller/pending profiles.';



CREATE OR REPLACE FUNCTION "public"."normalize_text"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select trim(
    regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;


ALTER FUNCTION "public"."normalize_text"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
    new.updated_at := pg_catalog.now();
    return new;
end;
$$;


ALTER FUNCTION "public"."set_profiles_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_profiles_updated_at"() IS 'Owned by postgres. Trigger-only function that maintains public.profiles.updated_at with an empty search_path.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."specs" (
    "id" bigint NOT NULL,
    "group_name" character varying(100) NOT NULL,
    "equipment_group" character varying(150) NOT NULL,
    "spec_set" character varying(150) NOT NULL,
    "detail" character varying(200) NOT NULL,
    "code" character varying(50) NOT NULL,
    "type" character varying(20) NOT NULL,
    "unit" character varying(30),
    "value_direction" character varying(20),
    "unit_perceived_value" numeric(14,2) DEFAULT 0 NOT NULL,
    "relative_value" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_baseline" boolean DEFAULT false,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "commercial_category" "text",
    CONSTRAINT "chk_type" CHECK ((("type")::"text" = ANY ((ARRAY['numeric'::character varying, 'binary'::character varying, 'scale'::character varying])::"text"[]))),
    CONSTRAINT "chk_value_direction" CHECK ((("value_direction" IS NULL) OR (("value_direction")::"text" = ANY ((ARRAY['Positive'::character varying, 'Negative'::character varying])::"text"[]))))
);


ALTER TABLE "public"."specs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."equipments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."equipments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."equipments_id_seq" OWNED BY "public"."specs"."id";



CREATE TABLE IF NOT EXISTS "public"."fipe_reference_months" (
    "id" bigint NOT NULL,
    "codigo_tabela_referencia" integer NOT NULL,
    "mes_referencia" "text" NOT NULL,
    "is_current" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fipe_reference_months" OWNER TO "postgres";


ALTER TABLE "public"."fipe_reference_months" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."fipe_reference_months_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fipe_reference_values" (
    "id" bigint NOT NULL,
    "fipe_vehicle_model_id" bigint NOT NULL,
    "codigo_tabela_referencia" integer NOT NULL,
    "codigo_fipe" "text",
    "marca" "text",
    "modelo" "text",
    "ano_modelo" integer,
    "combustivel" "text",
    "valor_texto" "text",
    "valor_numero" numeric(14,2),
    "mes_referencia" "text",
    "autenticacao" "text",
    "tipo_veiculo" "text",
    "sigla_combustivel" "text",
    "data_consulta" "text",
    "raw_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fipe_reference_values" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."fipe_reference_values_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fipe_reference_values_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."fipe_reference_values_id_seq" OWNED BY "public"."fipe_reference_values"."id";



CREATE TABLE IF NOT EXISTS "public"."fipe_vehicle_models" (
    "id" bigint NOT NULL,
    "codigo_tabela_referencia" integer NOT NULL,
    "codigo_tipo_veiculo" integer NOT NULL,
    "tipo_veiculo" "text" NOT NULL,
    "codigo_marca" integer NOT NULL,
    "marca" "text" NOT NULL,
    "codigo_modelo" integer NOT NULL,
    "modelo" "text" NOT NULL,
    "ano_modelo" integer,
    "codigo_tipo_combustivel" integer,
    "combustivel" "text",
    "codigo_fipe" "text",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fipe_vehicle_models" OWNER TO "postgres";


ALTER TABLE "public"."fipe_vehicle_models" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."fipe_vehicle_models_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."price_offer_import_rows" (
    "id" bigint NOT NULL,
    "import_id" bigint,
    "brand" "text",
    "model_raw" "text",
    "version_raw" "text",
    "model_year" "text",
    "channel" "text",
    "public_price" numeric(14,2),
    "promo_price" numeric(14,2),
    "discount_percent" numeric(8,4),
    "bonus_amount" numeric(14,2),
    "trade_in_bonus" numeric(14,2),
    "dealer_participation" numeric(14,2),
    "tax_rate" numeric(8,4),
    "down_payment_percent" numeric(8,4),
    "term_months" integer,
    "installment_amount" numeric(14,2),
    "source_page" integer,
    "raw_text" "text",
    "confidence_score" numeric(5,2),
    "status" "text" DEFAULT 'pending'::"text",
    "product_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."price_offer_import_rows" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."price_offer_import_rows_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."price_offer_import_rows_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."price_offer_import_rows_id_seq" OWNED BY "public"."price_offer_import_rows"."id";



CREATE TABLE IF NOT EXISTS "public"."price_offer_imports" (
    "id" bigint NOT NULL,
    "brand" "text",
    "source_file_name" "text",
    "campaign_month" "text",
    "valid_from" "date",
    "valid_to" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."price_offer_imports" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."price_offer_imports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."price_offer_imports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."price_offer_imports_id_seq" OWNED BY "public"."price_offer_imports"."id";



CREATE TABLE IF NOT EXISTS "public"."price_offers_staging" (
    "brand" "text",
    "model" "text",
    "version" "text",
    "registration_base_description" "text",
    "my_code" "text",
    "control" "text",
    "msrp" "text",
    "retail_bonus" "text",
    "trade_in_bonus" "text",
    "subsidized_rate_monthly" "text",
    "rate_cost" "text",
    "insurance_years" "text",
    "ipva_value" "text",
    "others_bonus" "text",
    "dealer_rebate" "text",
    "total_customer_benefit" "text",
    "comment" "text",
    "offer_month_code" "text",
    "down_payment_percent" "text",
    "installments" "text"
);


ALTER TABLE "public"."price_offers_staging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_fipe_map" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "fipe_vehicle_model_id" bigint,
    "codigo_tabela_referencia" integer,
    "codigo_tipo_veiculo" integer,
    "codigo_marca" integer,
    "codigo_modelo" integer,
    "ano_modelo" integer,
    "codigo_tipo_combustivel" integer,
    "codigo_fipe" "text",
    "match_score" numeric(5,2),
    "match_status" "text" DEFAULT 'needs_review'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_fipe_map_match_status_check" CHECK (("match_status" = ANY (ARRAY['auto_matched'::"text", 'needs_review'::"text", 'confirmed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."product_fipe_map" OWNER TO "postgres";


ALTER TABLE "public"."product_fipe_map" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_fipe_map_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_fipe_values" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "product_fipe_map_id" bigint,
    "codigo_tabela_referencia" integer NOT NULL,
    "mes_referencia" "text",
    "codigo_fipe" "text",
    "marca" "text",
    "modelo" "text",
    "ano_modelo" integer,
    "combustivel" "text",
    "valor_texto" "text",
    "valor_numero" numeric(14,2),
    "autenticacao" "text",
    "tipo_veiculo" "text",
    "sigla_combustivel" "text",
    "data_consulta" "text",
    "raw_response" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_fipe_values" OWNER TO "postgres";


ALTER TABLE "public"."product_fipe_values" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_fipe_values_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_price_offers" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "offer_month" "date" NOT NULL,
    "public_price" numeric(14,2),
    "retail_bonus" numeric(14,2) DEFAULT 0,
    "retail_rebate" numeric(14,2) DEFAULT 0,
    "trade_in_bonus" numeric(14,2) DEFAULT 0,
    "trade_in_rebate" numeric(14,2) DEFAULT 0,
    "subsidized_rate_monthly" numeric(8,4),
    "down_payment_percent" numeric(8,2),
    "installments" integer,
    "rate_rebate" numeric(14,2) DEFAULT 0,
    "insurance_years" numeric(6,2) DEFAULT 0,
    "ipva_included" boolean DEFAULT false,
    "others_bonus" numeric(14,2) DEFAULT 0,
    "total_customer_benefit" numeric(14,2),
    "total_dealer_rebate" numeric(14,2),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."product_price_offers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_price_offers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_price_offers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_price_offers_id_seq" OWNED BY "public"."product_price_offers"."id";



CREATE TABLE IF NOT EXISTS "public"."product_specs" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "equipment_id" bigint NOT NULL,
    "value" numeric(14,4),
    "is_present" boolean,
    "input_unit" character varying(20),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."product_specs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_specs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_specs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_specs_id_seq" OWNED BY "public"."product_specs"."id";



CREATE TABLE IF NOT EXISTS "public"."product_specs_matrix_staging" (
    "SC_0001" "text",
    "SC_0002" "text",
    "SC_0003" "text",
    "SC_0004" "text",
    "SC_0005" bigint,
    "SC_0006" bigint,
    "DM_0001" bigint,
    "DM_0002" bigint,
    "DM_0003" bigint,
    "DM_0004" bigint,
    "DM_0005" "text",
    "DM_0006" bigint,
    "DM_0007" "text",
    "DM_0008" bigint,
    "DM_0009" bigint,
    "DM_0010" bigint,
    "DM_0011" bigint,
    "PW_0001" "text",
    "PW_0002" "text",
    "PW_0003" "text",
    "PW_0004" "text",
    "PW_0005" "text",
    "PW_0006" "text",
    "PW_0007" "text",
    "PW_0008" "text",
    "PW_0009" "text",
    "PW_0010" "text",
    "PW_0011" "text",
    "PW_0012" "text",
    "PW_0014" "text",
    "PW_0015" "text",
    "PW_0016" "text",
    "PW_0017" "text",
    "PW_0018" "text",
    "PW_0019" "text",
    "PW_0020" "text",
    "PW_0021" "text",
    "PW_0022" "text",
    "PW_0023" "text",
    "PW_0025" "text",
    "PW_0026" "text",
    "PW_0028" "text",
    "PW_0029" "text",
    "PW_0030" bigint,
    "PW_0031" "text",
    "PW_0032" "text",
    "PW_0033" "text",
    "PW_0035" "text",
    "PW_0036" "text",
    "PW_0037" "text",
    "PW_0038" bigint,
    "PW_0039" "text",
    "PW_0040" "text",
    "PW_0041" "text",
    "PW_0042" "text",
    "PW_0043" "text",
    "PW_0044" "text",
    "OW_0001" "text",
    "OW_0002" "text",
    "OW_0003" "text",
    "OW_0004" "text",
    "OW_0005" "text",
    "OW_0006" "text",
    "OW_0007" "text",
    "OW_0008" "text",
    "OW_0009" bigint,
    "OW_0010" bigint,
    "EX_0001" "text",
    "EX_0002" bigint,
    "EX_0003" bigint,
    "EX_0004" "text",
    "EX_0005" "text",
    "EX_0006" "text",
    "EX_0007" "text",
    "EX_0008" "text",
    "EX_0009" "text",
    "EX_0010" "text",
    "EX_0011" "text",
    "EX_0012" "text",
    "EX_0013" "text",
    "EX_0014" "text",
    "EX_0015" "text",
    "EX_0016" "text",
    "EX_0017" "text",
    "EX_0018" "text",
    "EX_0019" "text",
    "EX_0020" "text",
    "EX_0021" "text",
    "EX_0022" "text",
    "EX_0023" "text",
    "EX_0024" "text",
    "EX_0025" "text",
    "EX_0026" "text",
    "EX_0027" "text",
    "EX_0028" "text",
    "EX_0029" "text",
    "EX_0030" "text",
    "EX_0031" "text",
    "EX_0032" "text",
    "EX_0033" "text",
    "EX_0034" "text",
    "EX_0035" "text",
    "EX_0036" "text",
    "EX_0037" "text",
    "EX_0038" "text",
    "EX_0039" "text",
    "EX_0040" "text",
    "EX_0041" "text",
    "EX_0042" "text",
    "EX_0043" "text",
    "IN_0001" "text",
    "IN_0002" "text",
    "IN_0003" "text",
    "IN_0004" "text",
    "IN_0005" "text",
    "IN_0006" "text",
    "IN_0007" "text",
    "IN_0008" "text",
    "IN_0009" "text",
    "IN_0062" "text",
    "IN_0063" "text",
    "IN_0010" "text",
    "IN_0011" "text",
    "IN_0012" "text",
    "IN_0013" "text",
    "IN_0014" "text",
    "IN_0015" "text",
    "IN_0016" "text",
    "IN_0017" "text",
    "IN_0064" "text",
    "IN_0018" "text",
    "IN_0019" "text",
    "IN_0020" "text",
    "IN_0021" "text",
    "IN_0022" "text",
    "IN_0023" "text",
    "IN_0024" "text",
    "IN_0025" "text",
    "IN_0026" "text",
    "IN_0027" "text",
    "IN_0028" "text",
    "IN_0029" "text",
    "IN_0030" "text",
    "IN_0031" "text",
    "IN_0065" "text",
    "IN_0032" "text",
    "IN_0033" "text",
    "IN_0034" "text",
    "IN_0035" "text",
    "IN_0036" "text",
    "IN_0037" "text",
    "IN_0038" "text",
    "IN_0039" "text",
    "IN_0040" "text",
    "IN_0041" "text",
    "IN_0042" "text",
    "IN_0043" "text",
    "IN_0044" "text",
    "IN_0045" "text",
    "IN_0046" "text",
    "IN_0047" "text",
    "IN_0048" "text",
    "IN_0060" "text",
    "IN_0061" "text",
    "IN_0049" "text",
    "IN_0050" "text",
    "IN_0051" "text",
    "IN_0052" "text",
    "IN_0053" "text",
    "IN_0054" "text",
    "IN_0055" "text",
    "IN_0056" "text",
    "IN_0057" "text",
    "IN_0058" "text",
    "CO_0001" "text",
    "CO_0002" "text",
    "CO_0003" "text",
    "CO_0004" "text",
    "CO_0005" "text",
    "CO_0006" "text",
    "CO_0007" "text",
    "CO_0008" "text",
    "CO_0009" "text",
    "CO_0010" bigint,
    "CO_0011" bigint,
    "CO_0053" bigint,
    "CO_0054" bigint,
    "CO_0012" bigint,
    "CO_0013" bigint,
    "CO_0014" "text",
    "CO_0015" "text",
    "CO_0016" "text",
    "CO_0017" "text",
    "CO_0018" "text",
    "CO_0019" "text",
    "CO_0020" "text",
    "CO_0021" "text",
    "CO_0022" "text",
    "CO_0023" "text",
    "CO_0024" "text",
    "CO_0025" "text",
    "CO_0026" "text",
    "CO_0027" bigint,
    "CO_0028" bigint,
    "CO_0029" "text",
    "CO_0030" "text",
    "CO_0031" "text",
    "CO_0032" "text",
    "CO_0033" "text",
    "CO_0034" "text",
    "CO_0035" "text",
    "CO_0036" "text",
    "CO_0037" "text",
    "CO_0038" "text",
    "CO_0039" "text",
    "CO_0040" "text",
    "CO_0041" "text",
    "CO_0042" "text",
    "CO_0043" bigint,
    "CO_0044" "text",
    "CO_0045" bigint,
    "CO_0046" "text",
    "CO_0047" "text",
    "CO_0048" "text",
    "CO_0049" "text",
    "CO_0050" "text",
    "CO_0051" "text",
    "CO_0052" "text",
    "SF_0001" "text",
    "SF_0002" "text",
    "SF_0003" "text",
    "SF_0004" "text",
    "SF_0005" "text",
    "SF_0006" "text",
    "SF_0007" "text",
    "SF_0008" "text",
    "SF_0009" "text",
    "SF_0010" "text",
    "SF_0011" "text",
    "SF_0012" "text",
    "SF_0013" "text",
    "SF_0014" "text",
    "SF_0015" "text",
    "SF_0016" "text",
    "SF_0017" "text",
    "SF_0018" "text",
    "SF_0019" "text",
    "SF_0020" "text",
    "SF_0021" "text",
    "SF_0022" "text",
    "SF_0023" "text",
    "SF_0024" "text",
    "SF_0025" "text",
    "SF_0026" "text",
    "SF_0027" "text",
    "SF_0028" "text",
    "SF_0029" "text",
    "SF_0030" "text",
    "SF_0031" "text",
    "SF_0032" "text",
    "SF_0033" "text",
    "SF_0034" "text",
    "SF_0035" "text",
    "SF_0036" "text",
    "SF_0037" "text",
    "SF_0038" "text",
    "SF_0039" "text",
    "SF_0040" "text",
    "SF_0041" "text",
    "SF_0042" "text",
    "SF_0043" "text",
    "SF_0044" "text",
    "SF_0045" "text",
    "AD_0001" "text",
    "AD_0002" "text",
    "AD_0003" "text",
    "AD_0004" "text",
    "AD_0005" "text",
    "AD_0006" "text",
    "AD_0007" "text",
    "AD_0008" "text",
    "AD_0009" "text",
    "AD_0010" "text",
    "AD_0011" "text",
    "AD_0012" "text",
    "AD_0013" "text",
    "AD_0014" "text",
    "AD_0015" "text",
    "AD_0016" "text",
    "AD_0017" "text",
    "AD_0018" "text",
    "AD_0019" "text",
    "AD_0020" "text",
    "AD_0021" "text",
    "AD_0022" "text",
    "AD_0023" "text",
    "EX_0044" "text",
    "CO_0055" "text",
    "IN_0059" "text"
);


ALTER TABLE "public"."product_specs_matrix_staging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" integer NOT NULL,
    "brand" character varying(100) NOT NULL,
    "model" character varying(150) NOT NULL,
    "version" character varying(150) NOT NULL,
    "renavam_reference" character varying(100),
    "model_year" smallint NOT NULL,
    "production_year" smallint NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "segment" "text",
    "is_public" boolean DEFAULT false
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products_active_backup" (
    "id" integer,
    "is_active" boolean
);


ALTER TABLE "public"."products_active_backup" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."products_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."products_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."products_id_seq" OWNED BY "public"."products"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."app_role" DEFAULT 'seller'::"public"."app_role" NOT NULL,
    "status" "public"."user_status" DEFAULT 'pending'::"public"."user_status" NOT NULL,
    "invited_by" "uuid",
    "disabled_by" "uuid",
    "invited_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "disabled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_disabled_fields_consistent" CHECK ((("disabled_by" IS NULL) = ("disabled_at" IS NULL))),
    CONSTRAINT "profiles_disabled_fields_match_status" CHECK ((("status" = 'disabled'::"public"."user_status") OR (("disabled_by" IS NULL) AND ("disabled_at" IS NULL)))),
    CONSTRAINT "profiles_full_name_not_blank" CHECK ((("full_name" IS NULL) OR ("btrim"("full_name") <> ''::"text")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Authorization source for Compra Car users. Administrative writes require validated server-side Service Role operations.';



CREATE TABLE IF NOT EXISTS "public"."registrations" (
    "id" integer NOT NULL,
    "product_id" integer,
    "renavam_code" character varying(100),
    "registration_date" "date",
    "city" character varying(100),
    "state" character varying(50),
    "volume" integer,
    "sale_type" character varying(20),
    "renavam_reference" "text",
    "production_year" integer,
    "model_year" integer,
    "registrations_volume" integer,
    "year" integer,
    "month" integer
);


ALTER TABLE "public"."registrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."registrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."registrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."registrations_id_seq" OWNED BY "public"."registrations"."id";



CREATE TABLE IF NOT EXISTS "public"."registrations_staging" (
    "BANDEIRA" "text",
    "TIPO_VENDA" "text",
    "TIPO_VENDA_AJUSTADA" "text",
    "ANO_FABRICACAO" "text",
    "ANO_MODELO" "text",
    "COMBUSTIVEL" "text",
    "COMBUSTIVEL_AGREGADO" "text",
    "FAMILY" "text",
    "MODELO_VERSAO" "text",
    "RENAVAN" "text",
    "PRODUCT SEGMENT NEOCOM" "text",
    "Ano" "text",
    "Mes" "text",
    "TIV" "text",
    "Nome AOP" "text",
    "Município" "text"
);


ALTER TABLE "public"."registrations_staging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."specs_category_staging" (
    "id" bigint NOT NULL,
    "commercial_category" "text"
);


ALTER TABLE "public"."specs_category_staging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."specs_import_staging" (
    "id" bigint NOT NULL,
    "code" "text",
    "group_name" "text",
    "equipment_group" "text",
    "spec_set" "text",
    "detail" "text",
    "type" "text",
    "unit" "text",
    "value_direction" "text",
    "unit_perceived_value" numeric,
    "relative_value" numeric,
    "commercial_category" "text",
    "is_baseline" boolean,
    "is_active" boolean,
    "notes" "text"
);


ALTER TABLE "public"."specs_import_staging" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_conversions" (
    "id" bigint NOT NULL,
    "unit_from" character varying(20) NOT NULL,
    "unit_to" character varying(20) NOT NULL,
    "multiplier" numeric(18,8) NOT NULL,
    "offset_value" numeric(18,8) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."unit_conversions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."unit_conversions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."unit_conversions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."unit_conversions_id_seq" OWNED BY "public"."unit_conversions"."id";



CREATE OR REPLACE VIEW "public"."vw_product_fipe_candidates" AS
 SELECT "p"."id" AS "product_id",
    "p"."brand",
    "p"."model",
    "p"."version",
    "p"."model_year",
    "f"."id" AS "fipe_vehicle_model_id",
    "f"."marca" AS "fipe_marca",
    "f"."modelo" AS "fipe_modelo",
    "f"."ano_modelo" AS "fipe_ano_modelo",
    "f"."combustivel" AS "fipe_combustivel",
    "f"."codigo_fipe",
    "round"((((((("public"."similarity"("public"."normalize_text"(("p"."brand")::"text"), "public"."normalize_text"("f"."marca")) * (20)::double precision) + ("public"."similarity"("public"."normalize_text"(((("p"."model")::"text" || ' '::"text") || (COALESCE("p"."version", ''::character varying))::"text")), "public"."normalize_text"("f"."modelo")) * (55)::double precision)) + ("public"."similarity"("public"."normalize_text"(("p"."model")::"text"), "public"."normalize_text"("f"."modelo")) * (15)::double precision)) + (
        CASE
            WHEN ("p"."model_year" = "f"."ano_modelo") THEN 10
            WHEN ("abs"(("p"."model_year" - "f"."ano_modelo")) = 1) THEN 5
            ELSE 0
        END)::double precision) + (
        CASE
            WHEN "public"."contains_all_tokens"("f"."modelo", ("p"."version")::"text") THEN 10
            ELSE 0
        END)::double precision))::numeric, 2) AS "match_score"
   FROM ("public"."products" "p"
     JOIN "public"."fipe_vehicle_models" "f" ON (("public"."similarity"("public"."normalize_text"(("p"."brand")::"text"), "public"."normalize_text"("f"."marca")) > (0.45)::double precision)))
  WHERE (("p"."is_active" = true) AND "public"."contains_all_tokens"("f"."modelo", ("p"."model")::"text"));


ALTER VIEW "public"."vw_product_fipe_candidates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_product_fipe_review" AS
 SELECT "m"."id" AS "map_id",
    "m"."product_id",
    "p"."brand",
    "p"."model",
    "p"."version",
    "p"."model_year",
    "f"."marca" AS "fipe_marca",
    "f"."modelo" AS "fipe_modelo",
    "f"."ano_modelo" AS "fipe_ano_modelo",
    "f"."combustivel" AS "fipe_combustivel",
    "f"."codigo_fipe",
    "m"."match_score",
    "m"."match_status",
    "m"."notes"
   FROM (("public"."product_fipe_map" "m"
     JOIN "public"."products" "p" ON (("p"."id" = "m"."product_id")))
     LEFT JOIN "public"."fipe_vehicle_models" "f" ON (("f"."id" = "m"."fipe_vehicle_model_id")))
  ORDER BY
        CASE "m"."match_status"
            WHEN 'needs_review'::"text" THEN 1
            WHEN 'auto_matched'::"text" THEN 2
            WHEN 'confirmed'::"text" THEN 3
            WHEN 'rejected'::"text" THEN 4
            ELSE NULL::integer
        END, "m"."match_score" DESC;


ALTER VIEW "public"."vw_product_fipe_review" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_product_value_by_category" AS
 SELECT "p"."id" AS "product_id",
    "concat"("p"."brand", ' ', "p"."model", ' ', "p"."version", ' MY', "p"."model_year") AS "product_name",
    COALESCE("s"."commercial_category", 'Sem categoria'::"text") AS "category",
    "round"("sum"(
        CASE
            WHEN (("s"."type")::"text" = 'numeric'::"text") THEN (COALESCE("ps"."value", (0)::numeric) * COALESCE("s"."unit_perceived_value", (0)::numeric))
            ELSE COALESCE("s"."relative_value", (0)::numeric)
        END), 0) AS "perceived_value"
   FROM (("public"."products" "p"
     JOIN "public"."product_specs" "ps" ON (("ps"."product_id" = "p"."id")))
     JOIN "public"."specs" "s" ON (("s"."id" = "ps"."equipment_id")))
  WHERE (("p"."is_active" = true) AND ("s"."is_active" = true))
  GROUP BY "p"."id", "p"."brand", "p"."model", "p"."version", "p"."model_year", COALESCE("s"."commercial_category", 'Sem categoria'::"text");


ALTER VIEW "public"."vw_product_value_by_category" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_product_value_current" AS
 WITH "latest_price" AS (
         SELECT DISTINCT ON ("product_price_offers"."product_id") "product_price_offers"."product_id",
            "product_price_offers"."public_price"
           FROM "public"."product_price_offers"
          WHERE ("product_price_offers"."public_price" IS NOT NULL)
          ORDER BY "product_price_offers"."product_id", "product_price_offers"."created_at" DESC
        )
 SELECT "p"."id" AS "product_id",
    "concat"("p"."brand", ' ', "p"."model", ' ', "p"."version", ' MY', "p"."model_year") AS "product_name",
    "p"."brand",
    "p"."model",
    "p"."version",
    "p"."model_year",
    "lp"."public_price",
    "round"("sum"(
        CASE
            WHEN (("s"."type")::"text" = 'numeric'::"text") THEN (COALESCE("ps"."value", (0)::numeric) * COALESCE("s"."unit_perceived_value", (0)::numeric))
            ELSE COALESCE("s"."relative_value", (0)::numeric)
        END), 0) AS "perceived_value_total"
   FROM ((("public"."products" "p"
     JOIN "public"."product_specs" "ps" ON (("ps"."product_id" = "p"."id")))
     JOIN "public"."specs" "s" ON (("s"."id" = "ps"."equipment_id")))
     JOIN "latest_price" "lp" ON (("lp"."product_id" = "p"."id")))
  WHERE (("p"."is_active" = true) AND ("s"."is_active" = true))
  GROUP BY "p"."id", "p"."brand", "p"."model", "p"."version", "p"."model_year", "lp"."public_price";


ALTER VIEW "public"."vw_product_value_current" OWNER TO "postgres";


ALTER TABLE ONLY "public"."fipe_reference_values" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fipe_reference_values_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."price_offer_import_rows" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."price_offer_import_rows_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."price_offer_imports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."price_offer_imports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_price_offers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_price_offers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_specs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_specs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."products" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."products_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."registrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."registrations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."specs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."equipments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."unit_conversions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."unit_conversions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."specs"
    ADD CONSTRAINT "equipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fipe_reference_months"
    ADD CONSTRAINT "fipe_reference_months_codigo_tabela_referencia_key" UNIQUE ("codigo_tabela_referencia");



ALTER TABLE ONLY "public"."fipe_reference_months"
    ADD CONSTRAINT "fipe_reference_months_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fipe_reference_values"
    ADD CONSTRAINT "fipe_reference_values_fipe_vehicle_model_id_codigo_tabela_r_key" UNIQUE ("fipe_vehicle_model_id", "codigo_tabela_referencia");



ALTER TABLE ONLY "public"."fipe_reference_values"
    ADD CONSTRAINT "fipe_reference_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fipe_vehicle_models"
    ADD CONSTRAINT "fipe_vehicle_models_codigo_tabela_referencia_codigo_tipo_ve_key" UNIQUE ("codigo_tabela_referencia", "codigo_tipo_veiculo", "codigo_marca", "codigo_modelo", "ano_modelo", "codigo_tipo_combustivel");



ALTER TABLE ONLY "public"."fipe_vehicle_models"
    ADD CONSTRAINT "fipe_vehicle_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_offer_import_rows"
    ADD CONSTRAINT "price_offer_import_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_offer_imports"
    ADD CONSTRAINT "price_offer_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_fipe_map"
    ADD CONSTRAINT "product_fipe_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_fipe_map"
    ADD CONSTRAINT "product_fipe_map_product_id_codigo_fipe_ano_modelo_key" UNIQUE ("product_id", "codigo_fipe", "ano_modelo");



ALTER TABLE ONLY "public"."product_fipe_values"
    ADD CONSTRAINT "product_fipe_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_fipe_values"
    ADD CONSTRAINT "product_fipe_values_product_id_codigo_tabela_referencia_cod_key" UNIQUE ("product_id", "codigo_tabela_referencia", "codigo_fipe", "ano_modelo");



ALTER TABLE ONLY "public"."product_price_offers"
    ADD CONSTRAINT "product_price_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_specs"
    ADD CONSTRAINT "product_specs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_specs"
    ADD CONSTRAINT "product_specs_product_id_equipment_id_key" UNIQUE ("product_id", "equipment_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specs_category_staging"
    ADD CONSTRAINT "specs_category_staging_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specs_import_staging"
    ADD CONSTRAINT "specs_import_staging_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_conversions"
    ADD CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specs"
    ADD CONSTRAINT "uq_equipments_code" UNIQUE ("code");



ALTER TABLE ONLY "public"."specs"
    ADD CONSTRAINT "uq_equipments_structure" UNIQUE ("group_name", "equipment_group", "spec_set", "detail");



CREATE INDEX "profiles_disabled_by_idx" ON "public"."profiles" USING "btree" ("disabled_by");



CREATE INDEX "profiles_invited_by_idx" ON "public"."profiles" USING "btree" ("invited_by");



CREATE UNIQUE INDEX "unique_product" ON "public"."products" USING "btree" ("brand", "model", "version", "model_year", "production_year");



CREATE OR REPLACE TRIGGER "profiles_clear_actor_references_before_delete" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."clear_profile_actor_references_before_delete"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_updated_at"();



ALTER TABLE ONLY "public"."fipe_reference_values"
    ADD CONSTRAINT "fipe_reference_values_fipe_vehicle_model_id_fkey" FOREIGN KEY ("fipe_vehicle_model_id") REFERENCES "public"."fipe_vehicle_models"("id");



ALTER TABLE ONLY "public"."price_offer_import_rows"
    ADD CONSTRAINT "price_offer_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."price_offer_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_offer_import_rows"
    ADD CONSTRAINT "price_offer_import_rows_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."product_fipe_map"
    ADD CONSTRAINT "product_fipe_map_fipe_vehicle_model_id_fkey" FOREIGN KEY ("fipe_vehicle_model_id") REFERENCES "public"."fipe_vehicle_models"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_fipe_map"
    ADD CONSTRAINT "product_fipe_map_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_fipe_values"
    ADD CONSTRAINT "product_fipe_values_product_fipe_map_id_fkey" FOREIGN KEY ("product_fipe_map_id") REFERENCES "public"."product_fipe_map"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_fipe_values"
    ADD CONSTRAINT "product_fipe_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_price_offers"
    ADD CONSTRAINT "product_price_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."product_specs"
    ADD CONSTRAINT "product_specs_spec_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."specs"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_disabled_by_fk" FOREIGN KEY ("disabled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_auth_user_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_invited_by_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE "public"."product_specs_matrix_staging" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_update_own_full_name_when_active" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'active'::"public"."user_status"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'active'::"public"."user_status")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






REVOKE ALL ON TYPE "public"."app_role" FROM PUBLIC;
GRANT ALL ON TYPE "public"."app_role" TO "authenticated";
GRANT ALL ON TYPE "public"."app_role" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



REVOKE ALL ON TYPE "public"."user_status" FROM PUBLIC;
GRANT ALL ON TYPE "public"."user_status" TO "authenticated";
GRANT ALL ON TYPE "public"."user_status" TO "service_role";
















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "public"."clear_profile_actor_references_before_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_profile_actor_references_before_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_all_tokens"("haystack" "text", "needle" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_all_tokens"("haystack" "text", "needle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_all_tokens"("haystack" "text", "needle" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."duplicate_product_model_year"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_product_model_year"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_product_model_year"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."duplicate_product_simple"("source_product_id" integer, "new_model_year" smallint, "new_production_year" smallint, "make_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_product_simple"("source_product_id" integer, "new_model_year" smallint, "new_production_year" smallint, "make_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_product_simple"("source_product_id" integer, "new_model_year" smallint, "new_production_year" smallint, "make_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."duplicate_product_simple"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_product_simple"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_product_simple"("source_product_id" bigint, "new_model_year" integer, "new_production_year" integer, "make_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_auth_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_profiles_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."specs" TO "anon";
GRANT ALL ON TABLE "public"."specs" TO "authenticated";
GRANT ALL ON TABLE "public"."specs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equipments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equipments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equipments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fipe_reference_months" TO "anon";
GRANT ALL ON TABLE "public"."fipe_reference_months" TO "authenticated";
GRANT ALL ON TABLE "public"."fipe_reference_months" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fipe_reference_months_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fipe_reference_months_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fipe_reference_months_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fipe_reference_values" TO "anon";
GRANT ALL ON TABLE "public"."fipe_reference_values" TO "authenticated";
GRANT ALL ON TABLE "public"."fipe_reference_values" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fipe_reference_values_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fipe_reference_values_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fipe_reference_values_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fipe_vehicle_models" TO "anon";
GRANT ALL ON TABLE "public"."fipe_vehicle_models" TO "authenticated";
GRANT ALL ON TABLE "public"."fipe_vehicle_models" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fipe_vehicle_models_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fipe_vehicle_models_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fipe_vehicle_models_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."price_offer_import_rows" TO "anon";
GRANT ALL ON TABLE "public"."price_offer_import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."price_offer_import_rows" TO "service_role";



GRANT ALL ON SEQUENCE "public"."price_offer_import_rows_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."price_offer_import_rows_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."price_offer_import_rows_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."price_offer_imports" TO "anon";
GRANT ALL ON TABLE "public"."price_offer_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."price_offer_imports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."price_offer_imports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."price_offer_imports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."price_offer_imports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."price_offers_staging" TO "anon";
GRANT ALL ON TABLE "public"."price_offers_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."price_offers_staging" TO "service_role";



GRANT ALL ON TABLE "public"."product_fipe_map" TO "anon";
GRANT ALL ON TABLE "public"."product_fipe_map" TO "authenticated";
GRANT ALL ON TABLE "public"."product_fipe_map" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_fipe_map_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_fipe_map_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_fipe_map_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_fipe_values" TO "anon";
GRANT ALL ON TABLE "public"."product_fipe_values" TO "authenticated";
GRANT ALL ON TABLE "public"."product_fipe_values" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_fipe_values_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_fipe_values_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_fipe_values_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_price_offers" TO "anon";
GRANT ALL ON TABLE "public"."product_price_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."product_price_offers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_price_offers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_price_offers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_price_offers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_specs" TO "anon";
GRANT ALL ON TABLE "public"."product_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_specs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_specs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_specs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_specs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_specs_matrix_staging" TO "anon";
GRANT ALL ON TABLE "public"."product_specs_matrix_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."product_specs_matrix_staging" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."products_active_backup" TO "anon";
GRANT ALL ON TABLE "public"."products_active_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."products_active_backup" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."registrations" TO "anon";
GRANT ALL ON TABLE "public"."registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."registrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."registrations_staging" TO "anon";
GRANT ALL ON TABLE "public"."registrations_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."registrations_staging" TO "service_role";



GRANT ALL ON TABLE "public"."specs_category_staging" TO "anon";
GRANT ALL ON TABLE "public"."specs_category_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."specs_category_staging" TO "service_role";



GRANT ALL ON TABLE "public"."specs_import_staging" TO "anon";
GRANT ALL ON TABLE "public"."specs_import_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."specs_import_staging" TO "service_role";



GRANT ALL ON TABLE "public"."unit_conversions" TO "anon";
GRANT ALL ON TABLE "public"."unit_conversions" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_conversions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."unit_conversions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."unit_conversions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."unit_conversions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vw_product_fipe_candidates" TO "anon";
GRANT ALL ON TABLE "public"."vw_product_fipe_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_product_fipe_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."vw_product_fipe_review" TO "anon";
GRANT ALL ON TABLE "public"."vw_product_fipe_review" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_product_fipe_review" TO "service_role";



GRANT ALL ON TABLE "public"."vw_product_value_by_category" TO "anon";
GRANT ALL ON TABLE "public"."vw_product_value_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_product_value_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."vw_product_value_current" TO "anon";
GRANT ALL ON TABLE "public"."vw_product_value_current" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_product_value_current" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































