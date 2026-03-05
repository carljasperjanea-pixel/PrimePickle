export type TeamId = 'team1' | 'team2';
export type ServerState = 1 | 2;

export interface MatchSettings {
  matchPoint: number;
  winByTwo: boolean;
  team1Name: string;
  team1Player1: string;
  team1Player2: string;
  team2Name: string;
  team2Player1: string;
  team2Player2: string;
}

export interface ScoreHistory {
  team1Score: number;
  team2Score: number;
  servingTeam: TeamId;
  serverNumber: ServerState;
}

export interface GameState {
  status: 'setup' | 'playing' | 'finished';
  settings: MatchSettings;
  team1Score: number;
  team2Score: number;
  servingTeam: TeamId;
  serverNumber: ServerState;
  history: ScoreHistory[];
  winner: TeamId | null;
}

export const INITIAL_GAME_STATE: GameState = {
  status: 'setup',
  settings: {
    matchPoint: 11,
    winByTwo: false,
    team1Name: 'Team A',
    team1Player1: '',
    team1Player2: '',
    team2Name: 'Team B',
    team2Player1: '',
    team2Player2: '',
  },
  team1Score: 0,
  team2Score: 0,
  servingTeam: 'team1',
  serverNumber: 2,
  history: [],
  winner: null,
};

export function isGameOver(state: GameState): TeamId | null {
  const { team1Score, team2Score, settings } = state;
  const target = settings.matchPoint;
  
  if (settings.winByTwo) {
    if (team1Score >= target && team1Score - team2Score >= 2) return 'team1';
    if (team2Score >= target && team2Score - team1Score >= 2) return 'team2';
  } else {
    if (team1Score >= target) return 'team1';
    if (team2Score >= target) return 'team2';
  }
  return null;
}

export function handleRallyWin(state: GameState, winningTeam: TeamId): GameState {
  if (state.status !== 'playing' || isGameOver(state)) return state;

  const newState = { ...state, history: [...state.history, {
    team1Score: state.team1Score,
    team2Score: state.team2Score,
    servingTeam: state.servingTeam,
    serverNumber: state.serverNumber,
  }] };

  const { servingTeam, serverNumber, team1Score, team2Score, settings } = newState;

  if (winningTeam === servingTeam) {
    // Serving team won the rally -> Point!
    if (servingTeam === 'team1') {
      const newScore = team1Score + 1;
      if (!settings.winByTwo && newScore > settings.matchPoint) return state; // No change if invalid
      newState.team1Score = newScore;
    } else {
      const newScore = team2Score + 1;
      if (!settings.winByTwo && newScore > settings.matchPoint) return state; // No change if invalid
      newState.team2Score = newScore;
    }
  } else {
    // Receiving team won the rally -> Side Out or Next Server
    if (serverNumber === 1) {
      newState.serverNumber = 2;
    } else {
      newState.servingTeam = servingTeam === 'team1' ? 'team2' : 'team1';
      newState.serverNumber = 1;
    }
  }

  const winner = isGameOver(newState);
  if (winner) {
    newState.winner = winner;
    // newState.status = 'finished'; // Optional
  }

  return newState;
}

export function handleManualAdjust(state: GameState, team: TeamId, delta: number): GameState {
  if (state.status !== 'playing') return state;
  if (isGameOver(state) && delta > 0) return state;

  const newState = { ...state, history: [...state.history, {
    team1Score: state.team1Score,
    team2Score: state.team2Score,
    servingTeam: state.servingTeam,
    serverNumber: state.serverNumber,
  }] };

  if (team === 'team1') {
    const newScore = Math.max(0, newState.team1Score + delta);
    if (!newState.settings.winByTwo && newScore > newState.settings.matchPoint) return state;
    newState.team1Score = newScore;
  } else {
    const newScore = Math.max(0, newState.team2Score + delta);
    if (!newState.settings.winByTwo && newScore > newState.settings.matchPoint) return state;
    newState.team2Score = newScore;
  }

  const winner = isGameOver(newState);
  newState.winner = winner;

  return newState;
}

export function handleToggleServer(state: GameState): GameState {
  if (state.status !== 'playing') return state;

  const newState = { ...state, history: [...state.history, {
    team1Score: state.team1Score,
    team2Score: state.team2Score,
    servingTeam: state.servingTeam,
    serverNumber: state.serverNumber,
  }] };

  newState.serverNumber = newState.serverNumber === 1 ? 2 : 1;
  return newState;
}

export function handleToggleServingTeam(state: GameState): GameState {
  if (state.status !== 'playing') return state;

  const newState = { ...state, history: [...state.history, {
    team1Score: state.team1Score,
    team2Score: state.team2Score,
    servingTeam: state.servingTeam,
    serverNumber: state.serverNumber,
  }] };

  newState.servingTeam = newState.servingTeam === 'team1' ? 'team2' : 'team1';
  newState.serverNumber = 1;
  return newState;
}

export function handleUndo(state: GameState): GameState {
  if (state.history.length === 0) return state;

  const newState = { ...state };
  const lastState = newState.history.pop();
  if (lastState) {
    newState.team1Score = lastState.team1Score;
    newState.team2Score = lastState.team2Score;
    newState.servingTeam = lastState.servingTeam;
    newState.serverNumber = lastState.serverNumber;
    newState.winner = null;
  }
  return newState;
}
