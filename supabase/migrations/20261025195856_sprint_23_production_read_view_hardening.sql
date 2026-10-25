-- Release hardening: the invoker's underlying table privileges/RLS also apply.
-- The application uses the existing server-only service client for this view.
-- No data is inserted, copied, updated or deleted.
alter view public.vw_admin_product_spec_started set (security_invoker = true);
