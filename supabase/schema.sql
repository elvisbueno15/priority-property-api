-- Priority Team Connect — Supabase (Postgres) schema
-- Paste this into Supabase → SQL Editor → New query → Run.
-- Mirrors the data the app stores today (JSON files) so migration is 1:1.

-- Users ---------------------------------------------------------------------
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  role          text not null default 'employee',   -- owner | admin | employee
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Time tracking -------------------------------------------------------------
create table if not exists time_entries (
  id               text primary key,
  user_id          uuid not null references app_users(id) on delete cascade,
  project_id       text not null default 'general',
  start_time       timestamptz not null,
  end_time         timestamptz,
  status           text not null default 'active',
  activity_percent int  not null default 100,
  idle_time_ms     bigint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_entries_user on time_entries(user_id, start_time desc);

create table if not exists usage_snapshots (
  id           text primary key,
  entry_id     text not null references time_entries(id) on delete cascade,
  user_id      uuid not null,
  app_name     text,
  window_title text,
  captured_at  timestamptz not null default now()
);
create index if not exists idx_usage_entry on usage_snapshots(entry_id);

create table if not exists screenshots (
  id          text primary key,
  entry_id    text not null references time_entries(id) on delete cascade,
  user_id     uuid not null,
  path        text not null,           -- Supabase Storage path/URL
  captured_at timestamptz not null default now()
);
create index if not exists idx_shots_entry on screenshots(entry_id);
create index if not exists idx_shots_user on screenshots(user_id, captured_at desc);

create table if not exists tracking_settings (
  user_id                    uuid primary key references app_users(id) on delete cascade,
  screenshot_interval_minutes int not null default 10,
  allow_monitoring           boolean not null default true
);

-- Chat ----------------------------------------------------------------------
create table if not exists chat_messages (
  id       text primary key,
  channel  text not null,             -- 'general' | 'support' | 'executives' | 'dm:<id>:<id>'
  user_id  uuid not null,
  name     text not null,
  body     text not null,
  at       timestamptz not null default now()
);
create index if not exists idx_chat_channel on chat_messages(channel, at);

-- Meetings ------------------------------------------------------------------
create table if not exists meetings (
  id               text primary key,
  title            text not null,
  starts_at        timestamptz not null,
  duration_minutes int not null default 30,
  channel          text not null default 'general',
  created_by       uuid not null,
  created_by_name  text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_meetings_start on meetings(starts_at);

-- Feedback ------------------------------------------------------------------
create table if not exists feedback (
  id       text primary key,
  user_id  uuid not null,
  name     text not null,
  email    text not null,
  category text not null,
  message  text not null,
  at       timestamptz not null default now()
);

-- Note: activity feed stays in-memory on purpose (it is a transient
-- "what happened while you were away" list, cheap to rebuild).
