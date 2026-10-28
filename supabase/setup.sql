-- Planungsapp: Tabelle für den verschlüsselten Cloud-Sync.
-- In Supabase unter „SQL Editor“ → „New query“ einfügen und auf „Run“ tippen.
--
-- Pro Konto gibt es genau eine Zeile. Sie enthält nur verschlüsselte Daten (data), den Zufallswert der
-- Verschlüsselung (iv) und das Salz für das Sync-Passwort (salt) – nichts davon ist ohne das Sync-Passwort lesbar.
-- Die Zugriffsregeln (Row Level Security) sorgen dafür, dass jedes Konto nur seine eigene Zeile sieht.

create table if not exists public.vaults (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  salt text not null,
  iv text not null,
  data text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

drop policy if exists "eigene Zeile lesen" on public.vaults;
drop policy if exists "eigene Zeile anlegen" on public.vaults;
drop policy if exists "eigene Zeile ändern" on public.vaults;
drop policy if exists "eigene Zeile löschen" on public.vaults;

create policy "eigene Zeile lesen" on public.vaults
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "eigene Zeile anlegen" on public.vaults
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eigene Zeile ändern" on public.vaults
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "eigene Zeile löschen" on public.vaults
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Nur angemeldete Konten dürfen überhaupt auf die Tabelle zugreifen (nicht anonym).
revoke all on public.vaults from anon;
grant select, insert, update, delete on public.vaults to authenticated;
