import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { supabase } from './supabase.js';
import { 
  GameState, 
  INITIAL_GAME_STATE, 
  MatchSettings, 
  handleRallyWin as logicHandleRallyWin,
  handleManualAdjust as logicHandleManualAdjust,
  handleToggleServer as logicHandleToggleServer,
  handleToggleServingTeam as logicHandleToggleServingTeam,
  handleUndo as logicHandleUndo
} from '../lib/game-logic.js';

interface Lobby {
  id: string;
  clients: Set<WebSocket>;
  gameState: GameState;
}

const lobbies = new Map<string, Lobby>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    console.log(`[WS] Upgrade request for ${request.url}`);
    
    if (request.url === '/game-ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    let currentLobbyId: string | null = null;
    console.log(`[WS] New connection from ${req.socket.remoteAddress}`);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        // Use data.lobbyId if available, otherwise fallback to currentLobbyId
        const targetLobbyId = data.lobbyId || currentLobbyId;
        
        console.log(`Received WS message: ${data.type} for lobby ${targetLobbyId}`);

        switch (data.type) {
          case 'JOIN_LOBBY':
            handleJoinLobby(ws, data.lobbyId);
            currentLobbyId = data.lobbyId;
            break;
          case 'UPDATE_SETTINGS':
            if (targetLobbyId) handleUpdateSettings(targetLobbyId, data.payload);
            break;
          case 'START_GAME':
            if (targetLobbyId) handleStartGame(targetLobbyId);
            else console.warn('START_GAME received but no lobbyId');
            break;
          case 'RALLY_WIN':
            if (targetLobbyId) handleRallyWin(targetLobbyId, data.payload.winningTeam);
            break;
          case 'MANUAL_ADJUST':
            if (targetLobbyId) handleManualAdjust(targetLobbyId, data.payload.team, data.payload.delta);
            break;
          case 'TOGGLE_SERVER':
            if (targetLobbyId) handleToggleServer(targetLobbyId);
            break;
          case 'TOGGLE_SERVING_TEAM':
            if (targetLobbyId) handleToggleServingTeam(targetLobbyId);
            break;
          case 'UNDO':
            if (targetLobbyId) handleUndo(targetLobbyId);
            break;
          case 'RESET_GAME':
            if (targetLobbyId) handleResetGame(targetLobbyId);
            break;
          case 'REQUEST_STATE':
            if (targetLobbyId) sendStateToClient(ws, targetLobbyId);
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

  async function handleStartGame(lobbyId: string) {
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
    
    // Update DB status so polling clients (PlayerDashboard) can transition
    try {
      const { error } = await supabase
        .from('lobbies')
        .update({ 
          status: 'in_progress', 
          started_at: new Date().toISOString() 
        })
        .eq('id', lobbyId);
        
      if (error) {
        console.error('Failed to update lobby status in DB:', error);
      } else {
        console.log('Lobby status updated to in_progress in DB');
      }
    } catch (err) {
      console.error('Error updating lobby status in DB:', err);
    }

    broadcastState(lobby);
  }

  function handleRallyWin(lobbyId: string, winningTeam: 'team1' | 'team2') {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.gameState = logicHandleRallyWin(lobby.gameState, winningTeam);
    broadcastState(lobby);
  }

  function handleManualAdjust(lobbyId: string, team: 'team1' | 'team2', delta: number) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.gameState = logicHandleManualAdjust(lobby.gameState, team, delta);
    broadcastState(lobby);
  }

  function handleToggleServer(lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.gameState = logicHandleToggleServer(lobby.gameState);
    broadcastState(lobby);
  }

  function handleToggleServingTeam(lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.gameState = logicHandleToggleServingTeam(lobby.gameState);
    broadcastState(lobby);
  }

  function handleUndo(lobbyId: string) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.gameState = logicHandleUndo(lobby.gameState);
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
    if (lobby && ws.readyState === WebSocket.OPEN) {
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
