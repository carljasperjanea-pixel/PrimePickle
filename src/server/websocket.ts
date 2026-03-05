import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface MatchSettings {
  matchPoint: number;
  winByTwo: boolean;
  team1Name: string;
  team1Player1: string;
  team1Player2: string;
  team2Name: string;
  team2Player1: string;
  team2Player2: string;
}

interface ScoreHistory {
  team1Score: number;
  team2Score: number;
  servingTeam: 'team1' | 'team2';
  serverNumber: 1 | 2;
}

interface GameState {
  status: 'setup' | 'playing' | 'finished';
  settings: MatchSettings;
  team1Score: number;
  team2Score: number;
  servingTeam: 'team1' | 'team2';
  serverNumber: 1 | 2;
  history: ScoreHistory[];
  winner: 'team1' | 'team2' | null;
}

interface Lobby {
  id: string;
  clients: Set<WebSocket>;
  gameState: GameState;
}

const lobbies = new Map<string, Lobby>();

const DEFAULT_SETTINGS: MatchSettings = {
  matchPoint: 11,
  winByTwo: false,
  team1Name: 'Team A',
  team1Player1: '',
  team1Player2: '',
  team2Name: 'Team B',
  team2Player1: '',
  team2Player2: '',
};

const INITIAL_GAME_STATE: GameState = {
  status: 'setup',
  settings: DEFAULT_SETTINGS,
  team1Score: 0,
  team2Score: 0,
  servingTeam: 'team1',
  serverNumber: 2,
  history: [],
  winner: null,
};

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentLobbyId: string | null = null;

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log(`Received WS message: ${data.type} for lobby ${data.lobbyId || currentLobbyId}`);

        switch (data.type) {
          case 'JOIN_LOBBY':
            handleJoinLobby(ws, data.lobbyId);
            currentLobbyId = data.lobbyId;
            break;
          case 'UPDATE_SETTINGS':
            if (currentLobbyId) handleUpdateSettings(currentLobbyId, data.payload);
            break;
          case 'START_GAME':
            if (currentLobbyId) handleStartGame(currentLobbyId);
            else console.warn('START_GAME received but no currentLobbyId');
            break;
          case 'RALLY_WIN':
            if (currentLobbyId) handleRallyWin(currentLobbyId, data.payload.winningTeam);
            break;
          case 'MANUAL_ADJUST':
            if (currentLobbyId) handleManualAdjust(currentLobbyId, data.payload.team, data.payload.delta);
            break;
          case 'TOGGLE_SERVER':
            if (currentLobbyId) handleToggleServer(currentLobbyId);
            break;
          case 'TOGGLE_SERVING_TEAM':
            if (currentLobbyId) handleToggleServingTeam(currentLobbyId);
            break;
          case 'UNDO':
            if (currentLobbyId) handleUndo(currentLobbyId);
            break;
          case 'RESET_GAME':
            if (currentLobbyId) handleResetGame(currentLobbyId);
            break;
          case 'REQUEST_STATE':
            if (currentLobbyId) sendStateToClient(ws, currentLobbyId);
            break;
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    });

    ws.on('close', () => {
      if (currentLobbyId) {
        const lobby = lobbies.get(currentLobbyId);
        if (lobby) {
          lobby.clients.delete(ws);
          if (lobby.clients.size === 0) {
            // Optional: Clean up empty lobbies after a timeout
            // lobbies.delete(currentLobbyId);
          }
        }
      }
    });
  });

  function handleJoinLobby(ws: WebSocket, lobbyId: string) {
    console.log(`Client joining lobby ${lobbyId}`);
    let lobby = lobbies.get(lobbyId);
    if (!lobby) {
      console.log(`Creating new lobby ${lobbyId}`);
      lobby = {
        id: lobbyId,
        clients: new Set(),
        gameState: JSON.parse(JSON.stringify(INITIAL_GAME_STATE)), // Deep copy
      };
      lobbies.set(lobbyId, lobby);
    }
    lobby.clients.add(ws);
    sendStateToClient(ws, lobbyId);
  }

  function handleUpdateSettings(lobbyId: string, settings: Partial<MatchSettings>) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.gameState.settings = { ...lobby.gameState.settings, ...settings };
    broadcastState(lobby);
  }

  function handleStartGame(lobbyId: string) {
    console.log(`Starting game for lobby ${lobbyId}`);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
        console.error(`Lobby ${lobbyId} not found during START_GAME`);
        return;
    }

    // Only start if not already playing to prevent resets
    if (lobby.gameState.status === 'playing') {
        console.log(`Lobby ${lobbyId} already playing, broadcasting state`);
        broadcastState(lobby);
        return;
    }

    lobby.gameState.status = 'playing';
    lobby.gameState.team1Score = 0;
    lobby.gameState.team2Score = 0;
    lobby.gameState.servingTeam = 'team1';
    lobby.gameState.serverNumber = 2;
    lobby.gameState.history = [];
    lobby.gameState.winner = null;
    console.log(`Game started for lobby ${lobbyId}, broadcasting state`);
    broadcastState(lobby);
  }

  function saveHistory(lobby: Lobby) {
    lobby.gameState.history.push({
      team1Score: lobby.gameState.team1Score,
      team2Score: lobby.gameState.team2Score,
      servingTeam: lobby.gameState.servingTeam,
      serverNumber: lobby.gameState.serverNumber,
    });
  }

  function isGameOver(lobby: Lobby) {
    const { team1Score, team2Score, settings } = lobby.gameState;
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

  function handleRallyWin(lobbyId: string, winningTeam: 'team1' | 'team2') {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.gameState.status !== 'playing') return;

    if (isGameOver(lobby)) return;

    saveHistory(lobby);

    const { servingTeam, serverNumber, team1Score, team2Score, settings } = lobby.gameState;

    if (winningTeam === servingTeam) {
      // Serving team won the rally -> Point!
      if (servingTeam === 'team1') {
        const newScore = team1Score + 1;
        if (!settings.winByTwo && newScore > settings.matchPoint) return;
        lobby.gameState.team1Score = newScore;
      } else {
        const newScore = team2Score + 1;
        if (!settings.winByTwo && newScore > settings.matchPoint) return;
        lobby.gameState.team2Score = newScore;
      }
    } else {
      // Receiving team won the rally -> Side Out or Next Server
      if (serverNumber === 1) {
        lobby.gameState.serverNumber = 2;
      } else {
        lobby.gameState.servingTeam = servingTeam === 'team1' ? 'team2' : 'team1';
        lobby.gameState.serverNumber = 1;
      }
    }

    const winner = isGameOver(lobby);
    if (winner) {
      lobby.gameState.winner = winner;
      // lobby.gameState.status = 'finished'; // Keep playing state to allow undo? Or finish?
      // Usually we show the winner screen but allow undo.
    }

    broadcastState(lobby);
  }

  function handleManualAdjust(lobbyId: string, team: 'team1' | 'team2', delta: number) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.gameState.status !== 'playing') return;

    if (isGameOver(lobby) && delta > 0) return;

    saveHistory(lobby);

    if (team === 'team1') {
      const newScore = Math.max(0, lobby.gameState.team1Score + delta);
      if (!lobby.gameState.settings.winByTwo && newScore > lobby.gameState.settings.matchPoint) return;
      lobby.gameState.team1Score = newScore;
    } else {
      const newScore = Math.max(0, lobby.gameState.team2Score + delta);
      if (!lobby.gameState.settings.winByTwo && newScore > lobby.gameState.settings.matchPoint) return;
      lobby.gameState.team2Score = newScore;
    }

    const winner = isGameOver(lobby);
    if (winner) {
      lobby.gameState.winner = winner;
    } else {
      lobby.gameState.winner = null;
    }

    broadcastState(lobby);
  }

  function handleToggleServer(lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.gameState.status !== 'playing') return;

    saveHistory(lobby);
    lobby.gameState.serverNumber = lobby.gameState.serverNumber === 1 ? 2 : 1;
    broadcastState(lobby);
  }

  function handleToggleServingTeam(lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.gameState.status !== 'playing') return;

    saveHistory(lobby);
    lobby.gameState.servingTeam = lobby.gameState.servingTeam === 'team1' ? 'team2' : 'team1';
    lobby.gameState.serverNumber = 1;
    broadcastState(lobby);
  }

  function handleUndo(lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.gameState.history.length === 0) return;

    const lastState = lobby.gameState.history.pop();
    if (lastState) {
      lobby.gameState.team1Score = lastState.team1Score;
      lobby.gameState.team2Score = lastState.team2Score;
      lobby.gameState.servingTeam = lastState.servingTeam;
      lobby.gameState.serverNumber = lastState.serverNumber;
      lobby.gameState.winner = null; // Reset winner on undo
    }
    broadcastState(lobby);
  }

  function handleResetGame(lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.gameState.status = 'setup';
    broadcastState(lobby);
  }

  function sendStateToClient(ws: WebSocket, lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      ws.send(JSON.stringify({
        type: 'GAME_STATE_UPDATE',
        payload: lobby.gameState
      }));
    }
  }

  function broadcastState(lobby: Lobby) {
    const message = JSON.stringify({
      type: 'GAME_STATE_UPDATE',
      payload: lobby.gameState
    });

    for (const client of lobby.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
