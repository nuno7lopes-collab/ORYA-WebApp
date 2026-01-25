-- D17 Apple V1: user_identities + push_device_tokens
create table if not exists app_v3.user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_v3.profiles(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text null,
  created_at timestamptz(6) not null default now()
);

create unique index if not exists user_identities_provider_unique
  on app_v3.user_identities (provider, provider_user_id);
create index if not exists user_identities_user_idx
  on app_v3.user_identities (user_id);

create table if not exists app_v3.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_v3.profiles(id) on delete cascade,
  platform text not null,
  token text not null,
  created_at timestamptz(6) not null default now(),
  revoked_at timestamptz(6) null
);

create unique index if not exists push_device_tokens_platform_token_unique
  on app_v3.push_device_tokens (platform, token);
create index if not exists push_device_tokens_user_idx
  on app_v3.push_device_tokens (user_id);
