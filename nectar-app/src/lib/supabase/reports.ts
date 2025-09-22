create table if not exists nightly_reports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  venue_name text not null,
  report_date date not null,
  total_skips integer not null,
  total_revenue numeric(10,2) not null,
  avg_price numeric(10,2) not null,
  venue_share_pct numeric(5,2) not null,
  venue_share numeric(10,2) not null,
  png_key text not null,
  pdf_key text not null,
  created_at timestamptz not null default now()
);

create index on nightly_reports (venue_id, report_date);
