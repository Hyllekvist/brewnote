create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  display_name text,
  avatar_url text
);

create type product_kind as enum ('coffee','tea');

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  kind product_kind not null,
  slug text unique not null,
  title text not null,
  subtitle text,
  origin_country text,
  producer text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_label text,
  roast_date date,
  harvest_year int,
  created_at timestamptz default now()
);

create table if not exists brews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_variant_id uuid references product_variants(id) on delete set null,
  method text not null,
  grams numeric,
  water_grams numeric,
  temp_c numeric,
  time_seconds int,
  grind text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 5),
  acidity int check (acidity >= 0 and acidity <= 100),
  body int check (body >= 0 and body <= 100),
  sweetness int check (sweetness >= 0 and sweetness <= 100),
  aroma int check (aroma >= 0 and aroma <= 100),
  created_at timestamptz default now(),
  unique(user_id, product_id)
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_variant_id uuid references product_variants(id) on delete set null,
  status text default 'open',
  opened_at date,
  created_at timestamptz default now()
);

create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);

create table if not exists gear (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  label text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
