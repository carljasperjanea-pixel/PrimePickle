import { supabase } from './supabase.js';

export async function generateTournamentMatches(tournamentId: string, format: string, participants: any[]) {
  if (participants.length < 2) {
    throw new Error('Need at least 2 participants to start a tournament');
  }

  // Shuffle participants for random seeding
  const players = [...participants].sort(() => Math.random() - 0.5);

  if (format === 'single_elimination' || format === 'single_elimination_2v2') {
    await generateSingleElimination(tournamentId, players);
  } else if (format === 'round_robin' || format === 'round_robin_2v2') {
    await generateRoundRobin(tournamentId, players);
  } else if (format === 'double_elimination' || format === 'double_elimination_2v2') {
    await generateDoubleElimination(tournamentId, players);
  } else {
    throw new Error('Unsupported tournament format');
  }
}

async function generateSingleElimination(tournamentId: string, players: any[]) {
  const numPlayers = players.length;
  const numLeaves = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  const numByes = numLeaves - numPlayers;

  // Create all matches first so we can link them
  const matches = [];
  let matchIdCounter = 1;
  let totalRounds = Math.log2(numLeaves);

  // Array of arrays to store match objects by round
  const rounds: any[][] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = numLeaves / Math.pow(2, r);
    const roundMatches = [];
    for (let m = 1; m <= matchesInRound; m++) {
      roundMatches.push({
        temp_id: `r${r}_m${m}`,
        tournament_id: tournamentId,
        round_name: r === totalRounds ? 'Final' : r === totalRounds - 1 ? 'Semifinals' : `Round ${r}`,
        round_number: r,
        match_order: m,
        player1_id: null,
        player2_id: null,
        winner_id: null,
        is_bye: false,
        next_match_id: null, // Will be updated later
        next_match_player_slot: null
      });
    }
    rounds.push(roundMatches);
  }

  // Link matches to their next match
  for (let r = 0; r < totalRounds - 1; r++) {
    for (let m = 0; m < rounds[r].length; m++) {
      const nextMatchIndex = Math.floor(m / 2);
      const nextMatchSlot = (m % 2) + 1;
      rounds[r][m].next_temp_id = rounds[r+1][nextMatchIndex].temp_id;
      rounds[r][m].next_match_player_slot = nextMatchSlot;
    }
  }

  // Assign players to Round 1
  // To distribute byes evenly, we can just put them at the end or interleave
  // For simplicity, we just fill slots.
  let playerIndex = 0;
  for (let m = 0; m < rounds[0].length; m++) {
    if (playerIndex < numPlayers) {
      rounds[0][m].player1_id = players[playerIndex].profile_id;
      playerIndex++;
    }
    if (playerIndex < numPlayers && (rounds[0].length - m > numByes / 2)) { // Try to spread byes
      rounds[0][m].player2_id = players[playerIndex].profile_id;
      playerIndex++;
    } else {
      rounds[0][m].is_bye = true;
      rounds[0][m].winner_id = rounds[0][m].player1_id; // Auto advance
    }
  }

  // Insert matches into DB and get real IDs
  // We have to insert them round by round from last to first to link next_match_id, 
  // OR insert all, then update. Inserting all then updating is easier.
  
  const allMatches = rounds.flat();
  const { data: insertedMatches, error } = await supabase
    .from('tournament_matches')
    .insert(allMatches.map(m => ({
      tournament_id: m.tournament_id,
      round_name: m.round_name,
      round_number: m.round_number,
      match_order: m.match_order,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      winner_id: m.winner_id,
      is_bye: m.is_bye
    })))
    .select();

  if (error) throw error;

  // Create a map of temp_id to real UUID
  const idMap = new Map();
  insertedMatches.forEach((im: any, index: number) => {
    idMap.set(allMatches[index].temp_id, im.id);
  });

  // Update next_match_id
  for (const m of allMatches) {
    if (m.next_temp_id) {
      const realId = idMap.set(m.temp_id, idMap.get(m.temp_id)); // just to be safe
      await supabase
        .from('tournament_matches')
        .update({
          next_match_id: idMap.get(m.next_temp_id),
          next_match_player_slot: m.next_match_player_slot
        })
        .eq('id', idMap.get(m.temp_id));
    }
  }

  // Advance byes to round 2
  for (const m of allMatches) {
    if (m.is_bye && m.next_temp_id) {
      const nextMatchRealId = idMap.get(m.next_temp_id);
      const slotField = m.next_match_player_slot === 1 ? 'player1_id' : 'player2_id';
      await supabase
        .from('tournament_matches')
        .update({ [slotField]: m.winner_id })
        .eq('id', nextMatchRealId);
    }
  }
}

async function generateRoundRobin(tournamentId: string, players: any[]) {
  const numPlayers = players.length;
  const hasBye = numPlayers % 2 !== 0;
  const totalRounds = hasBye ? numPlayers : numPlayers - 1;
  const matchesPerRound = Math.floor((numPlayers + (hasBye ? 1 : 0)) / 2);
  
  const currentPlayers = [...players];
  if (hasBye) {
    currentPlayers.push({ profile_id: null }); // Dummy player for Bye
  }

  const allMatches = [];

  for (let r = 0; r < totalRounds; r++) {
    for (let m = 0; m < matchesPerRound; m++) {
      const p1 = currentPlayers[m];
      const p2 = currentPlayers[currentPlayers.length - 1 - m];

      if (p1.profile_id !== null && p2.profile_id !== null) {
        allMatches.push({
          tournament_id: tournamentId,
          round_name: `Round ${r + 1}`,
          round_number: r + 1,
          match_order: m + 1,
          player1_id: p1.profile_id,
          player2_id: p2.profile_id
        });
      }
    }
    // Rotate players (keep first element fixed)
    currentPlayers.splice(1, 0, currentPlayers.pop()!);
  }

  if (allMatches.length > 0) {
    const { error } = await supabase
      .from('tournament_matches')
      .insert(allMatches);

    if (error) throw error;
  }
}

async function generateDoubleElimination(tournamentId: string, players: any[]) {
  // For simplicity, we'll generate a single elimination bracket for the winners bracket,
  // and a simplified losers bracket.
  // Full double elimination bracket generation is complex. 
  // We will create the structure and let the admin manually advance players if needed,
  // or use a simplified auto-advance.
  
  const numPlayers = players.length;
  const numLeaves = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  const numByes = numLeaves - numPlayers;
  let totalRounds = Math.log2(numLeaves);

  // Generate Winners Bracket (same as single elim)
  const wbRounds: any[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = numLeaves / Math.pow(2, r);
    const roundMatches = [];
    for (let m = 1; m <= matchesInRound; m++) {
      roundMatches.push({
        temp_id: `wb_r${r}_m${m}`,
        tournament_id: tournamentId,
        round_name: r === totalRounds ? 'WB Final' : `WB Round ${r}`,
        round_number: r,
        match_order: m,
        player1_id: null,
        player2_id: null,
        winner_id: null,
        is_bye: false,
        next_match_id: null,
        next_match_player_slot: null,
        loser_match_id: null,
        loser_match_slot: null
      });
    }
    wbRounds.push(roundMatches);
  }

  // Link WB matches
  for (let r = 0; r < totalRounds - 1; r++) {
    for (let m = 0; m < wbRounds[r].length; m++) {
      const nextMatchIndex = Math.floor(m / 2);
      const nextMatchSlot = (m % 2) + 1;
      wbRounds[r][m].next_temp_id = wbRounds[r+1][nextMatchIndex].temp_id;
      wbRounds[r][m].next_match_player_slot = nextMatchSlot;
    }
  }

  // Generate Losers Bracket (simplified)
  // LB has more rounds. 
  // LB Round 1: Losers of WB Round 1
  // LB Round 2: Winners of LB Round 1 vs Losers of WB Round 2
  // ...
  const lbRounds: any[][] = [];
  let lbRoundCounter = 1;
  
  // We'll just create a flat list of LB matches and Grand Final for simplicity in this implementation.
  // A full double elim requires careful mapping of losers.
  // For now, we'll just create the WB and a generic LB that admins can manually manage if it gets too complex,
  // but let's try to link the first round of losers at least.
  
  const lbRound1Matches = numLeaves / 4; // Half of WB R1 matches
  const lbR1 = [];
  for (let m = 1; m <= lbRound1Matches; m++) {
    lbR1.push({
      temp_id: `lb_r1_m${m}`,
      tournament_id: tournamentId,
      round_name: `LB Round 1`,
      round_number: 100 + 1, // Offset LB round numbers
      match_order: m,
      player1_id: null,
      player2_id: null
    });
  }
  lbRounds.push(lbR1);

  // Link WB R1 losers to LB R1
  for (let m = 0; m < wbRounds[0].length; m++) {
    const lbMatchIndex = Math.floor(m / 2);
    const lbSlot = (m % 2) + 1;
    if (lbR1[lbMatchIndex]) {
      wbRounds[0][m].loser_temp_id = lbR1[lbMatchIndex].temp_id;
      wbRounds[0][m].loser_match_slot = lbSlot;
    }
  }

  // Assign players to WB Round 1
  let playerIndex = 0;
  for (let m = 0; m < wbRounds[0].length; m++) {
    if (playerIndex < numPlayers) {
      wbRounds[0][m].player1_id = players[playerIndex].profile_id;
      playerIndex++;
    }
    if (playerIndex < numPlayers && (wbRounds[0].length - m > numByes / 2)) {
      wbRounds[0][m].player2_id = players[playerIndex].profile_id;
      playerIndex++;
    } else {
      wbRounds[0][m].is_bye = true;
      wbRounds[0][m].winner_id = wbRounds[0][m].player1_id;
    }
  }

  const allMatches = [...wbRounds.flat(), ...lbRounds.flat()];
  
  const { data: insertedMatches, error } = await supabase
    .from('tournament_matches')
    .insert(allMatches.map(m => ({
      tournament_id: m.tournament_id,
      round_name: m.round_name,
      round_number: m.round_number,
      match_order: m.match_order,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      winner_id: m.winner_id,
      is_bye: m.is_bye
    })))
    .select();

  if (error) throw error;

  const idMap = new Map();
  insertedMatches.forEach((im: any, index: number) => {
    idMap.set(allMatches[index].temp_id, im.id);
  });

  // Update next_match_id and loser_match_id
  for (const m of allMatches) {
    const updates: any = {};
    if (m.next_temp_id) {
      updates.next_match_id = idMap.get(m.next_temp_id);
      updates.next_match_player_slot = m.next_match_player_slot;
    }
    if (m.loser_temp_id) {
      updates.loser_match_id = idMap.get(m.loser_temp_id);
      updates.loser_match_slot = m.loser_match_slot;
    }
    
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('tournament_matches')
        .update(updates)
        .eq('id', idMap.get(m.temp_id));
    }
  }

  // Advance byes
  for (const m of allMatches) {
    if (m.is_bye && m.next_temp_id) {
      const nextMatchRealId = idMap.get(m.next_temp_id);
      const slotField = m.next_match_player_slot === 1 ? 'player1_id' : 'player2_id';
      await supabase
        .from('tournament_matches')
        .update({ [slotField]: m.winner_id })
        .eq('id', nextMatchRealId);
    }
  }
}
