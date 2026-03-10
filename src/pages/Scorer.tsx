import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RotateCcw, Minus, Plus, Trophy, Save, ArrowLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiRequest } from '@/lib/api';
import { 
  GameState, 
  INITIAL_GAME_STATE, 
  MatchSettings
} from '@/lib/game-logic';

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ScorerProps {
  lobbyId?: string;
  onMatchComplete?: () => void;
}

export default function Scorer({ lobbyId: propLobbyId, onMatchComplete }: ScorerProps) {
  const { lobbyId: paramLobbyId } = useParams();
  const lobbyId = propLobbyId || paramLobbyId;
  const navigate = useNavigate();
  
  // Game State
  const [state, setState] = useState<GameState>(INITIAL_GAME_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const isInitialized = useRef(false);

  // WebSocket Connection
  useEffect(() => {
    if (!lobbyId) return;

    // Fetch lobby details immediately on mount to populate UI
    fetchLobbyDetails();

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/game-ws`;
      console.log('Connecting to WebSocket:', wsUrl);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to WebSocket');
        setIsConnected(true);
        ws?.send(JSON.stringify({ type: 'JOIN_LOBBY', lobbyId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WS message:', data.type, data.payload);
          if (data.type === 'GAME_STATE_UPDATE') {
            setState(data.payload);
            
            // On first connection (or reconnect), if state is setup OR if we are playing but missing names, fetch details from DB
            if (!isInitialized.current) {
              isInitialized.current = true;
              const isSetup = data.payload.status === 'setup';
              const isPlayingButMissingNames = data.payload.status === 'playing' && !data.payload.settings.team1Player1;
              
              if (isSetup || isPlayingButMissingNames) {
                 console.log('Initial state is setup or missing names, fetching lobby details from DB...');
                 fetchLobbyDetails();
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onclose = (event) => {
        console.log('Disconnected from WebSocket', event.code, event.reason);
        setIsConnected(false);
        isInitialized.current = false; // Reset initialization state on disconnect
        // Try to reconnect after 3 seconds
        reconnectTimeout = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws?.close();
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null; // Prevent reconnect on unmount
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [lobbyId]);

  const sendAction = (type: string, payload?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        lobbyId,
        payload
      }));
    }
  };

  const onRallyWin = (team: 'team1' | 'team2') => {
    sendAction('RALLY_WIN', { winningTeam: team });
  };

  const onManualAdjust = (team: 'team1' | 'team2', delta: number) => {
    sendAction('MANUAL_ADJUST', { team, delta });
  };

  const onToggleServer = () => {
    sendAction('TOGGLE_SERVER');
  };

  const onToggleServingTeam = () => {
    sendAction('TOGGLE_SERVING_TEAM');
  };

  const onUndo = () => {
    sendAction('UNDO');
  };

  const startGame = async () => {
    sendAction('START_GAME');
    
    // Update DB status
    if (lobbyId) {
        try {
            await apiRequest('/lobbies/start', 'POST', { lobby_id: lobbyId });
        } catch (e) {
            console.error('Failed to start game in DB', e);
        }
    }
  };

  const resetGame = () => {
    if (confirm('Are you sure you want to reset the current game?')) {
        sendAction('RESET_GAME');
    }
  };

  const startNewMatch = () => {
    sendAction('RESET_GAME');
  };

  const updateSettings = (newSettings: Partial<MatchSettings>) => {
    sendAction('UPDATE_SETTINGS', newSettings);
  };

  const handleSaveMatch = async () => {
    if (!state.winner || !lobbyId) return;
    setIsSaving(true);
    try {
      await apiRequest('/matches/complete', 'POST', {
        lobby_id: lobbyId,
        winner_team: state.winner === 'team1' ? 'A' : 'B',
        score: `${state.team1Score}-${state.team2Score}`
      });
      alert('Match saved successfully!');
      if (onMatchComplete) {
        onMatchComplete();
      } else {
        navigate('/admin'); // Or wherever appropriate
      }
    } catch (e: any) {
      console.error(e);
      alert('Failed to save match: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchLobbyDetails = async () => {
    try {
      const data = await apiRequest(`/lobbies/${lobbyId}`);
      
      let newSettings: Partial<MatchSettings> = {};
      let shouldStart = false;

      if (data.lobby) {
        newSettings.matchPoint = data.lobby.match_goal || 11;
        // If the game is already in progress in the DB, ensure we are in 'playing' mode
        if (data.lobby.status === 'in_progress') {
            shouldStart = true;
        }
      }
      
      if (data.players && data.players.length > 0) {
        const teamA = data.players.filter((p: any) => p.team === 'A');
        const teamB = data.players.filter((p: any) => p.team === 'B');
        
        newSettings = {
          ...newSettings,
          team1Name: 'Team A',
          team1Player1: teamA[0]?.display_name || '',
          team1Player2: teamA[1]?.display_name || '',
          team2Name: 'Team B',
          team2Player1: teamB[0]?.display_name || '',
          team2Player2: teamB[1]?.display_name || '',
        };
      }
      
      // Send settings to WS
      if (Object.keys(newSettings).length > 0) {
          sendAction('UPDATE_SETTINGS', newSettings);
      }

      if (shouldStart) {
          // We only send START_GAME if we are sure we want to sync state.
          // But be careful not to reset score if server already has score.
          // handleStartGame on server checks if status is already playing.
          sendAction('START_GAME');
      }

    } catch (e) {
      console.error("Failed to fetch lobby details", e);
    }
  };

  // Render Setup Screen
  if (state.status === 'setup') {
    if (!state.settings) return <div>Loading settings...</div>;
    return (
      <div className={cn("bg-gray-50 flex items-center justify-center p-4 font-sans", onMatchComplete ? "h-full" : "min-h-[100dvh]")}>
        <div className="w-full max-w-lg md:max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gray-900 p-6 md:p-8 text-white flex items-center justify-between gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-4 border-orange-500/20 p-1">
              <div className="text-3xl md:text-4xl font-bold text-orange-500">PP</div>
            </div>
            
            <div className="text-right">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pickleball Scorer</h1>
              <p className="text-gray-400 mt-2 text-sm md:text-base">Doubles Match Setup</p>
            </div>
          </div>
          
          <div className="p-6 md:p-8 space-y-6 md:space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wider text-gray-500">Match Point</label>
              <div className="grid grid-cols-3 gap-3">
                {[11, 15, 21].map(points => (
                  <button
                    key={points}
                    onClick={() => updateSettings({ matchPoint: points })}
                    className={cn(
                      "py-3 rounded-xl font-bold text-lg transition-all border-2",
                      state.settings.matchPoint === points
                        ? "border-orange-500 bg-orange-500/10 text-orange-500"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    )}
                  >
                    {points}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="winByTwo" 
                  checked={state.settings.winByTwo} 
                  onChange={(e) => updateSettings({ winByTwo: e.target.checked })}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500 border-gray-300"
                />
                <label htmlFor="winByTwo" className="text-sm text-gray-600">Win by 2 (Uncheck for hard cap)</label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-3">
                <label className="text-sm font-semibold uppercase tracking-wider text-gray-500">Team 1 (Starts Serving)</label>
                <input
                  type="text"
                  value={state.settings.team1Name}
                  onChange={(e) => updateSettings({ team1Name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  placeholder="Team Name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={state.settings.team1Player1}
                    onChange={(e) => updateSettings({ team1Player1: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Player 1"
                  />
                  <input
                    type="text"
                    value={state.settings.team1Player2}
                    onChange={(e) => updateSettings({ team1Player2: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Player 2"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold uppercase tracking-wider text-gray-500">Team 2</label>
                <input
                  type="text"
                  value={state.settings.team2Name}
                  onChange={(e) => updateSettings({ team2Name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  placeholder="Team Name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={state.settings.team2Player1}
                    onChange={(e) => updateSettings({ team2Player1: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Player 1"
                  />
                  <input
                    type="text"
                    value={state.settings.team2Player2}
                    onChange={(e) => updateSettings({ team2Player2: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Player 2"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] text-lg"
            >
              Start Match
            </button>
            
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to cancel the match setup?')) {
                  if (lobbyId) {
                    try {
                      await apiRequest('/lobbies/cancel', 'POST', { lobby_id: lobbyId });
                      if (onMatchComplete) onMatchComplete();
                      else navigate(-1);
                    } catch (e) {
                      console.error('Failed to cancel match', e);
                      alert('Failed to cancel match');
                    }
                  } else {
                    navigate(-1);
                  }
                }
              }}
              className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm font-medium p-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state.settings) return <div>Loading game state...</div>;

  return (
    <div className={cn("bg-gray-50 flex flex-col w-full md:max-w-5xl mx-auto shadow-2xl overflow-hidden relative font-sans transition-all", onMatchComplete ? "h-full rounded-xl border" : "min-h-[100dvh]")}>
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200 z-10 shrink-0">
        <button onClick={resetGame} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="font-mono font-bold text-gray-900 flex flex-col items-center">
          <span className="text-sm md:text-base">GOAL: {state.settings.matchPoint}</span>
        </div>
        <button 
          onClick={onUndo} 
          disabled={state.history.length === 0}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 disabled:opacity-30"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Team 1 Section */}
        <section className={cn(
          "flex-1 relative transition-all duration-300 flex flex-col justify-center items-center p-4 md:p-8 border-b-2 md:border-b-0 md:border-r-2 border-gray-200",
          state.servingTeam === 'team1' ? "bg-white" : "bg-gray-50"
        )}>
          {state.servingTeam === 'team1' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs md:text-sm font-bold uppercase tracking-widest shadow-sm flex items-center gap-2 cursor-pointer z-10 hover:bg-emerald-700 transition-colors" onClick={onToggleServer}>
              <span>Serving • {state.serverNumber === 1 ? '1st' : '2nd'}</span>
            </div>
          )}
          
          <div className="w-full flex flex-col items-center mb-4 md:mb-8 z-0">
             <div className="flex items-center gap-2 md:gap-3">
                <h2 className={cn(
                  "text-2xl md:text-4xl font-bold truncate max-w-[200px] md:max-w-[300px] text-center",
                  state.servingTeam === 'team1' ? "text-emerald-600" : "text-gray-500"
                )}>
                  {state.settings.team1Name}
                </h2>
                {state.winner === 'team1' && <Trophy className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />}
             </div>
             <div className="text-sm md:text-lg text-gray-400 font-medium mt-1 md:mt-2">
               {state.settings.team1Player1} {state.settings.team1Player2 && `& ${state.settings.team1Player2}`}
             </div>
          </div>

          <div className="flex items-center gap-4 md:gap-12">
            <button 
              onClick={() => onManualAdjust('team1', -1)}
              className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all shadow-sm"
            >
              <Minus className="w-6 h-6 md:w-8 md:h-8" />
            </button>
            
            <div className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter tabular-nums font-mono text-gray-900 select-none">
              {state.team1Score}
            </div>

            <button 
              onClick={() => onManualAdjust('team1', 1)}
              className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all shadow-sm"
            >
              <Plus className="w-6 h-6 md:w-8 md:h-8" />
            </button>
          </div>
        </section>

        {/* Middle Control Bar */}
        <div className="h-20 md:h-auto md:w-24 bg-gray-900 flex flex-row md:flex-col items-stretch z-20 shadow-2xl shrink-0">
          {state.winner ? (
             <div className="flex-1 flex flex-col items-center justify-center text-white bg-emerald-600 p-2 md:p-4 gap-2 md:gap-4">
               <span className="font-bold text-lg md:text-xl text-center leading-tight md:writing-mode-vertical md:rotate-180">
                 {state.winner === 'team1' ? state.settings.team1Name : state.settings.team2Name} Wins!
               </span>
               <div className="flex flex-row md:flex-col gap-2 w-full justify-center">
                 <button onClick={startNewMatch} className="bg-white text-emerald-600 px-3 py-1.5 md:py-3 rounded-full font-bold text-xs md:text-sm uppercase tracking-wider shadow-lg hover:bg-gray-100 transition-all whitespace-nowrap">
                   New
                 </button>
                 {lobbyId && (
                   <button 
                     onClick={handleSaveMatch} 
                     disabled={isSaving}
                     className="bg-orange-500 text-white px-3 py-1.5 md:py-3 rounded-full font-bold text-xs md:text-sm uppercase tracking-wider shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap"
                   >
                     <Save className="w-3 h-3 md:w-4 md:h-4" /> {isSaving ? '...' : 'Save'}
                   </button>
                 )}
               </div>
             </div>
          ) : (
            <>
              <button 
                onClick={() => onRallyWin('team1')}
                className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-base md:text-lg transition-colors flex flex-col items-center justify-center gap-1 p-2"
              >
                <span className="md:writing-mode-vertical md:rotate-180 truncate max-w-full">{state.settings.team1Name}</span>
                <span className="text-[10px] md:text-xs font-normal opacity-70 uppercase tracking-wider md:writing-mode-vertical md:rotate-180">Point</span>
              </button>
              
              <div className="w-[1px] h-full md:w-full md:h-[1px] bg-white/10"></div>
              
              <button 
                onClick={() => onRallyWin('team2')}
                className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-base md:text-lg transition-colors flex flex-col items-center justify-center gap-1 p-2"
              >
                <span className="md:writing-mode-vertical md:rotate-180 truncate max-w-full">{state.settings.team2Name}</span>
                <span className="text-[10px] md:text-xs font-normal opacity-70 uppercase tracking-wider md:writing-mode-vertical md:rotate-180">Point</span>
              </button>
            </>
          )}
        </div>

        {/* Team 2 Section */}
        <section className={cn(
          "flex-1 relative transition-all duration-300 flex flex-col justify-center items-center p-4 md:p-8",
          state.servingTeam === 'team2' ? "bg-white" : "bg-gray-50"
        )}>
          {state.servingTeam === 'team2' && (
            <div className="absolute top-4 md:top-auto md:bottom-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs md:text-sm font-bold uppercase tracking-widest shadow-sm flex items-center gap-2 cursor-pointer z-10 hover:bg-emerald-700 transition-colors" onClick={onToggleServer}>
              <span>Serving • {state.serverNumber === 1 ? '1st' : '2nd'}</span>
            </div>
          )}

          <div className="w-full flex flex-col items-center mb-4 md:mb-8 md:order-first z-0">
             <div className="flex items-center gap-2 md:gap-3">
                <h2 className={cn(
                  "text-2xl md:text-4xl font-bold truncate max-w-[200px] md:max-w-[300px] text-center",
                  state.servingTeam === 'team2' ? "text-emerald-600" : "text-gray-500"
                )}>
                  {state.settings.team2Name}
                </h2>
                {state.winner === 'team2' && <Trophy className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />}
             </div>
             <div className="text-sm md:text-lg text-gray-400 font-medium mt-1 md:mt-2">
               {state.settings.team2Player1} {state.settings.team2Player2 && `& ${state.settings.team2Player2}`}
             </div>
          </div>

          <div className="flex items-center gap-4 md:gap-12">
            <button 
              onClick={() => onManualAdjust('team2', -1)}
              className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all shadow-sm"
            >
              <Minus className="w-6 h-6 md:w-8 md:h-8" />
            </button>
            
            <div className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter tabular-nums font-mono text-gray-900 select-none">
              {state.team2Score}
            </div>

            <button 
              onClick={() => onManualAdjust('team2', 1)}
              className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all shadow-sm"
            >
              <Plus className="w-6 h-6 md:w-8 md:h-8" />
            </button>
          </div>
        </section>
      </main>

      <div className="bg-gray-50 p-3 text-center text-xs md:text-sm text-gray-400 flex justify-center gap-6 shrink-0 border-t border-gray-200">
        <button onClick={onToggleServingTeam} className="hover:text-gray-600 underline decoration-dotted underline-offset-4">Switch Sides</button>
        <span>•</span>
        <button onClick={onToggleServer} className="hover:text-gray-600 underline decoration-dotted underline-offset-4">Toggle Server 1/2</button>
      </div>
    </div>
  );
}
