create table if not exists user_accounts (
  discord_id text primary key,
  points integer not null default 0
);

create table if not exists completed_offers (
  discord_id text not null,
  offer_id text not null,
  created_at timestamptz not null default now(),
  primary key (discord_id, offer_id)
);

create table if not exists dismissed_offers (
  discord_id text not null,
  offer_id text not null,
  created_at timestamptz not null default now(),
  primary key (discord_id, offer_id)
);

create table if not exists orders (
  id text primary key,
  discord_id text not null,
  order_data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists orders_discord_id_created_at_idx on orders (discord_id, created_at desc);
create index if not exists orders_created_at_idx on orders (created_at desc);

create table if not exists support_tickets (
  id text primary key,
  discord_id text not null,
  ticket_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_discord_id_created_at_idx on support_tickets (discord_id, created_at desc);
create index if not exists support_tickets_updated_at_idx on support_tickets (updated_at desc);

create table if not exists geo_cache (
  ip text primary key,
  country text not null,
  expires_at timestamptz not null
);

create table if not exists cpx_transaction_status (
  transaction_id text primary key,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists bitcotasks_processed_transactions (
  transaction_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists affike_transactions (
  transaction_id text primary key,
  user_id text not null,
  points integer not null,
  status text not null,
  offer_id text,
  credited boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists offerwall_me_transactions (
  transaction_id text primary key,
  user_id text not null,
  points integer not null,
  status text not null,
  offer_id text,
  offer_name text,
  credited boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists offerwall_me_milestones (
  discord_id text not null,
  offer_id text not null,
  reward integer not null,
  transaction_id text not null,
  primary key (discord_id, offer_id, reward, transaction_id)
);

create table if not exists offerwall_me_milestone_names (
  discord_id text not null,
  offer_name text not null,
  reward integer not null,
  transaction_id text not null,
  primary key (discord_id, offer_name, reward, transaction_id)
);

create or replace function adjust_user_points(p_discord_id text, p_delta integer)
returns integer
language sql
security definer
as $$
  insert into user_accounts (discord_id, points)
  values (p_discord_id, p_delta)
  on conflict (discord_id) do update
    set points = user_accounts.points + excluded.points
  returning points;
$$;

create or replace function mark_offer_complete_and_credit(
  p_discord_id text,
  p_offer_id text,
  p_points integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  inserted boolean;
  current_points integer;
begin
  insert into user_accounts (discord_id, points) values (p_discord_id, 0)
  on conflict (discord_id) do nothing;

  insert into completed_offers (discord_id, offer_id)
  values (p_discord_id, p_offer_id)
  on conflict do nothing;
  inserted := found;

  if inserted then
    update user_accounts set points = points + p_points where discord_id = p_discord_id;
  end if;

  select points into current_points from user_accounts where discord_id = p_discord_id;
  return jsonb_build_object('alreadyCompleted', not inserted, 'points', current_points);
end;
$$;

create or replace function redeem_user_reward(
  p_discord_id text,
  p_order jsonb,
  p_points integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_points integer;
  next_points integer;
begin
  insert into user_accounts (discord_id, points) values (p_discord_id, 0)
  on conflict (discord_id) do nothing;

  select points into current_points from user_accounts where discord_id = p_discord_id for update;
  if current_points < p_points then
    return jsonb_build_object('success', false, 'points', current_points);
  end if;

  next_points := current_points - p_points;
  update user_accounts set points = next_points where discord_id = p_discord_id;
  insert into orders (id, discord_id, order_data) values (p_order->>'id', p_discord_id, p_order);
  return jsonb_build_object('success', true, 'points', next_points);
end;
$$;

alter table user_accounts enable row level security;
alter table completed_offers enable row level security;
alter table dismissed_offers enable row level security;
alter table orders enable row level security;
alter table support_tickets enable row level security;
alter table geo_cache enable row level security;
alter table cpx_transaction_status enable row level security;
alter table affike_transactions enable row level security;
alter table offerwall_me_transactions enable row level security;
alter table offerwall_me_milestones enable row level security;
alter table offerwall_me_milestone_names enable row level security;
