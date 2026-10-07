-- Diana 0001: esquema base.
-- Ejecutar COMPLETO en Supabase > SQL Editor (o con `supabase db push`). Orden: 0001, 0002, 0003, 0004.
-- Mapea 1:1 con los tipos de frontend_architecture.md (6.1 y 7.1).
-- La prediccion de IA se guarda en decimos enteros (como predictTenths): 10..50.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  favorite_platforms text[] not null default '{netflix,prime-video,max}',
  favorite_genres int[] not null default '{}',
  has_onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Cada alta en auth.users crea su perfil (el cliente nunca inserta en profiles).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Respuestas del onboarding. genre_ids permite calcular el gusto sin el catalogo mock.
create table public.initial_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id int not null,
  value text not null check (value in ('like', 'skip', 'unseen')),
  genre_ids int[] not null default '{}',
  primary key (user_id, media_id)
);

create table public.history_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,                                   -- 'movie:42', 'tv:7', 'tv:7:s1', 'tv:7:s1:e3'
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id int not null,
  season int,
  episode int,
  title text not null,
  genre_ids int[] not null default '{}',
  user_rating numeric(2, 1) not null
    check (user_rating between 0.5 and 5 and (user_rating * 2) = floor(user_rating * 2)),
  ai_prediction_tenths smallint not null check (ai_prediction_tenths between 10 and 50),
  prediction_seen boolean not null default false,
  source text not null default 'app' check (source in ('app', 'letterboxd')),
  rated_at timestamptz not null default now(),
  primary key (user_id, key),
  check (episode is null or season is not null)
);
create index history_entries_user_rated_idx on public.history_entries (user_id, rated_at desc);

create table public.watched (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  primary key (user_id, key)
);

create table public.rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{4}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  phase text not null default 'lobby' check (phase in ('lobby', 'mood', 'swipe')),
  mood jsonb not null default '{"answers":{},"confirmed":false}',
  deck jsonb not null default '[]',                    -- [{"mediaType":"movie","mediaId":42}, ...] fijado por el anfitrion
  created_at timestamptz not null default now()
);

create table public.room_members (
  code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (code, user_id)
);

create table public.room_decisions (
  code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  decision text not null check (decision in ('like', 'skip')),
  primary key (code, user_id, key)
);

-- Cache de respuestas de TMDB. Solo la usa la Edge Function (service role).
create table public.tmdb_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Contador de peticiones por usuario y minuto (limite de tasa de la Edge Function).
create table public.api_hits (
  user_id uuid not null,
  bucket timestamptz not null,
  n int not null default 0,
  primary key (user_id, bucket)
);
