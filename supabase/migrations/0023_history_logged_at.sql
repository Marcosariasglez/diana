-- Diana 0023: fecha de registro en el Diario rápido (null = valoración que no vino del Diario).
alter table public.history_entries add column if not exists logged_at timestamptz;
create index if not exists history_entries_user_logged_idx
  on public.history_entries (user_id, logged_at desc) where logged_at is not null;
