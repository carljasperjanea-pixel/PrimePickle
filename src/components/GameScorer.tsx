import React, { useState, useEffect } from 'react';
import { RotateCcw, Trophy, ArrowLeftRight, ChevronLeft, ChevronRight, Clock, Undo2, Home, Share2, MoreHorizontal, FileText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
type GameStep = 'position' | 'server' | 'playing' | 'finished';
type TeamId = 'team1' | 'team2';
type PlayerPosition = 'left' | 'right';

interface Player {
  id: string;
  display_name: string;
  avatar_url?: string;
  team: string; // 'A' or 'B'
}

interface GameScorerProps {
  lobby: any;
  players: any[];
  onGameEnd: () => void;
}

export default function GameScorer({ lobby, players, onGameEnd }: GameScorerProps) {
  // --- State ---
  const [step, setStep] = useState<GameStep>('position');
  const [matchPoint, setMatchPoint] = useState(11);
  const [gameTime, setGameTime] = useState(0); // Seconds
  
  // Players mapped by internal ID
  const [team1Players, setTeam1Players] = useState<Player[]>([]);
  const [team2Players, setTeam2Players] = useState<Player[]>([]);

  // Positioning: [LeftPlayer, RightPlayer]
  const [team1Positions, setTeam1Positions] = useState<[Player | null, Player | null]>([null, null]);
  const [team2Positions, setTeam2Positions] = useState<[Player | null, Player | null]>([null, null]);

  // Game State
  const [firstServerId, setFirstServerId] = useState<string | null>(null);
  const [servingTeam, setServingTeam] = useState<TeamId>('team1');
  const [serverNumber, setServerNumber] = useState<1 | 2>(2); // Start at 2 (0-0-2 rule)
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  
  // History for Undo
  const [history, setHistory] = useState<any[]>([]);

  // --- Initialization ---
  useEffect(() => {
    const t1 = players.filter(p => p.team === 'A');
    const t2 = players.filter(p => p.team === 'B');
    setTeam1Players(t1);
    setTeam2Players(t2);
    
    // Default positions
    setTeam1Positions([t1[0] || null, t1[1] || null]);
    setTeam2Positions([t2[0] || null, t2[1] || null]);
  }, [players]);

  // --- Timer ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'playing') {
      interval = setInterval(() => setGameTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

  // --- Helpers ---
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string) => name?.substring(0, 2).toUpperCase() || '??';

  // --- Actions ---

  const swapPositions = (team: TeamId) => {
    if (team === 'team1') {
      setTeam1Positions(prev => [prev[1], prev[0]]);
    } else {
      setTeam2Positions(prev => [prev[1], prev[0]]);
    }
  };

  const handleStartMatch = () => {
    if (!firstServerId) return;
    
    // Determine initial serving team
    const isTeam1 = team1Players.some(p => p.id === firstServerId);
    setServingTeam(isTeam1 ? 'team1' : 'team2');
    setServerNumber(2); // Standard start is 0-0-2
    setStep('playing');
  };

  const handleRallyWin = (winningTeam: TeamId) => {
    // Save state for undo
    setHistory(prev => [...prev, {
      team1Score, team2Score, servingTeam, serverNumber, team1Positions, team2Positions
    }]);

    if (winningTeam === servingTeam) {
      // Point Scored
      if (servingTeam === 'team1') {
        setTeam1Score(s => s + 1);
        // Switch positions for serving team
        setTeam1Positions(prev => [prev[1], prev[0]]);
      } else {
        setTeam2Score(s => s + 1);
        // Switch positions for serving team
        setTeam2Positions(prev => [prev[1], prev[0]]);
      }
    } else {
      // Side Out or Next Server
      if (serverNumber === 1) {
        setServerNumber(2);
      } else {
        // Side Out
        setServingTeam(prev => prev === 'team1' ? 'team2' : 'team1');
        setServerNumber(1);
      }
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setTeam1Score(last.team1Score);
    setTeam2Score(last.team2Score);
    setServingTeam(last.servingTeam);
    setServerNumber(last.serverNumber);
    setTeam1Positions(last.team1Positions);
    setTeam2Positions(last.team2Positions);
    setHistory(prev => prev.slice(0, -1));
  };

  // Check Win Condition
  useEffect(() => {
    if (step !== 'playing') return;
    
    const checkWin = (s1: number, s2: number) => {
      if ((s1 >= matchPoint && s1 - s2 >= 2) || (s2 >= matchPoint && s2 - s1 >= 2)) {
        setStep('finished');
        submitMatchResult(s1, s2);
      }
    };
    checkWin(team1Score, team2Score);
  }, [team1Score, team2Score, matchPoint, step]);

  const submitMatchResult = async (s1: number, s2: number) => {
    try {
      const winner = s1 > s2 ? 'A' : 'B';
      await apiRequest('/matches/complete', 'POST', {
        lobby_id: lobby.id,
        winner_team: winner,
        score: `${s1}-${s2}`
      });
    } catch (e) {
      console.error("Failed to submit match", e);
    }
  };

  // --- Renders ---

  // 1. Position Setup
  if (step === 'position') {
    return (
      <div className="min-h-screen bg-white flex flex-col font-sans">
        <header className="p-4 flex items-center relative">
          <ChevronLeft className="w-6 h-6 text-gray-400" onClick={() => onGameEnd()} />
          <h1 className="flex-1 text-center font-bold text-lg">Start Match</h1>
        </header>

        <main className="flex-1 flex flex-col p-6 items-center">
          <h2 className="text-xl font-bold mb-2">Set the player position</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">You can change by click the swap button</p>

          {/* Court Visual */}
          <div className="w-full aspect-[4/5] bg-blue-500 rounded-3xl relative overflow-hidden shadow-xl mb-8">
            {/* Net/Center Line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/30 -translate-x-1/2"></div>
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-green-400 -translate-y-1/2 z-10"></div>

            {/* Team 1 (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 p-4">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full shadow-lg bg-white hover:bg-gray-100"
                    onClick={() => swapPositions('team1')}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                  </Button>
               </div>
               
               {/* Left Player */}
               <div className="absolute bottom-8 left-8 flex flex-col items-center">
                  <Avatar className="w-12 h-12 border-2 border-white mb-2">
                    <AvatarImage src={team1Positions[0]?.avatar_url} />
                    <AvatarFallback>{getInitials(team1Positions[0]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-xs font-medium">{team1Positions[0]?.display_name}</span>
                  <span className="text-blue-200 text-[10px]">#2</span>
               </div>

               {/* Right Player */}
               <div className="absolute bottom-8 right-8 flex flex-col items-center">
                  <Avatar className="w-12 h-12 border-2 border-white mb-2">
                    <AvatarImage src={team1Positions[1]?.avatar_url} />
                    <AvatarFallback>{getInitials(team1Positions[1]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-xs font-medium">{team1Positions[1]?.display_name}</span>
                  <span className="text-blue-200 text-[10px]">#1</span>
               </div>
            </div>

            {/* Team 2 (Top) */}
            <div className="absolute top-0 left-0 right-0 h-1/2 p-4">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full shadow-lg bg-white hover:bg-gray-100"
                    onClick={() => swapPositions('team2')}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                  </Button>
               </div>

               {/* Left Player (Actually Right from their perspective if facing net, but visually left on screen) */}
               <div className="absolute top-8 left-8 flex flex-col items-center">
                  <Avatar className="w-12 h-12 border-2 border-white mb-2">
                    <AvatarImage src={team2Positions[0]?.avatar_url} />
                    <AvatarFallback>{getInitials(team2Positions[0]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-xs font-medium">{team2Positions[0]?.display_name}</span>
                  <span className="text-blue-200 text-[10px]">#2</span>
               </div>

               {/* Right Player */}
               <div className="absolute top-8 right-8 flex flex-col items-center">
                  <Avatar className="w-12 h-12 border-2 border-white mb-2">
                    <AvatarImage src={team2Positions[1]?.avatar_url} />
                    <AvatarFallback>{getInitials(team2Positions[1]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-xs font-medium">{team2Positions[1]?.display_name}</span>
                  <span className="text-blue-200 text-[10px]">#1</span>
               </div>
            </div>
          </div>

          {/* Points Selector */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setMatchPoint(Math.max(1, matchPoint - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Points to win</div>
              <div className="text-xl font-bold">{matchPoint} pts</div>
            </div>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setMatchPoint(matchPoint + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button className="w-full rounded-full h-12 text-lg bg-blue-600 hover:bg-blue-700" onClick={() => setStep('server')}>
            Next
          </Button>
        </main>
      </div>
    );
  }

  // 2. Server Selection
  if (step === 'server') {
    return (
      <div className="min-h-screen bg-white flex flex-col font-sans">
        <header className="p-4 flex items-center relative">
          <ChevronLeft className="w-6 h-6 text-gray-400" onClick={() => setStep('position')} />
          <h1 className="flex-1 text-center font-bold text-lg">Start Match</h1>
        </header>

        <main className="flex-1 flex flex-col p-6 items-center">
          <h2 className="text-xl font-bold mb-2">Select the first player</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">Click the one of the #1 server</p>

          {/* Court Visual for Selection */}
          <div className="w-full aspect-[4/5] bg-blue-500 rounded-3xl relative overflow-hidden shadow-xl mb-8">
            <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/30 -translate-x-1/2"></div>
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-green-400 -translate-y-1/2 z-10"></div>

            {/* Render all 4 players as clickable targets */}
            {[...team1Positions, ...team2Positions].filter(Boolean).map((player) => (
              <div 
                key={player!.id}
                className={cn(
                  "absolute p-2 rounded-xl transition-all cursor-pointer flex flex-col items-center",
                  // Position Logic
                  player === team1Positions[0] ? "bottom-4 left-4" :
                  player === team1Positions[1] ? "bottom-4 right-4" :
                  player === team2Positions[0] ? "top-4 left-4" : "top-4 right-4",
                  // Selection State
                  firstServerId === player!.id ? "bg-white/20 ring-2 ring-white scale-110 z-20" : "hover:bg-white/10"
                )}
                onClick={() => setFirstServerId(player!.id)}
              >
                <Avatar className="w-14 h-14 border-2 border-white mb-2">
                  <AvatarImage src={player!.avatar_url} />
                  <AvatarFallback>{getInitials(player!.display_name)}</AvatarFallback>
                </Avatar>
                <span className="text-white text-xs font-medium">{player!.display_name}</span>
                {firstServerId === player!.id && (
                  <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                    SERVER
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-xs mb-8">
            <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center">i</div>
            System will automatically arrange gameplay
          </div>

          <Button 
            className="w-full rounded-full h-12 text-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50" 
            onClick={handleStartMatch}
            disabled={!firstServerId}
          >
            Start Match
          </Button>
        </main>
      </div>
    );
  }

  // 3. Playing
  if (step === 'playing') {
    return (
      <div className="min-h-screen bg-white flex flex-col font-sans">
        <header className="p-4 flex items-center justify-between">
          <ChevronLeft className="w-6 h-6 text-gray-400" onClick={() => setStep('position')} />
          <h1 className="font-bold text-lg">Playing</h1>
          <FileText className="w-6 h-6 text-gray-400" />
        </header>

        <main className="flex-1 flex flex-col items-center">
          {/* Timer */}
          <div className="bg-gray-100 rounded-full px-4 py-1 flex items-center gap-2 text-gray-500 text-sm font-medium mb-6">
            <Clock className="w-4 h-4" />
            {formatTime(gameTime)}
          </div>

          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Points to win: {matchPoint} pts</div>
          
          {/* Big Score */}
          <div className="text-6xl font-black text-gray-900 mb-4 tracking-tight">
            {servingTeam === 'team1' ? team1Score : team2Score} - {servingTeam === 'team1' ? team2Score : team1Score} - {serverNumber}
          </div>

          <button 
            onClick={handleUndo}
            disabled={history.length === 0}
            className="flex items-center gap-2 text-blue-600 font-medium text-sm mb-8 disabled:opacity-50"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>

          <h3 className="font-bold text-lg mb-2">Who that scored?</h3>
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-6">
            <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center">i</div>
            Tap the player area to choose team that scored
          </div>

          {/* Interactive Court */}
          <div className="w-full max-w-sm aspect-[4/5] bg-blue-500 rounded-t-3xl relative overflow-hidden shadow-2xl mx-auto mt-auto">
            <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/30 -translate-x-1/2"></div>
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-green-400 -translate-y-1/2 z-10"></div>

            {/* Team 2 Area (Top) - Clickable */}
            <div 
              className="absolute top-0 left-0 right-0 h-1/2 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              onClick={() => handleRallyWin('team2')}
            >
               {/* Players */}
               <div className="absolute top-8 left-8 flex flex-col items-center">
                  <Avatar className="w-10 h-10 border-2 border-white mb-1">
                    <AvatarImage src={team2Positions[0]?.avatar_url} />
                    <AvatarFallback>{getInitials(team2Positions[0]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-[10px] font-medium">{team2Positions[0]?.display_name}</span>
               </div>
               <div className="absolute top-8 right-8 flex flex-col items-center">
                  <Avatar className="w-10 h-10 border-2 border-white mb-1">
                    <AvatarImage src={team2Positions[1]?.avatar_url} />
                    <AvatarFallback>{getInitials(team2Positions[1]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-[10px] font-medium">{team2Positions[1]?.display_name}</span>
               </div>
               
               {/* Score Indicator */}
               {servingTeam === 'team2' && (
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                   Serving
                 </div>
               )}
            </div>

            {/* Team 1 Area (Bottom) - Clickable */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-1/2 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              onClick={() => handleRallyWin('team1')}
            >
               {/* Players */}
               <div className="absolute bottom-8 left-8 flex flex-col items-center">
                  <Avatar className="w-10 h-10 border-2 border-white mb-1">
                    <AvatarImage src={team1Positions[0]?.avatar_url} />
                    <AvatarFallback>{getInitials(team1Positions[0]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-[10px] font-medium">{team1Positions[0]?.display_name}</span>
               </div>
               <div className="absolute bottom-8 right-8 flex flex-col items-center">
                  <Avatar className="w-10 h-10 border-2 border-white mb-1">
                    <AvatarImage src={team1Positions[1]?.avatar_url} />
                    <AvatarFallback>{getInitials(team1Positions[1]?.display_name || '')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-[10px] font-medium">{team1Positions[1]?.display_name}</span>
               </div>

               {/* Score Indicator */}
               {servingTeam === 'team1' && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                   Serving
                 </div>
               )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 4. Match End
  if (step === 'finished') {
    const winner = team1Score > team2Score ? 'team1' : 'team2';
    const winningPlayers = winner === 'team1' ? team1Players : team2Players;

    return (
      <div className="min-h-screen bg-blue-600 flex flex-col font-sans text-white relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500 to-blue-700"></div>
        
        <header className="p-4 flex items-center justify-between relative z-10">
          <ChevronLeft className="w-6 h-6" onClick={() => onGameEnd()} />
          <h1 className="font-bold text-lg">Match end</h1>
          <div className="flex gap-4">
            <MoreHorizontal className="w-6 h-6" />
            <Share2 className="w-6 h-6" />
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center relative z-10 p-6">
          <div className="relative mb-8">
            <Trophy className="w-32 h-32 text-yellow-400 drop-shadow-lg" />
            <div className="absolute -top-2 -right-4 text-yellow-200 text-4xl">✨</div>
            <div className="absolute -bottom-2 -left-4 text-yellow-200 text-4xl">✨</div>
          </div>

          <h2 className="text-3xl font-bold mb-8">Your Team Win!</h2>

          <div className="flex items-center gap-8 mb-12">
            {winningPlayers.map(p => (
              <div key={p.id} className="flex flex-col items-center">
                <Avatar className="w-16 h-16 border-4 border-white mb-3 shadow-lg">
                  <AvatarImage src={p.avatar_url} />
                  <AvatarFallback className="text-black">{getInitials(p.display_name)}</AvatarFallback>
                </Avatar>
                <span className="font-bold text-sm">{p.display_name}</span>
                <span className="text-blue-200 text-xs">{winner === 'team1' ? team1Score : team2Score} points</span>
              </div>
            ))}
          </div>

          <div className="w-full space-y-4 mt-auto">
            <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 rounded-full h-12 font-bold" onClick={onGameEnd}>
              Result
            </Button>
            <Button variant="outline" className="w-full border-white text-white hover:bg-white/10 rounded-full h-12 font-bold" onClick={onGameEnd}>
              Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
