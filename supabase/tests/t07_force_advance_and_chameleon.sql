-- Timeout recovery plus a Chameleon end-to-end smoke test.
do $$
declare
  g record; host uuid; mafia uuid[]; faithful uuid[]; voter uuid;
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia');
  faithful := test.living(g.game_id, 'faithful');
  perform test.act(host); perform test.begin_night(g.game_id);

  -- One of two living Mafia is not a strict majority, so timeout recovery
  -- advances without a kill when the other night actors are missing too.
  perform test.kill(g.game_id, mafia[1], faithful[1]);
  perform test.act(g.uids[2]);
  perform test.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'day_result', 'participant recovers night');
  perform test.ok((select last_night_victim from games where id = g.game_id) is null,
    'minority Mafia ballot cannot kill');

  perform test.begin_day_vote(g.game_id);
  -- Four of seven is majority participation and a unique plurality.
  foreach voter in array g.uids[1:4] loop
    perform test.vote(g.game_id, voter, mafia[1]);
  end loop;
  perform test.act(g.uids[5]);
  perform test.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'lynch_result', 'participant recovers day vote');
  perform test.ok((select last_lynch_victim from games where id = g.game_id) = mafia[1],
    'majority-participation unique plurality lynches');

  perform test.begin_night(g.game_id);
  perform test.ok(test.round(g.game_id) = 2, 'recovery starts round two');
  perform test.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'day_result', 'empty night recovers');
  perform test.ok((select last_night_victim from games where id = g.game_id) is null,
    'empty night kills nobody');
  raise notice 't07a timeout recovery OK';
end $$;

do $$
declare
  g record; host uuid; u uuid; r uuid; outsider uuid; secret uuid; wrong_word uuid;
begin
  select * into g from test.new_game('chameleon', 4, 1, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_game(g.game_id);
  perform test.ok(test.status(g.game_id) = 'role_reveal', 'chameleon reveals roles');
  perform test.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'hint_phase', 'recovery enters hints');
  select id into r from rounds where game_id = g.game_id and round_number = 1;

  foreach u in array g.uids loop
    perform test.act(u);
    perform public.submit_chameleon_hint(g.game_id);
  end loop;
  perform test.ok(test.status(g.game_id) = 'voting', 'hints complete');

  select user_id into outsider from game_players
  where game_id = g.game_id and is_outsider;
  foreach u in array g.uids loop
    perform test.act(u);
    perform public.cast_chameleon_vote(g.game_id, outsider);
  end loop;
  perform test.ok(test.status(g.game_id) = 'chameleon_guess', 'caught Chameleon guesses');

  select word_id into secret from game_secrets where game_id = g.game_id;
  select candidate_id into wrong_word
  from game_secrets s, unnest(s.guess_candidate_ids) candidate_id
  where s.game_id = g.game_id and candidate_id <> secret limit 1;
  perform test.act(outsider);
  perform public.submit_chameleon_guess(g.game_id, wrong_word);
  perform test.ok(test.status(g.game_id) = 'game_over', 'wrong guess ends game');
  perform test.ok((select winner from games where id = g.game_id) = 'players',
    'players win a wrong Chameleon guess');
  raise notice 't07b Chameleon flow OK';
end $$;
