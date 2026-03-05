import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RotateCcw, Minus, Plus, Trophy, Save, ArrowLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
type GameState = 'setup' | 'playing' | 'finished';
type ServerState = 1 | 2;
type TeamId = 'team1' | 'team2';

interface MatchSettings {
  matchPoint: number; // 11, 15, 21
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
  servingTeam: TeamId;
  serverNumber: ServerState;
}

interface ScorerProps {
  lobbyId?: string;
  onMatchComplete?: () => void;
}

export default function Scorer({ lobbyId: propLobbyId, onMatchComplete }: ScorerProps) {
  const { lobbyId: paramLobbyId } = useParams();
  const lobbyId = propLobbyId || paramLobbyId;
  const navigate = useNavigate();

  // App State
  const [gameState, setGameState] = useState<GameState>('setup');
  const [settings, setSettings] = useState<MatchSettings>({
    matchPoint: 11,
    winByTwo: false,
    team1Name: 'Team A',
    team1Player1: '',
    team1Player2: '',
    team2Name: 'Team B',
    team2Player1: '',
    team2Player2: '',
  });

  // Game State
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [servingTeam, setServingTeam] = useState<TeamId>('team1');
  const [serverNumber, setServerNumber] = useState<ServerState>(2); // Standard start: 0-0-2

  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Lobby Details on Mount
  useEffect(() => {
    if (lobbyId) {
      fetchLobbyDetails();
    }
  }, [lobbyId]);

  const fetchLobbyDetails = async () => {
    try {
      const data = await apiRequest(`/lobbies/${lobbyId}`);
      if (data.lobby) {
        setSettings(prev => ({
          ...prev,
          matchPoint: data.lobby.match_goal || 11,
        }));
      }
      if (data.players && data.players.length > 0) {
        const teamA = data.players.filter((p: any) => p.team === 'A');
        const teamB = data.players.filter((p: any) => p.team === 'B');
        
        setSettings(prev => ({
          ...prev,
          team1Name: 'Team A',
          team1Player1: teamA[0]?.display_name || '',
          team1Player2: teamA[1]?.display_name || '',
          team2Name: 'Team B',
          team2Player1: teamB[0]?.display_name || '',
          team2Player2: teamB[1]?.display_name || '',
        }));
      }
    } catch (e) {
      console.error("Failed to fetch lobby details", e);
    }
  };

  // Game Logic Helper
  const isGameOver = (s1: number, s2: number) => {
    const target = settings.matchPoint;
    if (settings.winByTwo) {
      if (s1 >= target && s1 - s2 >= 2) return 'team1';
      if (s2 >= target && s2 - s1 >= 2) return 'team2';
    } else {
      if (s1 >= target) return 'team1';
      if (s2 >= target) return 'team2';
    }
    return null;
  };

  // Setup Handlers
  const startGame = () => {
    setTeam1Score(0);
    setTeam2Score(0);
    setServingTeam('team1');
    setServerNumber(2); // Game starts at 0-0-2
    setHistory([]);
    setGameState('playing');
  };

  const resetGame = () => {
    if (confirm('Are you sure you want to reset the current game?')) {
      setGameState('setup');
    }
  };

  const startNewMatch = () => {
    setGameState('setup');
  };

  // Game Logic Handlers
  const saveHistory = () => {
    setHistory(prev => [...prev, {
      team1Score,
      team2Score,
      servingTeam,
      serverNumber
    }]);
  };

  const undoLastAction = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setTeam1Score(lastState.team1Score);
    setTeam2Score(lastState.team2Score);
    setServingTeam(lastState.servingTeam);
    setServerNumber(lastState.serverNumber);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleRallyWin = (winningTeam: TeamId) => {
    if (isGameOver(team1Score, team2Score)) return;

    saveHistory();

    if (winningTeam === servingTeam) {
      // Serving team won the rally -> Point!
      if (servingTeam === 'team1') {
        const newScore = team1Score + 1;
        // Enforce cap if winByTwo is false
        if (!settings.winByTwo && newScore > settings.matchPoint) return; 
        setTeam1Score(newScore);
      } else {
        const newScore = team2Score + 1;
        // Enforce cap if winByTwo is false
        if (!settings.winByTwo && newScore > settings.matchPoint) return;
        setTeam2Score(newScore);
      }
    } else {
      // Receiving team won the rally -> Side Out or Next Server
      if (serverNumber === 1) {
        // Move to second server
        setServerNumber(2);
      } else {
        // Side Out
        setServingTeam(prev => prev === 'team1' ? 'team2' : 'team1');
        setServerNumber(1);
      }
    }
  };

  // Manual Overrides
  const manualAdjustScore = (team: TeamId, delta: number) => {
    if (isGameOver(team1Score, team2Score) && delta > 0) return;

    saveHistory();
    if (team === 'team1') {
      const newScore = Math.max(0, team1Score + delta);
      if (!settings.winByTwo && newScore > settings.matchPoint) return;
      setTeam1Score(newScore);
    } else {
      const newScore = Math.max(0, team2Score + delta);
      if (!settings.winByTwo && newScore > settings.matchPoint) return;
      setTeam2Score(newScore);
    }
  };

  const toggleServer = () => {
    saveHistory();
    setServerNumber(prev => prev === 1 ? 2 : 1);
  };

  const toggleServingTeam = () => {
    saveHistory();
    setServingTeam(prev => prev === 'team1' ? 'team2' : 'team1');
    setServerNumber(1);
  };

  const winner = isGameOver(team1Score, team2Score);

  const handleSaveMatch = async () => {
    if (!winner || !lobbyId) return;
    setIsSaving(true);
    try {
      await apiRequest('/matches/complete', 'POST', {
        lobby_id: lobbyId,
        winner_team: winner === 'team1' ? 'A' : 'B',
        score: `${team1Score}-${team2Score}`
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

  // Render Setup Screen
  if (gameState === 'setup') {
    return (
      <div className={cn("bg-gray-50 flex items-center justify-center p-4 font-sans", onMatchComplete ? "h-full" : "min-h-screen")}>
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gray-900 p-8 text-white flex items-center justify-between gap-6">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-4 border-orange-500/20 p-1">
              <div className="text-4xl font-bold text-orange-500">PP</div>
            </div>
            
            <div className="text-right">
              <h1 className="text-3xl font-bold tracking-tight">Pickleball Scorer</h1>
              <p className="text-gray-400 mt-2">Doubles Match Setup</p>
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wider text-gray-500">Match Point</label>
              <div className="grid grid-cols-3 gap-3">
                {[11, 15, 21].map(points => (
                  <button
                    key={points}
                    onClick={() => setSettings(s => ({ ...s, matchPoint: points }))}
                    className={cn(
                      "py-3 rounded-xl font-bold text-lg transition-all border-2",
                      settings.matchPoint === points
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
                  checked={settings.winByTwo} 
                  onChange={(e) => setSettings(s => ({ ...s, winByTwo: e.target.checked }))}
                  className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 border-gray-300"
                />
                <label htmlFor="winByTwo" className="text-sm text-gray-600">Win by 2 (Uncheck for hard cap)</label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wider text-gray-500">Team 1 (Starts Serving)</label>
              <input
                type="text"
                value={settings.team1Name}
                onChange={(e) => setSettings(s => ({ ...s, team1Name: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                placeholder="Team Name"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={settings.team1Player1}
                  onChange={(e) => setSettings(s => ({ ...s, team1Player1: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Player 1"
                />
                <input
                  type="text"
                  value={settings.team1Player2}
                  onChange={(e) => setSettings(s => ({ ...s, team1Player2: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Player 2"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wider text-gray-500">Team 2</label>
              <input
                type="text"
                value={settings.team2Name}
                onChange={(e) => setSettings(s => ({ ...s, team2Name: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                placeholder="Team Name"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={settings.team2Player1}
                  onChange={(e) => setSettings(s => ({ ...s, team2Player1: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Player 1"
                />
                <input
                  type="text"
                  value={settings.team2Player2}
                  onChange={(e) => setSettings(s => ({ ...s, team2Player2: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Player 2"
                />
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
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
              className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans", onMatchComplete ? "h-full rounded-xl border" : "min-h-screen")}>
      <header className="bg-white p-4 flex items-center justify-between border-b border-gray-200 z-10">
        <button onClick={resetGame} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="font-mono font-bold text-gray-900">
          GOAL: {settings.matchPoint}
        </div>
        <button 
          onClick={undoLastAction} 
          disabled={history.length === 0}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 disabled:opacity-30"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 flex flex-col">
        <section className={cn(
          "flex-1 relative transition-all duration-300 flex flex-col justify-center items-center p-6 border-b-2 border-gray-200",
          servingTeam === 'team1' ? "bg-white" : "bg-gray-50"
        )}>
          {servingTeam === 'team1' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm flex items-center gap-2 cursor-pointer z-10" onClick={toggleServer}>
              <span>Serving • {serverNumber === 1 ? '1st' : '2nd'}</span>
            </div>
          )}
          
          <div className="w-full flex flex-col items-center mb-6 z-0">
             <div className="flex items-center gap-2">
                <h2 className={cn(
                  "text-2xl font-bold truncate max-w-[250px]",
                  servingTeam === 'team1' ? "text-emerald-600" : "text-gray-500"
                )}>
                  {settings.team1Name}
                </h2>
                {winner === 'team1' && <Trophy className="w-6 h-6 text-orange-500" />}
             </div>
             <div className="text-sm text-gray-400 font-medium mt-1">
               {settings.team1Player1} {settings.team1Player2 && `& ${settings.team1Player2}`}
             </div>
          </div>

          <div className="flex items-center gap-8">
            <button 
              onClick={() => manualAdjustScore('team1', -1)}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Minus className="w-6 h-6" />
            </button>
            
            <div className="text-8xl font-black tracking-tighter tabular-nums font-mono text-gray-900">
              {team1Score}
            </div>

            <button 
              onClick={() => manualAdjustScore('team1', 1)}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </section>

        <div className="h-24 bg-gray-900 flex items-stretch z-20 shadow-2xl">
          {winner ? (
             <div className="flex-1 flex flex-col items-center justify-center text-white bg-emerald-600 p-4">
               <span className="font-bold text-2xl mb-2">{winner === 'team1' ? settings.team1Name : settings.team2Name} Wins!</span>
               <div className="flex gap-2">
                 <button onClick={startNewMatch} className="bg-white text-emerald-600 px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-gray-100 transition-all">
                   New Match
                 </button>
                 {lobbyId && (
                   <button 
                     onClick={handleSaveMatch} 
                     disabled={isSaving}
                     className="bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-orange-600 transition-all flex items-center gap-2"
                   >
                     <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Result'}
                   </button>
                 )}
               </div>
             </div>
          ) : (
            <>
              <button 
                onClick={() => handleRallyWin('team1')}
                className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-lg transition-colors flex flex-col items-center justify-center gap-1"
              >
                <span>{settings.team1Name}</span>
                <span className="text-xs font-normal opacity-70 uppercase tracking-wider">Won Rally</span>
              </button>
              
              <div className="w-[1px] bg-white/10"></div>
              
              <button 
                onClick={() => handleRallyWin('team2')}
                className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-lg transition-colors flex flex-col items-center justify-center gap-1"
              >
                <span>{settings.team2Name}</span>
                <span className="text-xs font-normal opacity-70 uppercase tracking-wider">Won Rally</span>
              </button>
            </>
          )}
        </div>

        <section className={cn(
          "flex-1 relative transition-all duration-300 flex flex-col justify-center items-center p-6",
          servingTeam === 'team2' ? "bg-white" : "bg-gray-50"
        )}>
          {servingTeam === 'team2' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm flex items-center gap-2 cursor-pointer z-10" onClick={toggleServer}>
              <span>Serving • {serverNumber === 1 ? '1st' : '2nd'}</span>
            </div>
          )}

          <div className="w-full flex flex-col items-center mb-6 order-first">
             <div className="flex items-center gap-2">
                <h2 className={cn(
                  "text-2xl font-bold truncate max-w-[250px]",
                  servingTeam === 'team2' ? "text-emerald-600" : "text-gray-500"
                )}>
                  {settings.team2Name}
                </h2>
                {winner === 'team2' && <Trophy className="w-6 h-6 text-orange-500" />}
             </div>
             <div className="text-sm text-gray-400 font-medium mt-1">
               {settings.team2Player1} {settings.team2Player2 && `& ${settings.team2Player2}`}
             </div>
          </div>

          <div className="flex items-center gap-8">
            <button 
              onClick={() => manualAdjustScore('team2', -1)}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Minus className="w-6 h-6" />
            </button>
            
            <div className="text-8xl font-black tracking-tighter tabular-nums font-mono text-gray-900">
              {team2Score}
            </div>

            <button 
              onClick={() => manualAdjustScore('team2', 1)}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </section>
      </main>

      <div className="bg-gray-50 p-2 text-center text-xs text-gray-400 flex justify-center gap-4">
        <button onClick={toggleServingTeam} className="hover:text-gray-600 underline">Switch Sides</button>
        <span>•</span>
        <button onClick={toggleServer} className="hover:text-gray-600 underline">Toggle Server 1/2</button>
      </div>
    </div>
  );
}
