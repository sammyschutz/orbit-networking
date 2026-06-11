-- Safe messaging: core schema (spec §4)
-- Adds conversations, messages, blocks, reports, and the append-only
-- message_audit_log. Follows existing conventions: uuid PKs, timestamptz,
-- references auth.users with cascade, RLS enabled (policies live in the next
-- migration). Reuses the existing set_updated_at() trigger function.

-- --------------------------------------------------
-- TABLE: conversations  (one row per connected pair, lazily created)
-- --------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references connections(id) on delete cascade,
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz null,
  last_message_preview text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_different_users check (user_a_id <> user_b_id)
);
-- Unique ordered pair, mirroring idx_connections_unique_pair.
create unique index if not exists idx_conversations_unique_pair on conversations (
  least(user_a_id, user_b_id),
  greatest(user_a_id, user_b_id)
);
create index if not exists idx_conversations_user_a_id on conversations(user_a_id);
create index if not exists idx_conversations_user_b_id on conversations(user_b_id);
create index if not exists idx_conversations_last_message_at
  on conversations(last_message_at desc nulls last);

-- --------------------------------------------------
-- TABLE: messages
-- --------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'sent' check (status in ('sent')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint messages_different_users check (sender_id <> recipient_id)
);
create index if not exists idx_messages_conversation_created_at
  on messages(conversation_id, created_at desc);
create index if not exists idx_messages_recipient_created_at
  on messages(recipient_id, created_at desc);
-- Supports the new-connection cooldown / rate-limit window scans by sender.
create index if not exists idx_messages_sender_created_at
  on messages(sender_id, created_at desc);

-- --------------------------------------------------
-- TABLE: blocks
-- --------------------------------------------------
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  reason text null,
  created_at timestamptz not null default now(),
  constraint blocks_different_users check (blocker_id <> blocked_id),
  constraint blocks_unique_pair unique (blocker_id, blocked_id)
);
create index if not exists idx_blocks_blocker_id on blocks(blocker_id);
create index if not exists idx_blocks_blocked_id on blocks(blocked_id);

-- --------------------------------------------------
-- TABLE: reports
-- --------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null references conversations(id) on delete set null,
  message_id uuid null references messages(id) on delete set null,
  category text not null check (
    category in ('harassment','spam','hate','sexual','threat','other')
  ),
  details text null,
  status text not null default 'open' check (
    status in ('open','reviewing','actioned','dismissed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_different_users check (reporter_id <> reported_id)
);
create index if not exists idx_reports_reporter_id on reports(reporter_id);
create index if not exists idx_reports_reported_id on reports(reported_id);
create index if not exists idx_reports_status on reports(status);

-- --------------------------------------------------
-- TABLE: message_audit_log  (append-only compliance backbone, §4.5)
-- One row per send attempt, allowed or not. Service role inserts only;
-- no UPDATE/DELETE grants to anyone (enforced by absence of policies + grants).
-- --------------------------------------------------
create table if not exists message_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null references auth.users(id) on delete set null,
  conversation_id uuid null,
  message_id uuid null,
  decision text not null check (
    decision in ('allowed','blocked_content','blocked_rate','blocked_relationship')
  ),
  filter_verdicts jsonb not null default '{}'::jsonb,
  rate_state jsonb not null default '{}'::jsonb,
  raw_excerpt text null,
  created_at timestamptz not null default now()
);
create index if not exists idx_message_audit_log_actor_created_at
  on message_audit_log(actor_id, created_at desc);
create index if not exists idx_message_audit_log_created_at
  on message_audit_log(created_at);

-- --------------------------------------------------
-- TRIGGERS: updated_at
-- --------------------------------------------------
create trigger update_conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create trigger update_reports_updated_at
  before update on reports
  for each row execute function set_updated_at();

-- --------------------------------------------------
-- Enable RLS (policies added in the RLS migration). Locked-down by default.
-- --------------------------------------------------
alter table conversations enable row level security;
alter table messages enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
alter table message_audit_log enable row level security;
