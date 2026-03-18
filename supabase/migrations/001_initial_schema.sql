-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  plan text default 'free' check (plan in ('free', 'pro', 'team')),
  credits_remaining int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Guide groups
create table public.guide_groups (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- Guides
create table public.guides (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  keyword text not null,
  language text default 'fr' check (language in ('fr', 'en', 'it', 'de', 'es')),
  search_engine text default 'google.fr',
  content jsonb default '{}',
  meta_title text default '',
  meta_description text default '',
  linked_url text,
  group_id uuid references public.guide_groups(id) on delete set null,
  visibility text default 'private' check (visibility in ('private', 'read', 'edit')),
  share_token text unique,
  score int default 0 check (score >= 0 and score <= 120),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SERP analyses
create table public.serp_analyses (
  id uuid default uuid_generate_v4() primary key,
  guide_id uuid references public.guides(id) on delete cascade unique not null,
  keyword text not null,
  language text not null,
  analyzed_at timestamptz default now(),
  structural_benchmarks jsonb default '{}',
  refresh_interval_months int default 6,
  refresh_recommended_at timestamptz,
  created_at timestamptz default now()
);

-- SERP pages
create table public.serp_pages (
  id uuid default uuid_generate_v4() primary key,
  serp_analysis_id uuid references public.serp_analyses(id) on delete cascade not null,
  url text not null,
  title text not null,
  score int default 0,
  is_excluded boolean default false,
  metrics jsonb default '{}',
  term_occurrences jsonb default '{}',
  position int not null
);

-- Semantic terms
create table public.semantic_terms (
  id uuid default uuid_generate_v4() primary key,
  serp_analysis_id uuid references public.serp_analyses(id) on delete cascade not null,
  term text not null,
  display_term text not null,
  is_main_keyword boolean default false,
  min_occurrences int default 0,
  max_occurrences int default 0,
  importance float default 1.0,
  term_type text default 'unigram' check (term_type in ('unigram', 'bigram', 'trigram', 'phrase')),
  is_to_avoid boolean default false
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.guides enable row level security;
alter table public.serp_analyses enable row level security;
alter table public.serp_pages enable row level security;
alter table public.semantic_terms enable row level security;
alter table public.guide_groups enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Guides: users can CRUD their own guides
create policy "Users can view own guides" on public.guides for select using (auth.uid() = user_id);
create policy "Users can insert own guides" on public.guides for insert with check (auth.uid() = user_id);
create policy "Users can update own guides" on public.guides for update using (auth.uid() = user_id);
create policy "Users can delete own guides" on public.guides for delete using (auth.uid() = user_id);

-- SERP analyses: via guide ownership
create policy "Users can view own serp analyses" on public.serp_analyses for select
  using (guide_id in (select id from public.guides where user_id = auth.uid()));
create policy "Users can insert own serp analyses" on public.serp_analyses for insert
  with check (guide_id in (select id from public.guides where user_id = auth.uid()));
create policy "Users can update own serp analyses" on public.serp_analyses for update
  using (guide_id in (select id from public.guides where user_id = auth.uid()));
create policy "Users can delete own serp analyses" on public.serp_analyses for delete
  using (guide_id in (select id from public.guides where user_id = auth.uid()));

-- SERP pages: via serp_analysis -> guide ownership
create policy "Users can view own serp pages" on public.serp_pages for select
  using (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));
create policy "Users can insert own serp pages" on public.serp_pages for insert
  with check (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));

-- Semantic terms: via serp_analysis -> guide ownership
create policy "Users can view own semantic terms" on public.semantic_terms for select
  using (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));
create policy "Users can insert own semantic terms" on public.semantic_terms for insert
  with check (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));

-- Guide groups
create policy "Users can view own guide groups" on public.guide_groups for select using (auth.uid() = user_id);
create policy "Users can insert own guide groups" on public.guide_groups for insert with check (auth.uid() = user_id);
create policy "Users can delete own guide groups" on public.guide_groups for delete using (auth.uid() = user_id);
