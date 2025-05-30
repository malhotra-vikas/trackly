create table price_history (
  asin text primary key,
  price_data jsonb not null,
  created_at timestamptz default now()
);

-- Index for quick TTL lookups
create index idx_price_history_created_at on price_history (created_at);

-- Enable Row-Level Security
alter table price_history enable row level security;

-- Policy to allow public (anon key) read + write
create policy "Allow read/write for everyone"
  on price_history
  for all
  using (true)
  with check (true);
