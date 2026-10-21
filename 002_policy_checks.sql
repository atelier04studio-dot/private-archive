-- Transactional role tests, not a substitute for two real JWT/API tests.
-- Fixtures and changes are rolled back, including on a failed assertion.
begin;
insert into auth.users(id) values
 ('aaaaaaaa-0000-4000-8000-000000000001'),
 ('bbbbbbbb-0000-4000-8000-000000000002'),
 ('cccccccc-0000-4000-8000-000000000003');
insert into public.pa_members(user_id) values
 ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name,metadata) values
 ('private-archive','aaaaaaaa-0000-4000-8000-000000000001/'||repeat('a',64),'{"size":3,"mimetype":"image/png"}'),
 ('private-archive','bbbbbbbb-0000-4000-8000-000000000002/'||repeat('b',64),'{"size":3,"mimetype":"image/png"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
do $$ begin
 if not public.pa_is_member() then raise exception 'A membership failed'; end if;
 perform public.pa_save_archive(0,'{"images":[],"folders":["作品"]}');
 if (select count(*) from public.pa_archives)<>1 then raise exception 'A own archive failed'; end if;
 if (select count(*) from storage.objects where bucket_id='private-archive')<>1 then raise exception 'A storage isolation failed'; end if;
 begin
   perform public.pa_save_archive(0,'{"images":[],"folders":[]}');
   raise exception 'Stale revision accepted';
 exception when serialization_failure then null; end;
 begin
   perform public.pa_save_archive(1,'{"images":[],"folders":["bad//path"]}');
   raise exception 'Invalid folder accepted';
 exception when invalid_parameter_value then null; end;
 begin
   insert into public.pa_members(user_id) values('cccccccc-0000-4000-8000-000000000003');
   raise exception 'Self enrollment accepted';
 exception when insufficient_privilege then null; end;
 begin
   insert into storage.objects(bucket_id,name) values('private-archive','bbbbbbbb-0000-4000-8000-000000000002/'||repeat('c',64));
   raise exception 'Cross-owner upload accepted';
 exception when insufficient_privilege then null; end;
 update storage.objects set name='changed' where bucket_id='private-archive';
 if found then raise exception 'Original overwrite accepted'; end if;
 begin
   delete from storage.objects where bucket_id='private-archive';
   if found then raise exception 'Original deletion accepted'; end if;
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.pa_archives)<>0 then raise exception 'B can read A'; end if;
 perform public.pa_save_archive(0,'{"images":[],"folders":[]}');
 if (select count(*) from public.pa_archives)<>1 then raise exception 'B own archive failed'; end if;
 if (select count(*) from storage.objects where bucket_id='private-archive')<>1 then raise exception 'B storage isolation failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000003',true);
do $$ begin
 if public.pa_is_member() then raise exception 'Uninvited member accepted'; end if;
 if (select count(*) from public.pa_archives)<>0 then raise exception 'Uninvited archive leak'; end if;
 if (select count(*) from storage.objects where bucket_id='private-archive')<>0 then raise exception 'Uninvited storage leak'; end if;
 begin
   perform public.pa_save_archive(0,'{"images":[],"folders":[]}');
   raise exception 'Uninvited write accepted';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
   perform * from public.pa_archives;
   raise exception 'Anonymous read accepted';
 exception when insufficient_privilege then null; end;
 begin
   perform public.pa_save_archive(0,'{"images":[],"folders":[]}');
   raise exception 'Anonymous write accepted';
 exception when insufficient_privilege then null; end;
 if (select count(*) from storage.objects where bucket_id='private-archive')<>0 then raise exception 'Anonymous storage leak'; end if;
end $$;
reset role;
rollback;
select 'PASS: role isolation, revision conflict, validation; fixtures rolled back' as result;
