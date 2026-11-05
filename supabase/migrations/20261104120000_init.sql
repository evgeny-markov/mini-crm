-- Мини-CRM: объекты, задачи, история статусов и права на уровне Postgres.
-- Клиент ходит только с anon key. service_role в этот файл и во фронтенд не входит.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null,
  constraint profiles_role_check check (role in ('manager', 'executor')),
  constraint profiles_name_not_blank check (length(btrim(full_name)) > 0)
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  address text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint objects_title_not_blank check (length(btrim(title)) > 0),
  constraint objects_address_not_blank check (length(btrim(address)) > 0)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id uuid not null references public.profiles (id),
  status text not null default 'new',
  author_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_status_check check (
    status in ('new', 'in_progress', 'review', 'accepted', 'rework')
  )
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  from_status text,
  to_status text not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint history_from_status_check check (
    from_status is null
    or from_status in ('new', 'in_progress', 'review', 'accepted', 'rework')
  ),
  constraint history_to_status_check check (
    to_status in ('new', 'in_progress', 'review', 'accepted', 'rework')
  )
);

create index objects_created_by_idx on public.objects (created_by);
create index tasks_object_id_idx on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_author_id_idx on public.tasks (author_id);
create index task_status_history_task_id_idx on public.task_status_history (task_id);

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_user_role() = 'manager'
$$;

create or replace function private.is_executor(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'executor'
  )
$$;

revoke all on function private.current_user_role() from public;
revoke all on function private.is_manager() from public;
revoke all on function private.is_executor(uuid) from public;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_manager() to authenticated;
grant execute on function private.is_executor(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    case
      when new.raw_app_meta_data ->> 'role' = 'manager' then 'manager'
      else 'executor'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.guard_object()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not private.is_manager() then
      raise exception 'Удалять объект может только постановщик';
    end if;
    return old;
  end if;

  if not private.is_manager() then
    raise exception 'Менять объекты может только постановщик';
  end if;

  if tg_op = 'INSERT' and new.created_by is distinct from auth.uid() then
    raise exception 'Автор объекта — текущий постановщик';
  end if;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

create trigger objects_guard
  before insert or update or delete on public.objects
  for each row
  execute function public.guard_object();

create or replace function public.guard_task()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not private.is_manager() then
      raise exception 'Удалять задачу может только постановщик';
    end if;
    return old;
  end if;

  if not private.is_executor(new.assignee_id) then
    raise exception 'Исполнителем можно назначить только исполнителя';
  end if;

  if tg_op = 'INSERT' then
    if not private.is_manager() then
      raise exception 'Создавать задачу может только постановщик';
    end if;
    if new.author_id is distinct from auth.uid() then
      raise exception 'Автор задачи — текущий постановщик';
    end if;
    if new.status <> 'new' then
      raise exception 'Задача создаётся только в статусе «Новая»';
    end if;
    return new;
  end if;

  if new.author_id is distinct from old.author_id then
    raise exception 'Автора задачи нельзя менять';
  end if;

  new.created_at := old.created_at;

  if new.status is distinct from old.status then
    if current_setting('app.allow_status_change', true) is distinct from 'on' then
      raise exception 'Статус меняется только через transition_task';
    end if;
    return new;
  end if;

  if not private.is_manager() then
    raise exception 'Менять задачу может только постановщик';
  end if;

  return new;
end;
$$;

create trigger tasks_guard
  before insert or update or delete on public.tasks
  for each row
  execute function public.guard_task();

create or replace function public.write_initial_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_status_history (task_id, actor_id, from_status, to_status, comment)
  values (new.id, new.author_id, null, 'new', null);

  return new;
end;
$$;

create trigger tasks_initial_history
  after insert on public.tasks
  for each row
  execute function public.write_initial_history();

create or replace function public.transition_task(
  task_id uuid,
  to_status text,
  comment text
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.tasks;
  previous_status text;
  next_comment text;
begin
  if auth.uid() is null then
    raise exception 'Нужна авторизация';
  end if;

  select *
  into current_task
  from public.tasks
  where id = task_id
  for update;

  if not found then
    raise exception 'Задача не найдена';
  end if;

  if private.current_user_role() = 'executor' and current_task.assignee_id is distinct from auth.uid() then
    raise exception 'Задача не найдена';
  end if;

  if private.current_user_role() is distinct from 'manager'
     and private.current_user_role() is distinct from 'executor' then
    raise exception 'Неизвестная роль';
  end if;

  previous_status := current_task.status;
  next_comment := null;

  if previous_status = 'new' and to_status = 'in_progress' then
    if private.current_user_role() <> 'executor' or current_task.assignee_id is distinct from auth.uid() then
      raise exception 'В работу берёт только назначенный исполнитель';
    end if;
  elsif previous_status = 'in_progress' and to_status = 'review' then
    if private.current_user_role() <> 'executor' or current_task.assignee_id is distinct from auth.uid() then
      raise exception 'На проверку отправляет только назначенный исполнитель';
    end if;
  elsif previous_status = 'review' and to_status = 'accepted' then
    if not private.is_manager() then
      raise exception 'Принять задачу может только постановщик';
    end if;
  elsif previous_status = 'review' and to_status = 'rework' then
    if not private.is_manager() then
      raise exception 'Вернуть на доработку может только постановщик';
    end if;
    next_comment := nullif(btrim(coalesce(comment, '')), '');
    if next_comment is null then
      raise exception 'Комментарий обязателен';
    end if;
  elsif previous_status = 'rework' and to_status = 'in_progress' then
    if private.current_user_role() <> 'executor' or current_task.assignee_id is distinct from auth.uid() then
      raise exception 'В работу берёт только назначенный исполнитель';
    end if;
  else
    raise exception 'Такой переход запрещён';
  end if;

  perform set_config('app.allow_status_change', 'on', true);

  update public.tasks
  set status = to_status
  where id = current_task.id
  returning * into current_task;

  perform set_config('app.allow_status_change', 'off', true);

  insert into public.task_status_history (task_id, actor_id, from_status, to_status, comment)
  values (current_task.id, auth.uid(), previous_status, to_status, next_comment);

  return current_task;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.guard_object() from public;
revoke all on function public.guard_task() from public;
revoke all on function public.write_initial_history() from public;
revoke all on function public.transition_task(uuid, text, text) from public;
grant execute on function public.transition_task(uuid, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or private.is_manager()
    or exists (
      select 1
      from public.tasks
      where tasks.assignee_id = auth.uid()
        and (tasks.author_id = profiles.id or tasks.assignee_id = profiles.id)
    )
    or exists (
      select 1
      from public.task_status_history
      join public.tasks on tasks.id = task_status_history.task_id
      where tasks.assignee_id = auth.uid()
        and task_status_history.actor_id = profiles.id
    )
  );

create policy objects_select on public.objects
  for select to authenticated
  using (
    private.is_manager()
    or exists (
      select 1
      from public.tasks
      where tasks.object_id = objects.id
        and tasks.assignee_id = auth.uid()
    )
  );

create policy objects_insert on public.objects
  for insert to authenticated
  with check (private.is_manager() and created_by = auth.uid());

create policy objects_update on public.objects
  for update to authenticated
  using (
    private.is_manager()
    or exists (
      select 1
      from public.tasks
      where tasks.object_id = objects.id
        and tasks.assignee_id = auth.uid()
    )
  )
  with check (
    private.is_manager()
    or exists (
      select 1
      from public.tasks
      where tasks.object_id = objects.id
        and tasks.assignee_id = auth.uid()
    )
  );

create policy objects_delete on public.objects
  for delete to authenticated
  using (
    private.is_manager()
    or exists (
      select 1
      from public.tasks
      where tasks.object_id = objects.id
        and tasks.assignee_id = auth.uid()
    )
  );

create policy tasks_select on public.tasks
  for select to authenticated
  using (private.is_manager() or assignee_id = auth.uid());

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    private.is_manager()
    and author_id = auth.uid()
    and status = 'new'
    and private.is_executor(assignee_id)
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (private.is_manager() or assignee_id = auth.uid())
  with check (private.is_manager() or assignee_id = auth.uid());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (private.is_manager() or assignee_id = auth.uid());

create policy history_select on public.task_status_history
  for select to authenticated
  using (
    private.is_manager()
    or exists (
      select 1
      from public.tasks
      where tasks.id = task_status_history.task_id
        and tasks.assignee_id = auth.uid()
    )
  );

revoke all on public.profiles from anon, authenticated;
revoke all on public.objects from anon, authenticated;
revoke all on public.tasks from anon, authenticated;
revoke all on public.task_status_history from anon, authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.objects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.task_status_history to authenticated;
