create table if not exists public.chat_google_links (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null unique,
  google_space_name text not null,
  criado_por text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.chat_google_links enable row level security;

drop policy if exists "Anon can select chat_google_links" on public.chat_google_links;
drop policy if exists "Authenticated can manage chat_google_links" on public.chat_google_links;

create policy "Anon can select chat_google_links" on public.chat_google_links for select to anon using (true);
create policy "Anon can insert chat_google_links" on public.chat_google_links for insert to anon with check (true);
create policy "Anon can update chat_google_links" on public.chat_google_links for update to anon using (true) with check (true);
create policy "Anon can delete chat_google_links" on public.chat_google_links for delete to anon using (true);
create policy "Authenticated can manage chat_google_links" on public.chat_google_links for all to authenticated using (true) with check (true);