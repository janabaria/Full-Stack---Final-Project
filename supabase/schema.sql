create table if not exists public.player_progress (
  username text primary key check (char_length(username) between 1 and 80),
  display_name text not null check (char_length(display_name) between 1 and 80),
  progress jsonb not null,
  score integer not null default 0 check (score between 0 and 10000000),
  completed_rooms integer[] not null default '{}',
  hints_used integer not null default 0 check (hints_used between 0 and 100000),
  current_room integer not null default 1 check (current_room between 1 and 10),
  game_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.player_progress
  drop constraint if exists player_progress_current_room_check;

alter table public.player_progress
  add constraint player_progress_current_room_check
  check (current_room between 1 and 5);

create index if not exists player_progress_leaderboard_idx
  on public.player_progress (score desc, updated_at asc)
  where game_completed = true;

alter table public.player_progress enable row level security;
