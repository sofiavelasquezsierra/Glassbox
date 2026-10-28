-- Least-privilege roles. Passwords are set by scripts/db-migrate.ts from
-- env vars and never stored in SQL files.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'glassbox_reader') then
    create role glassbox_reader login noinherit nocreatedb nocreaterole nosuperuser noreplication;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'glassbox_app') then
    create role glassbox_app login noinherit nocreatedb nocreaterole nosuperuser noreplication;
  end if;
end $$;

-- Reader: SELECT on northwind only, and every transaction is read-only.
revoke all on schema public from glassbox_reader;
grant usage on schema northwind to glassbox_reader;
grant select on all tables in schema northwind to glassbox_reader;
alter default privileges in schema northwind grant select on tables to glassbox_reader;
alter role glassbox_reader set default_transaction_read_only = on;
alter role glassbox_reader set statement_timeout = '5s';
alter role glassbox_reader set idle_in_transaction_session_timeout = '10s';
alter role glassbox_reader set search_path = northwind, pg_catalog;
alter role glassbox_reader connection limit 20;

-- App: may only call the rate-limit function.
revoke all on schema public from glassbox_app;
grant usage on schema glassbox_meta to glassbox_app;
grant execute on function glassbox_meta.hit(text, interval) to glassbox_app;
alter role glassbox_app set statement_timeout = '2s';
alter role glassbox_app connection limit 10;
