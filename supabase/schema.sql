-- Cristian Deportivas · cuentas de usuario + planilla compartida (Supabase, plan gratuito)
-- Pegá TODO este archivo en Supabase > SQL Editor > New query y tocá "Run". Se puede ejecutar más de una vez
-- (conserva usuarios y datos; solo actualiza las funciones).
--
-- Cómo funciona:
--   · Cada persona se registra con usuario + contraseña (se guardan cifradas con bcrypt, nunca en claro).
--   · TODA cuenta nueva queda pendiente: Cris, Vale (administradores) aprueban si entra como lector o como editor.
--   · Los administradores pueden: aprobar, cambiar permisos, dar/quitar el rol de administrador,
--     restablecer contraseñas (clave temporal) y eliminar usuarios.
--   · Todo se controla en el servidor: sin sesión válida no se lee ni se escribe nada, y solo los editores guardan.

create extension if not exists pgcrypto with schema extensions;

-- Sistema anterior (código de acceso) y funciones cuyo formato cambió
drop function if exists public.room_get(text);
drop function if exists public.room_set(text, jsonb, bigint);
drop table if exists public.rooms;
drop function if exists public.app_login(text, text, boolean);
drop function if exists public.app_me(text);
drop function if exists public.admin_list(text);
drop function if exists public.admin_get_settings(text);
drop function if exists public.admin_set_auto_read(text, boolean);

create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  display_name  text not null,
  pass_hash     text not null,
  role          text not null default 'pending' check (role in ('pending', 'read', 'edit', 'blocked')),
  is_admin      boolean not null default false,
  wants_edit    boolean not null default false,   -- pidió poder editar
  must_change   boolean not null default false,   -- tiene una clave temporal y debe elegir una nueva
  fail_count    int not null default 0,
  locked_until  timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.app_users add column if not exists must_change boolean not null default false;

create table if not exists public.app_sessions (
  token_hash  text primary key,
  user_id     uuid not null references public.app_users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create table if not exists public.app_state (
  id          int primary key default 1 check (id = 1),
  state       jsonb not null,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now()
);

-- (tabla de ajustes de versiones anteriores: ya no se usa, se deja vacía)
create table if not exists public.app_settings (key text primary key, value jsonb not null);

-- Las tablas quedan cerradas: nadie las toca directo, solo a través de las funciones de abajo.
alter table public.app_users    enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_state    enable row level security;
alter table public.app_settings enable row level security;

-- ---------- helpers internos ----------
create or replace function public._session_user(p_token text)
returns public.app_users
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  select au.* into u
    from public.app_sessions s
    join public.app_users au on au.id = s.user_id
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now()
     and au.role <> 'blocked';
  return u;   -- u.id es null si no hay sesión válida
end;
$$;

-- Devuelve el administrador de la sesión o corta con error
create or replace function public._require_admin(p_token text)
returns public.app_users
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  u := public._session_user(p_token);
  if u.id is null then raise exception 'unauthorized'; end if;
  if not (u.is_admin and u.role = 'edit') then raise exception 'forbidden'; end if;
  return u;
end;
$$;

-- ---------- registro e inicio de sesión ----------
create or replace function public.app_register(p_username text, p_password text, p_display text, p_wants_edit boolean)
returns table (out_ok boolean, out_message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uname text := lower(trim(coalesce(p_username, '')));
  dname text := trim(coalesce(p_display, ''));
begin
  if uname !~ '^[a-z0-9._-]{3,30}$' then
    return query select false, 'El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.'; return;
  end if;
  if length(coalesce(p_password, '')) < 8 then
    return query select false, 'La contraseña debe tener al menos 8 caracteres.'; return;
  end if;
  if length(dname) < 2 or length(dname) > 30 then
    return query select false, 'El nombre que se muestra debe tener entre 2 y 30 caracteres.'; return;
  end if;
  if (select count(*) from public.app_users) >= 100 then
    return query select false, 'Se alcanzó el límite de usuarios.'; return;
  end if;
  if exists (select 1 from public.app_users where username = uname) then
    return query select false, 'Ese usuario ya existe. Probá con otro.'; return;
  end if;

  -- toda cuenta nueva espera la aprobación de un administrador
  insert into public.app_users (username, display_name, pass_hash, role, wants_edit)
  values (uname, dname, crypt(p_password, gen_salt('bf', 10)), 'pending', coalesce(p_wants_edit, false));
  return query select true, 'ok';
end;
$$;

create or replace function public.app_login(p_username text, p_password text, p_remember boolean)
returns table (out_ok boolean, out_error text, out_token text, out_username text, out_display text, out_role text, out_admin boolean, out_wants boolean, out_must_change boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u   public.app_users;
  tok text;
begin
  select * into u from public.app_users where username = lower(trim(coalesce(p_username, '')));

  if not found then
    perform pg_sleep(0.5);
    return query select false, 'Usuario o contraseña incorrectos.', null::text, null::text, null::text, null::text, null::boolean, null::boolean, null::boolean; return;
  end if;

  if u.locked_until is not null and u.locked_until > now() then
    return query select false, 'Demasiados intentos. Probá de nuevo en unos minutos.', null::text, null::text, null::text, null::text, null::boolean, null::boolean, null::boolean; return;
  end if;

  if u.pass_hash <> crypt(coalesce(p_password, ''), u.pass_hash) then
    update public.app_users
       set fail_count   = case when fail_count + 1 >= 5 then 0 else fail_count + 1 end,
           locked_until = case when fail_count + 1 >= 5 then now() + interval '10 minutes' else null end
     where id = u.id;
    perform pg_sleep(0.5);
    return query select false, 'Usuario o contraseña incorrectos.', null::text, null::text, null::text, null::text, null::boolean, null::boolean, null::boolean; return;
  end if;

  if u.role = 'blocked' then
    return query select false, 'Tu cuenta está bloqueada. Hablá con Cris o Vale.', null::text, null::text, null::text, null::text, null::boolean, null::boolean, null::boolean; return;
  end if;

  update public.app_users set fail_count = 0, locked_until = null where id = u.id;

  tok := encode(gen_random_bytes(32), 'hex');
  insert into public.app_sessions (token_hash, user_id, expires_at)
  values (encode(digest(tok, 'sha256'), 'hex'), u.id,
          now() + case when coalesce(p_remember, false) then interval '30 days' else interval '1 day' end);
  delete from public.app_sessions where expires_at < now();

  return query select true, null::text, tok, u.username, u.display_name, u.role, u.is_admin, u.wants_edit, u.must_change;
end;
$$;

create or replace function public.app_me(p_token text)
returns table (out_username text, out_display text, out_role text, out_admin boolean, out_wants boolean, out_must_change boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  u := public._session_user(p_token);
  if u.id is null then return; end if;
  return query select u.username, u.display_name, u.role, u.is_admin, u.wants_edit, u.must_change;
end;
$$;

create or replace function public.app_logout(p_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.app_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Cambiar la propia contraseña (también sirve para reemplazar una clave temporal)
create or replace function public.app_change_password(p_token text, p_old text, p_new text)
returns table (out_ok boolean, out_message text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  u := public._session_user(p_token);
  if u.id is null then raise exception 'unauthorized'; end if;

  if u.pass_hash <> crypt(coalesce(p_old, ''), u.pass_hash) then
    perform pg_sleep(0.5);
    return query select false, 'La contraseña actual no es correcta.'; return;
  end if;
  if length(coalesce(p_new, '')) < 8 then
    return query select false, 'La contraseña nueva debe tener al menos 8 caracteres.'; return;
  end if;
  if p_new = p_old then
    return query select false, 'La contraseña nueva tiene que ser distinta de la actual.'; return;
  end if;

  update public.app_users
     set pass_hash = crypt(p_new, gen_salt('bf', 10)), must_change = false, fail_count = 0, locked_until = null
   where id = u.id;
  -- se cierran las demás sesiones de la persona (en otros equipos); esta sigue abierta
  delete from public.app_sessions
   where user_id = u.id and token_hash <> encode(digest(p_token, 'sha256'), 'hex');
  return query select true, 'ok';
end;
$$;

-- ---------- la planilla compartida ----------
create or replace function public.state_get(p_token text)
returns table (out_state jsonb, out_version bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  u := public._session_user(p_token);
  if u.id is null then raise exception 'unauthorized'; end if;
  if u.role not in ('read', 'edit') or u.must_change then raise exception 'forbidden'; end if;
  return query select s.state, s.version from public.app_state s where s.id = 1;
end;
$$;

-- Guarda solo si sos editor y la versión que mandás es la vigente (si no, devuelve ok=false y el estado actual para fusionar).
create or replace function public.state_set(p_token text, p_state jsonb, p_expected bigint)
returns table (out_ok boolean, out_state jsonb, out_version bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u   public.app_users;
  cur public.app_state%rowtype;
begin
  u := public._session_user(p_token);
  if u.id is null then raise exception 'unauthorized'; end if;
  if u.role <> 'edit' or u.must_change then raise exception 'forbidden'; end if;

  select * into cur from public.app_state where id = 1 for update;

  if not found then
    insert into public.app_state (id, state, version) values (1, p_state, 1);
    return query select true, p_state, 1::bigint; return;
  end if;

  if cur.version <> p_expected then
    return query select false, cur.state, cur.version; return;
  end if;

  update public.app_state set state = p_state, version = cur.version + 1, updated_at = now() where id = 1;
  return query select true, p_state, cur.version + 1;
end;
$$;

-- ---------- administración (solo administradores) ----------
create or replace function public.admin_list(p_token text)
returns table (out_id uuid, out_username text, out_display text, out_role text, out_wants boolean, out_admin boolean, out_must_change boolean, out_created timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  u := public._require_admin(p_token);
  return query
    select a.id, a.username, a.display_name, a.role, a.wants_edit, a.is_admin, a.must_change, a.created_at
      from public.app_users a
     order by (a.role = 'pending') desc, (a.wants_edit and a.role <> 'edit') desc, a.created_at;
end;
$$;

-- Aprobar / cambiar permiso: 'pending' (sin acceso), 'read', 'edit' o 'blocked'
create or replace function public.admin_set_role(p_token text, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users;
  t public.app_users;
begin
  u := public._require_admin(p_token);
  if p_role not in ('pending', 'read', 'edit', 'blocked') then raise exception 'rol invalido'; end if;
  if p_user_id = u.id then raise exception 'no podés cambiar tu propio permiso'; end if;

  select * into t from public.app_users where id = p_user_id;
  if not found then raise exception 'usuario inexistente'; end if;

  update public.app_users
     set role = p_role,
         wants_edit = false,
         is_admin = case when p_role = 'edit' then is_admin else false end  -- un administrador siempre es editor
   where id = p_user_id;
  if p_role in ('blocked', 'pending') then
    delete from public.app_sessions where user_id = p_user_id;
  end if;
end;
$$;

-- Dar o quitar el rol de administrador (quien lo recibe pasa a ser editor)
create or replace function public.admin_set_admin(p_token text, p_user_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users;
  t public.app_users;
begin
  u := public._require_admin(p_token);
  if p_user_id = u.id then raise exception 'no podés cambiar tu propio rol de administrador'; end if;

  select * into t from public.app_users where id = p_user_id;
  if not found then raise exception 'usuario inexistente'; end if;
  if coalesce(p_value, false) and t.role = 'blocked' then raise exception 'primero desbloqueá al usuario'; end if;

  if coalesce(p_value, false) then
    update public.app_users set is_admin = true, role = 'edit', wants_edit = false where id = p_user_id;
  else
    update public.app_users set is_admin = false where id = p_user_id;
  end if;
end;
$$;

-- Restablecer la contraseña de otra persona: genera una clave temporal (se muestra una sola vez al administrador)
create or replace function public.admin_reset_password(p_token text, p_user_id uuid)
returns table (out_temp text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u    public.app_users;
  temp text := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
begin
  u := public._require_admin(p_token);
  if p_user_id = u.id then raise exception 'para tu propia contraseña usá "Cambiar contraseña"'; end if;
  if not exists (select 1 from public.app_users where id = p_user_id) then raise exception 'usuario inexistente'; end if;

  update public.app_users
     set pass_hash = crypt(temp, gen_salt('bf', 10)), must_change = true, fail_count = 0, locked_until = null
   where id = p_user_id;
  delete from public.app_sessions where user_id = p_user_id;
  return query select temp;
end;
$$;

create or replace function public.admin_delete_user(p_token text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users;
begin
  u := public._require_admin(p_token);
  if p_user_id = u.id then raise exception 'no podés eliminar tu propia cuenta'; end if;
  delete from public.app_users where id = p_user_id;   -- sus sesiones se borran en cascada
  if not found then raise exception 'usuario inexistente'; end if;
end;
$$;

-- ---------- permisos de ejecución ----------
revoke all on function public._session_user(text) from public;
revoke all on function public._require_admin(text) from public;
revoke all on function public.app_register(text, text, text, boolean) from public;
revoke all on function public.app_login(text, text, boolean) from public;
revoke all on function public.app_me(text) from public;
revoke all on function public.app_logout(text) from public;
revoke all on function public.app_change_password(text, text, text) from public;
revoke all on function public.state_get(text) from public;
revoke all on function public.state_set(text, jsonb, bigint) from public;
revoke all on function public.admin_list(text) from public;
revoke all on function public.admin_set_role(text, uuid, text) from public;
revoke all on function public.admin_set_admin(text, uuid, boolean) from public;
revoke all on function public.admin_reset_password(text, uuid) from public;
revoke all on function public.admin_delete_user(text, uuid) from public;

grant execute on function public.app_register(text, text, text, boolean) to anon;
grant execute on function public.app_login(text, text, boolean) to anon;
grant execute on function public.app_me(text) to anon;
grant execute on function public.app_logout(text) to anon;
grant execute on function public.app_change_password(text, text, text) to anon;
grant execute on function public.state_get(text) to anon;
grant execute on function public.state_set(text, jsonb, bigint) to anon;
grant execute on function public.admin_list(text) to anon;
grant execute on function public.admin_set_role(text, uuid, text) to anon;
grant execute on function public.admin_set_admin(text, uuid, boolean) to anon;
grant execute on function public.admin_reset_password(text, uuid) to anon;
grant execute on function public.admin_delete_user(text, uuid) to anon;
-- (_session_user y _require_admin no se le dan a nadie: solo las usan las otras funciones)
