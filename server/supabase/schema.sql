-- Run this in Supabase SQL Editor.
-- It creates core tables and RLS policies for user-owned and admin access.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  name text not null,
  email text not null unique,
  phone text,
  app_role text not null default 'user' check (app_role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_name text not null,
  date date not null,
  total_amount numeric(12,2) not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'cancelled')),
  payment_id text,
  idempotency_key text unique,
  cancelled_at timestamptz,
  cancel_reason text,
  user_name text,
  user_email text,
  user_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_date_idx on public.bookings(date);
create index if not exists bookings_status_idx on public.bookings(status);

create table if not exists public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  slot_id text not null,
  slot_time text not null,
  slot_time_key text not null,
  court integer not null,
  date date not null,
  price numeric(12,2) not null,
  status text not null default 'booked' check (status in ('available', 'booked', 'selected')),
  locked_by_subscription_id uuid,
  created_at timestamptz not null default now(),
  unique(booking_id, slot_id)
);

create index if not exists booking_slots_conflict_idx
  on public.booking_slots(date, court, slot_time_key)
  where status = 'booked';

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  court_name text not null,
  court integer not null,
  time_slot text not null,
  time_slot_key text not null,
  start_date date not null,
  end_date date not null,
  weekdays_count integer not null,
  amount numeric(12,2) not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  payment_id text,
  idempotency_key text unique,
  locked_dates date[] not null default '{}',
  cancelled_at timestamptz,
  user_name text,
  user_email text,
  user_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_conflict_idx on public.subscriptions(court, time_slot_key, start_date, end_date) where status = 'active';

create table if not exists public.gallery (
  id text primary key,
  url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gallery_sort_order_idx on public.gallery(sort_order);

create table if not exists public.court_blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  block_type text not null default 'day' check (block_type in ('day', 'hour')),
  courts integer[] not null default '{}',
  all_courts boolean not null default false,
  time_slot text,
  time_slot_key text,
  reason text,
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists court_blocks_date_idx on public.court_blocks(date);
create index if not exists court_blocks_date_time_idx on public.court_blocks(date, time_slot_key);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  status text not null default 'new',
  admin_reply text,
  admin_reply_by text,
  admin_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_email_idx on public.contact_messages(email);
create index if not exists contact_messages_created_at_idx on public.contact_messages(created_at desc);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  review_date date not null,
  admin_reply text,
  admin_reply_by text,
  admin_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_created_at_idx on public.reviews(created_at desc);

create table if not exists public.email_verifications (
  email text primary key,
  token text not null,
  expiry_time timestamptz not null,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  pricing jsonb not null default '{"offPeak":500,"peak":800,"subscription":2500}',
  courts jsonb not null default '["Court 1","Court 2","Court 3"]',
  operating_hours jsonb not null default '{"startHour":5,"endHour":22}',
  landing jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings(key)
values ('default')
on conflict (key) do nothing;

-- Turn on RLS.
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_slots enable row level security;
alter table public.subscriptions enable row level security;
alter table public.settings enable row level security;

-- Profiles policies.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
for select using (auth.uid() = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update using (auth.uid() = id);

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
for all using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
);

-- Bookings policies.
drop policy if exists bookings_owner_read on public.bookings;
create policy bookings_owner_read on public.bookings
for select using (auth.uid() = user_id);

drop policy if exists bookings_owner_write on public.bookings;
create policy bookings_owner_write on public.bookings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
for all using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
);

-- Booking slots policies (inherit by booking ownership).
drop policy if exists booking_slots_owner_read on public.booking_slots;
create policy booking_slots_owner_read on public.booking_slots
for select using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_slots.booking_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists booking_slots_owner_write on public.booking_slots;
create policy booking_slots_owner_write on public.booking_slots
for all using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_slots.booking_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_slots.booking_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists booking_slots_admin_all on public.booking_slots;
create policy booking_slots_admin_all on public.booking_slots
for all using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
);

-- Subscriptions policies.
drop policy if exists subscriptions_owner_read on public.subscriptions;
create policy subscriptions_owner_read on public.subscriptions
for select using (auth.uid() = user_id);

drop policy if exists subscriptions_owner_write on public.subscriptions;
create policy subscriptions_owner_write on public.subscriptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists subscriptions_admin_all on public.subscriptions;
create policy subscriptions_admin_all on public.subscriptions
for all using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
);

-- Settings policies: public read, admin write.
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings
for select using (true);

drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings
for all using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  )
);
