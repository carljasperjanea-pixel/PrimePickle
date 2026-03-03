-- Allow anonymous access to profiles (for signup/login with anon key)
create policy "Enable access to profiles for all"
on profiles for all
using (true)
with check (true);

-- Allow anonymous access to lobbies
create policy "Enable access to lobbies for all"
on lobbies for all
using (true)
with check (true);

-- Allow anonymous access to lobby_players
create policy "Enable access to lobby_players for all"
on lobby_players for all
using (true)
with check (true);

-- Allow anonymous access to matches
create policy "Enable access to matches for all"
on matches for all
using (true)
with check (true);
