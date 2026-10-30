create table if not exists catalog_groups (
  id text primary key,
  group_code text not null unique,
  title text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists catalog_majors (
  id text primary key,
  major_num integer not null unique,
  title text not null,
  group_code text not null,
  property_types jsonb not null default '[]',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists catalog_spaces (
  id text primary key,
  space_code text not null unique,
  title text not null,
  is_repeatable boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists catalog_items (
  id text primary key,
  major_num integer not null,
  code text not null,
  description text not null,
  spec text not null default '',
  unit text not null,
  cost_price double precision not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists catalog_coefficients (
  id text primary key,
  property_type text not null unique,
  name text not null,
  coefficient double precision not null,
  is_active boolean not null default true
);

create table if not exists catalog_meta (
  id integer primary key,
  seeded boolean not null default false
);

create table if not exists admins (
  user_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  user_id text primary key,
  plan text not null,
  status text not null,
  payer_name text not null default '',
  reference text not null default '',
  period_end text,
  updated_at timestamptz not null default now()
);

create table if not exists quote_bundles (
  user_id text primary key,
  seq integer not null default 0,
  quotes jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists camp_settings (
  id integer primary key,
  fps_id text not null default '',
  pay_note text not null default ''
);

insert into camp_settings (id, fps_id, pay_note)
values (1, '', '示例模式：未連接付款渠道，不會處理付款。')
on conflict (id) do nothing;
