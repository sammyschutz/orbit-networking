# Supabase Migrations Guide

A reference for managing database schema changes in this project using the Supabase CLI migration workflow.

---

## Core Concept

Migrations are the source of truth for your database schema. Each migration is a `.sql` file that describes a specific, forward-only change. Think of them like git commits — you never edit history, you only add new changes on top.

```
supabase/migrations/
  20240601000000_initial_schema.sql     ← never touch once pushed
  20240608000000_add_messages_table.sql ← never touch once pushed
  20240615000000_add_bio_to_profiles.sql ← your latest change
```

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Project linked: `supabase link --project-ref <your-project-ref>`

---

## Daily Workflow

### 1. Create a migration

```bash
supabase migration new <descriptive_name>
```

Examples:
```bash
supabase migration new add_messages_table
supabase migration new add_bio_to_profiles
supabase migration new drop_legacy_interests_table
```

This generates a timestamped file in `supabase/migrations/`. Open it and write your SQL.

### 2. Write your SQL

Edit the generated file. Keep each migration focused on one logical change.

**Adding a table:**
```sql
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
```

**Adding a column:**
```sql
alter table profiles add column if not exists linkedin_url text;
```

**Renaming a column:**
```sql
alter table profiles rename column photo_url to avatar_url;
```

**Dropping a column:**
```sql
alter table profiles drop column if exists side_project;
```

**Adding an index:**
```sql
create index if not exists idx_messages_sender_id on messages(sender_id);
```

**Adding a policy:**
```sql
create policy messages_select on messages
  for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
```

### 3. Push to your remote database

```bash
supabase db push
```

Supabase applies only migrations that haven't been run yet, in order.

### 4. Verify

```bash
supabase migration list
```

All pushed migrations will show as `applied`.

---

## Fixing Mistakes

If you pushed a migration with an error, **do not edit the original file**. Create a new migration that corrects it:

```bash
supabase migration new fix_messages_sender_column
```

```sql
-- correct the mistake from the previous migration
alter table messages rename column sender to sender_id;
```

---

## Marking an Existing Schema as Applied

If you applied your schema manually (e.g. via `db query`) before setting up migrations, mark it so Supabase doesn't try to re-run it:

```bash
# Find your migration filename
ls supabase/migrations/

# Mark it as already applied (use your actual timestamp)
supabase migration repair --status applied 20240601000000
```

---

## Starting Fresh from a Live Database

If your remote database already has tables and you want to generate migrations from it:

```bash
supabase db pull
```

This snapshots your current remote schema into a migration file. Commit it, and use `db push` for all future changes.

---

## Rules

| ✅ Do | ❌ Don't |
|---|---|
| Create a new migration for every change | Edit a migration that has already been pushed |
| Use descriptive migration names | Use vague names like `update` or `fix` |
| Keep each migration focused and small | Combine unrelated changes in one migration |
| Use `if not exists` / `if exists` guards where possible | Assume the current state of the database |
| Run `supabase migration list` to verify | Manually run SQL against production |

---

## Quick Reference

| Task | Command |
|---|---|
| Create a new migration | `supabase migration new <name>` |
| Push pending migrations | `supabase db push` |
| List all migrations and status | `supabase migration list` |
| Pull remote schema as migration | `supabase db pull` |
| Mark a migration as applied | `supabase migration repair --status applied <timestamp>` |
| Link project | `supabase link --project-ref <ref>` |