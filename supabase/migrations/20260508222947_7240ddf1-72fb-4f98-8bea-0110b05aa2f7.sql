create table public.chat_google_links (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null unique,
  google_space_name text not null,
  criado_por text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.chat_google_links enable row level security;

create policy "Anon can select chat_google_links"
  on public.chat_google_links for select to anon using (true);

create policy "Authenticated can manage chat_google_links"
  on public.chat_google_links for all to authenticated using (true) with check (true);