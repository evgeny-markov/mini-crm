-- Демо-учётки и данные. Схему сначала применяет миграция.
-- Если вставка в auth.users не подойдёт к версии проекта, создайте этих
-- пользователей в Authentication с теми же email и паролями и запустите файл снова.

create or replace function private.seed_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_role text,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if exists (select 1 from auth.users where email = p_email) then
    return;
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'role', p_role
    ),
    jsonb_build_object('full_name', p_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    p_id,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_id::text,
    now(),
    now(),
    now()
  );
end;
$$;

create or replace function private.assume_user(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

revoke all on function private.seed_user(uuid, text, text, text, text) from public;
revoke all on function private.assume_user(uuid) from public;

do $seed$
declare
  manager_id uuid;
  ivan_id uuid;
  olga_id uuid;
  north_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  school_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  warehouse_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  task_new uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  task_progress uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  task_review uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
  task_rework uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
  task_accepted uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5';
begin
  begin
    perform private.seed_user(
      '11111111-1111-4111-8111-111111111111',
      'manager@example.com',
      'demo-manager',
      'manager',
      'Марина Соколова'
    );
    perform private.seed_user(
      '22222222-2222-4222-8222-222222222222',
      'ivan@example.com',
      'demo-ivan',
      'executor',
      'Иван Петров'
    );
    perform private.seed_user(
      '33333333-3333-4333-8333-333333333333',
      'olga@example.com',
      'demo-olga',
      'executor',
      'Ольга Смирнова'
    );
  exception
    when others then
      raise notice 'Вставка в auth.users не выполнилась: %. Создайте пользователей в панели и запустите seed ещё раз.', sqlerrm;
  end;

  select id into manager_id from auth.users where email = 'manager@example.com';
  select id into ivan_id from auth.users where email = 'ivan@example.com';
  select id into olga_id from auth.users where email = 'olga@example.com';

  if manager_id is null or ivan_id is null or olga_id is null then
    raise exception 'Нужны пользователи manager@example.com, ivan@example.com и olga@example.com';
  end if;

  insert into public.profiles (id, full_name, role) values
    (manager_id, 'Марина Соколова', 'manager'),
    (ivan_id, 'Иван Петров', 'executor'),
    (olga_id, 'Ольга Смирнова', 'executor')
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role;

  if exists (select 1 from public.objects where id = north_id) then
    return;
  end if;

  perform private.assume_user(manager_id);

  insert into public.objects (id, title, address, created_by, created_at) values
    (north_id, 'ЖК «Северный»', 'ул. Лесная, 12', manager_id, timestamptz '2026-03-01 09:00+03'),
    (school_id, 'Школа № 4', 'пр. Строителей, 7', manager_id, timestamptz '2026-03-01 09:10+03'),
    (warehouse_id, 'Склад на Обводной', 'наб. Обводного канала, 120', manager_id, timestamptz '2026-02-20 09:00+03');

  insert into public.tasks (
    id, object_id, title, description, assignee_id, status, author_id, created_at
  ) values
    (
      task_new, north_id, 'Согласовать ограждение котлована',
      'Согласовать схему ограждения с технадзором и приложить фото границ котлована.',
      ivan_id, 'new', manager_id, timestamptz '2026-03-02 09:00+03'
    ),
    (
      task_progress, north_id, 'Заказать бетон М300',
      'Поставка на пятницу, объём 24 м³. Поставщика согласовали на планёрке.',
      ivan_id, 'new', manager_id, timestamptz '2026-03-02 10:00+03'
    ),
    (
      task_review, school_id, 'Проверить армирование перекрытия',
      'Сверить шаг арматуры с проектом на отметке +3.300.',
      olga_id, 'new', manager_id, timestamptz '2026-03-04 09:00+03'
    ),
    (
      task_rework, school_id, 'Устранить замечания по электрике',
      'Замечания технадзора по щитовой на первом этаже.',
      ivan_id, 'new', manager_id, timestamptz '2026-03-01 09:00+03'
    ),
    (
      task_accepted, warehouse_id, 'Сдать исполнительную схему',
      'Исполнительная схема фундаментной плиты для архива заказчика.',
      olga_id, 'new', manager_id, timestamptz '2026-02-20 09:30+03'
    );

  perform private.assume_user(ivan_id);
  perform public.transition_task(task_progress, 'in_progress', null);
  perform public.transition_task(task_rework, 'in_progress', null);

  perform private.assume_user(olga_id);
  perform public.transition_task(task_review, 'in_progress', null);
  perform public.transition_task(task_review, 'review', null);
  perform public.transition_task(task_accepted, 'in_progress', null);
  perform public.transition_task(task_accepted, 'review', null);

  perform private.assume_user(ivan_id);
  perform public.transition_task(task_rework, 'review', null);

  perform private.assume_user(manager_id);
  perform public.transition_task(
    task_rework,
    'rework',
    'Нет акта скрытых работ, переделайте фотофиксацию щитовой.'
  );
  perform public.transition_task(task_accepted, 'accepted', null);

  update public.task_status_history
  set created_at = case
    when task_id = task_new and to_status = 'new' then timestamptz '2026-03-02 09:00+03'
    when task_id = task_progress and to_status = 'new' then timestamptz '2026-03-02 10:00+03'
    when task_id = task_progress and to_status = 'in_progress' then timestamptz '2026-03-03 11:00+03'
    when task_id = task_review and to_status = 'new' then timestamptz '2026-03-04 09:00+03'
    when task_id = task_review and to_status = 'in_progress' then timestamptz '2026-03-04 12:00+03'
    when task_id = task_review and to_status = 'review' then timestamptz '2026-03-05 15:00+03'
    when task_id = task_rework and to_status = 'new' then timestamptz '2026-03-01 09:00+03'
    when task_id = task_rework and to_status = 'in_progress' then timestamptz '2026-03-01 11:00+03'
    when task_id = task_rework and to_status = 'review' then timestamptz '2026-03-02 16:00+03'
    when task_id = task_rework and to_status = 'rework' then timestamptz '2026-03-03 10:00+03'
    when task_id = task_accepted and to_status = 'new' then timestamptz '2026-02-20 09:30+03'
    when task_id = task_accepted and to_status = 'in_progress' then timestamptz '2026-02-20 12:00+03'
    when task_id = task_accepted and to_status = 'review' then timestamptz '2026-02-21 15:00+03'
    when task_id = task_accepted and to_status = 'accepted' then timestamptz '2026-02-22 11:00+03'
    else created_at
  end
  where task_id in (task_new, task_progress, task_review, task_rework, task_accepted);
end;
$seed$;

drop function private.seed_user(uuid, text, text, text, text);
drop function private.assume_user(uuid);
