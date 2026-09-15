-- DeHax Editor V3.0.0
-- Biblioteca hierárquica, tags por categoria e preparação de metadados.
-- Migration aditiva: mantém categorias, subcategorias e assets existentes.

create table if not exists public.asset_subcategory_links (
  id uuid primary key default gen_random_uuid(),
  parent_subcategory_id uuid not null references public.asset_subcategories(id) on delete cascade,
  child_subcategory_id uuid not null references public.asset_subcategories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint asset_subcategory_links_distinct check (parent_subcategory_id <> child_subcategory_id),
  constraint asset_subcategory_links_unique unique (parent_subcategory_id, child_subcategory_id)
);

create index if not exists idx_asset_subcategory_links_parent
  on public.asset_subcategory_links(parent_subcategory_id, sort_order);
create index if not exists idx_asset_subcategory_links_child
  on public.asset_subcategory_links(child_subcategory_id);

create table if not exists public.asset_category_tags (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.asset_categories(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('active','paused')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_category_tags_name_unique unique(category_id, name),
  constraint asset_category_tags_slug_unique unique(category_id, slug)
);

create index if not exists idx_asset_category_tags_category
  on public.asset_category_tags(category_id, sort_order);

alter table public.assets
  add column if not exists metadata_status text not null default 'pending';
alter table public.assets
  add column if not exists metadata_version integer not null default 0;

alter table public.assets drop constraint if exists assets_metadata_status_check;
alter table public.assets
  add constraint assets_metadata_status_check
  check (metadata_status in ('pending','applied','unsupported','error'));

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='asset_category_tags_updated_at') then
    create trigger asset_category_tags_updated_at
      before update on public.asset_category_tags
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.asset_subcategory_links enable row level security;
alter table public.asset_category_tags enable row level security;

drop policy if exists asset_subcategory_links_read on public.asset_subcategory_links;
drop policy if exists asset_subcategory_links_admin on public.asset_subcategory_links;
drop policy if exists asset_category_tags_read on public.asset_category_tags;
drop policy if exists asset_category_tags_admin on public.asset_category_tags;

create policy asset_subcategory_links_read
  on public.asset_subcategory_links for select
  using (true);
create policy asset_subcategory_links_admin
  on public.asset_subcategory_links for all
  using (public.is_admin()) with check (public.is_admin());

create policy asset_category_tags_read
  on public.asset_category_tags for select
  using (status='active' or public.is_admin());
create policy asset_category_tags_admin
  on public.asset_category_tags for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.asset_subcategory_links, public.asset_category_tags to anon, authenticated;
grant insert, update, delete on public.asset_subcategory_links, public.asset_category_tags to authenticated;
