-- A room can disappear between a realtime DELETE notification and the
-- participant's catch-up fetch. Return a successful, typed tombstone for that
-- expected terminal state so browsers do not report a failed network request.

alter function public.get_game_snapshot(text) set schema private;

revoke all on function private.get_game_snapshot(text)
  from public, anon, authenticated;

create function public.get_game_snapshot(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.get_game_snapshot(p_room_code);
exception
  when sqlstate 'P0002' then
    if p_room_code is null or btrim(p_room_code) = '' then
      raise;
    end if;
    return jsonb_build_object('error_code', 'ROOM_NOT_FOUND');
end;
$$;

revoke execute on function public.get_game_snapshot(text) from public, anon;
grant execute on function public.get_game_snapshot(text) to authenticated;
