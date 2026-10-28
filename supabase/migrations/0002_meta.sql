-- App bookkeeping: rate limits for live agent runs. Kept out of the
-- northwind schema so the read-only agent role can never see it.

create schema if not exists glassbox_meta;

create table glassbox_meta.rate_limits (
  bucket     text not null,        -- 'ip:<sha256>' or 'global'
  window_start timestamptz not null,
  hits       integer not null default 0,
  primary key (bucket, window_start)
);

-- Atomically counts a hit and returns the new total for the window.
create or replace function glassbox_meta.hit(p_bucket text, p_window interval)
returns integer
language sql
security definer
set search_path = glassbox_meta, pg_catalog
as $$
  insert into glassbox_meta.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, date_bin(p_window, now(), timestamptz '2000-01-01'), 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning hits;
$$;

revoke all on function glassbox_meta.hit(text, interval) from public;
