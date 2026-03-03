import React, { useState, useEffect } from 'react';
import { RotateCcw, Minus, Plus, Trophy } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiRequest } from '@/lib/api';

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

interface GameScorerProps {
  lobby: any;
  players: any[];
  onGameEnd: () => void;
}

export default function GameScorer({ lobby, players, onGameEnd }: GameScorerProps) {
  // App State
  const [gameState, setGameState] = useState<GameState>('playing'); // Start directly in playing mode
  const [settings, setSettings] = useState<MatchSettings>({
    matchPoint: 11,
    winByTwo: true,
    team1Name: 'Team A',
    team1Player1: '',
    team1Player2: '',
    team2Name: 'Team B',
    team2Player1: '',
    team2Player2: '',
  });

  // Initialize settings from lobby players
  useEffect(() => {
    const teamA = players.filter(p => p.team === 'A');
    const teamB = players.filter(p => p.team === 'B');

    setSettings(prev => ({
      ...prev,
      team1Player1: teamA[0]?.display_name || 'Player 1',
      team1Player2: teamA[1]?.display_name || 'Player 2',
      team2Player1: teamB[0]?.display_name || 'Player 1',
      team2Player2: teamB[1]?.display_name || 'Player 2',
    }));
  }, [players]);

  // Game State
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [servingTeam, setServingTeam] = useState<TeamId>('team1');
  const [serverNumber, setServerNumber] = useState<ServerState>(2); // Standard start: 0-0-2

  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      startGame();
    }
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

  const handleFinishMatch = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const winner = isGameOver(team1Score, team2Score);
      if (!winner) return;

      const winnerTeamLetter = winner === 'team1' ? 'A' : 'B';
      const scoreString = `${team1Score}-${team2Score}`;

      await apiRequest('/matches/complete', 'POST', {
        lobby_id: lobby.id,
        winner_team: winnerTeamLetter,
        score: scoreString
      });
      
      onGameEnd();
    } catch (error) {
      console.error('Failed to complete match:', error);
      alert('Failed to submit match result. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const winner = isGameOver(team1Score, team2Score);

  // Render Game Screen
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans">
      {/* Header */}
      <header className="bg-white p-4 flex items-center justify-between border-b border-gray-200 z-10">
        <button onClick={resetGame} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <RotateCcw className="w-5 h-5" />
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

      {/* Main Scoreboard Area */}
      <main className="flex-1 flex flex-col">
        
        {/* Team 1 Section */}
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
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Minus className="w-6 h-6" />
            </button>
            
            <div className="text-8xl font-black tracking-tighter tabular-nums font-mono text-gray-900">
              {team1Score}
            </div>

            <button 
              onClick={() => manualAdjustScore('team1', 1)}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </section>

        {/* Action Bar */}
        <div className="h-24 bg-gray-900 flex items-stretch z-20 shadow-2xl">
          {winner ? (
             <div className="flex-1 flex flex-col items-center justify-center text-white bg-emerald-600 p-4">
               <span className="font-bold text-2xl mb-2">{winner === 'team1' ? settings.team1Name : settings.team2Name} Wins!</span>
               <button 
                 onClick={handleFinishMatch} 
                 disabled={isSubmitting}
                 className="bg-white text-emerald-600 px-6 py-2 rounded-full font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-gray-100 transition-all disabled:opacity-50"
               >
                 {isSubmitting ? 'Submitting...' : 'Finish Match'}
               </button>
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

        {/* Team 2 Section */}
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
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Minus className="w-6 h-6" />
            </button>
            
            <div className="text-8xl font-black tracking-tighter tabular-nums font-mono text-gray-900">
              {team2Score}
            </div>

            <button 
              onClick={() => manualAdjustScore('team2', 1)}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:scale-90 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </section>

      </main>

      {/* Manual Server Toggle (Hidden/Advanced) */}
      <div className="bg-gray-50 p-2 text-center text-xs text-gray-400 flex justify-center gap-4">
        <button onClick={toggleServingTeam} className="hover:text-gray-600 underline">Switch Sides</button>
        <span>•</span>
        <button onClick={toggleServer} className="hover:text-gray-600 underline">Toggle Server 1/2</button>
      </div>
    </div>
  );
}
