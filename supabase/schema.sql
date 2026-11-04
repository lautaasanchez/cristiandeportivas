-- Cristian Deportivas · base de datos compartida (Supabase, plan gratuito)
-- Pegá TODO este archivo en Supabase > SQL Editor > New query y tocá "Run". Se puede ejecutar más de una vez.

-- Una fila por "sala". La sala se identifica con el hash del código de acceso (el código nunca se guarda en claro).
create table if not exists public.rooms (
  code        text primary key,
  state       jsonb  not null,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now()
);

-- Seguridad: la tabla queda cerrada. Nadie la lee ni la escribe directamente; solo se entra por las dos funciones de abajo
-- y únicamente conociendo el código de la sala.
alter table public.rooms enable row level security;

create or replace function public.room_get(p_code text)
returns table (out_state jsonb, out_version bigint)
language sql
security definer
set search_path = public
as $$
  select r.state, r.version from public.rooms r where r.code = p_code;
$$;

-- Guarda solo si la versión que mandás es la actual (si no, devuelve ok=false y el estado vigente para que la app fusione).
create or replace function public.room_set(p_code text, p_state jsonb, p_expected bigint)
returns table (out_ok boolean, out_state jsonb, out_version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.rooms%rowtype;
begin
  if length(p_code) < 16 then
    raise exception 'codigo invalido';
  end if;

  select * into cur from public.rooms where code = p_code for update;

  if not found then
    insert into public.rooms (code, state, version) values (p_code, p_state, 1);
    return query select true, p_state, 1::bigint;
    return;
  end if;

  if cur.version <> p_expected then
    return query select false, cur.state, cur.version;
    return;
  end if;

  update public.rooms
     set state = p_state, version = cur.version + 1, updated_at = now()
   where code = p_code;
  return query select true, p_state, cur.version + 1;
end;
$$;

revoke all on function public.room_get(text) from public;
revoke all on function public.room_set(text, jsonb, bigint) from public;
grant execute on function public.room_get(text) to anon;
grant execute on function public.room_set(text, jsonb, bigint) to anon;
