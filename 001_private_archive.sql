-- Apply only to the NEW private-archive project: ebzcuotuvvqtealoqzax.
-- No members are automatically admitted. Run once, atomically.
begin;
create table public.pa_members (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.pa_members enable row level security;
revoke all on public.pa_members from anon, authenticated;

create function public.pa_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.pa_members where user_id = auth.uid()
  );
$$;
revoke all on function public.pa_is_member() from public, anon;
grant execute on function public.pa_is_member() to authenticated;

create table public.pa_archives (
  owner_id uuid primary key references public.pa_members(user_id),
  revision bigint not null default 0 check(revision >= 0),
  manifest jsonb not null default '{"images":[],"folders":[]}',
  updated_at timestamptz not null default now()
);
alter table public.pa_archives enable row level security;
revoke all on public.pa_archives from anon, authenticated;
grant select on public.pa_archives to authenticated;
create policy pa_read_own on public.pa_archives for select to authenticated
using (owner_id = (select auth.uid()) and (select public.pa_is_member()));

create function public.pa_valid_folder(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and length(p) between 1 and 400
    and cardinality(string_to_array(p,'/')) <= 8
    and not exists(select 1 from unnest(string_to_array(p,'/')) s
      where length(s) not between 1 and 80 or btrim(s) <> s);
$$;
revoke all on function public.pa_valid_folder(text) from public, anon, authenticated;

create function public.pa_save_archive(expected_revision bigint, new_manifest jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_revision bigint;
  x jsonb;
  folder jsonb;
  ids text[] := '{}';
  total_size bigint := 0;
  stored_size bigint;
  stamp timestamp;
begin
  if uid is null or not public.pa_is_member() then
    raise exception 'Not a registered member' using errcode='42501';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid revision' using errcode='22023';
  end if;
  if new_manifest is null or jsonb_typeof(new_manifest) <> 'object'
    or jsonb_typeof(new_manifest->'images') is distinct from 'array'
    or jsonb_typeof(new_manifest->'folders') is distinct from 'array'
    or octet_length(new_manifest::text) > 16000000 then
    raise exception 'Invalid archive' using errcode='22023';
  end if;
  if jsonb_array_length(new_manifest->'images') > 5000
    or jsonb_array_length(new_manifest->'folders') > 5000 then
    raise exception 'Too many entries' using errcode='22023';
  end if;
  for folder in select value from jsonb_array_elements(new_manifest->'folders') loop
    if jsonb_typeof(folder) <> 'string' or not public.pa_valid_folder(folder #>> '{}') then
      raise exception 'Invalid folder' using errcode='22023';
    end if;
  end loop;
  for x in select value from jsonb_array_elements(new_manifest->'images') loop
    if jsonb_typeof(x) <> 'object'
      or not (x ?& array['id','title','album','note','date','dateSource','favorite','trashed','added','width','height','hash','type','size'])
      or jsonb_typeof(x->'id') <> 'string' or (x->>'id') !~ '^[a-zA-Z0-9-]{1,80}$'
      or (x->>'id') = any(ids)
      or jsonb_typeof(x->'title') <> 'string' or length(btrim(x->>'title')) not between 1 and 150
      or jsonb_typeof(x->'note') <> 'string' or length(x->>'note') > 3000
      or jsonb_typeof(x->'album') <> 'string'
      or ((x->>'album') <> '' and not public.pa_valid_folder(x->>'album'))
      or jsonb_typeof(x->'favorite') <> 'boolean' or jsonb_typeof(x->'trashed') <> 'boolean'
      or jsonb_typeof(x->'date') <> 'string' or (x->>'date') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$'
      or (x->>'dateSource') not in ('exif','manual','file')
      or jsonb_typeof(x->'hash') <> 'string' or (x->>'hash') !~ '^[a-f0-9]{64}$'
      or (x->>'type') not in ('image/jpeg','image/png','image/webp')
      or jsonb_typeof(x->'size') <> 'number' or (x->>'size') !~ '^[0-9]{1,8}$'
      or jsonb_typeof(x->'width') <> 'number' or (x->>'width') !~ '^[0-9]{1,8}$'
      or jsonb_typeof(x->'height') <> 'number' or (x->>'height') !~ '^[0-9]{1,8}$'
      or jsonb_typeof(x->'added') <> 'number' or (x->>'added') !~ '^[0-9]{1,16}$'
      or x->'dateSource' = 'null'::jsonb or x->'type' = 'null'::jsonb then
      raise exception 'Invalid image metadata' using errcode='22023';
    end if;
    stamp := (x->>'date')::timestamp;
    if (x->>'size')::bigint not between 1 and 31457280
      or (x->>'width')::bigint < 1 or (x->>'height')::bigint < 1
      or (x->>'width')::bigint * (x->>'height')::bigint > 60000000 then
      raise exception 'Image exceeds limits' using errcode='22023';
    end if;
    select (metadata->>'size')::bigint into stored_size from storage.objects
      where bucket_id='private-archive' and name=uid::text||'/'||(x->>'hash');
    if stored_size is null or stored_size <> (x->>'size')::bigint then
      raise exception 'Original not uploaded or size mismatch' using errcode='22023';
    end if;
    ids := array_append(ids,x->>'id');
    total_size := total_size + (x->>'size')::bigint;
  end loop;
  if total_size > 314572800 then
    raise exception 'Archive exceeds 300 MiB' using errcode='22023';
  end if;
  -- Serializes first and subsequent saves for this owner, including revision 0.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  insert into public.pa_archives(owner_id) values(uid) on conflict do nothing;
  select revision into current_revision from public.pa_archives where owner_id=uid for update;
  if current_revision <> expected_revision then
    raise exception 'Revision conflict' using errcode='40001';
  end if;
  update public.pa_archives set manifest=jsonb_build_object('images',new_manifest->'images','folders',new_manifest->'folders'),
    revision=current_revision+1,updated_at=now() where owner_id=uid;
  return jsonb_build_object('revision',current_revision+1);
end;
$$;
revoke all on function public.pa_save_archive(bigint,jsonb) from public, anon;
grant execute on function public.pa_save_archive(bigint,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('private-archive','private-archive',false,31457280,array['image/jpeg','image/png','image/webp']);
create policy pa_storage_read on storage.objects for select to authenticated
using (bucket_id='private-archive' and (select public.pa_is_member())
  and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy pa_storage_insert on storage.objects for insert to authenticated
with check (bucket_id='private-archive' and (select public.pa_is_member())
  and name ~ ('^'||(select auth.uid())::text||'/[a-f0-9]{64}$'));
-- No client UPDATE or DELETE policy: originals are immutable; trash is metadata.
commit;
