import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { RotateCcw, Minus, Plus, Trophy } from 'lucide-react';

export default function Scorer() {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  
  // Game State
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [server, setServer] = useState<1 | 2>(2); // Start as "Server 2" (Start Serving) usually implies 2nd server logic or just 1st server? 
  // Pickleball rule: First server of the game is usually treated as "Server 2" (0-0-2) or "Start"
  // The reference image shows "SERVING • 2ND" and "Team 1".
  
  const [servingTeam, setServingTeam] = useState<1 | 2>(1);
  const [matchGoal, setMatchGoal] = useState(11);
  const [history, setHistory] = useState<any[]>([]);

  // Fetch match settings
  useEffect(() => {
    // In a real app, we'd fetch the lobby settings here.
    // For now, we'll assume defaults or passed state.
    // We can fetch the lobby details to get names and match goal.
    fetchLobbyDetails();
  }, []);

  const fetchLobbyDetails = async () => {
    try {
      // Reuse the lobbies endpoint or a specific one
      const data = await apiRequest('/lobbies');
      const lobby = data.lobbies?.find((l: any) => l.id === lobbyId);
      if (lobby) {
        setMatchGoal(lobby.match_goal || 11);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveState = () => {
    setHistory(prev => [...prev, { team1Score, team2Score, server, servingTeam }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setTeam1Score(last.team1Score);
    setTeam2Score(last.team2Score);
    setServer(last.server);
    setServingTeam(last.servingTeam);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleScore = (team: 1 | 2) => {
    saveState();
    if (team === servingTeam) {
      // Point scored
      if (team === 1) setTeam1Score(s => s + 1);
      else setTeam2Score(s => s + 1);
    } else {
      // Sideout logic
      if (server === 1) {
        setServer(2);
      } else {
        setServer(1);
        setServingTeam(t => t === 1 ? 2 : 1);
      }
    }
  };

  const handleFault = () => {
    saveState();
    if (server === 1) {
      setServer(2);
    } else {
      setServer(1);
      setServingTeam(t => t === 1 ? 2 : 1);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-black text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-100 rounded flex items-center justify-center text-black font-bold text-xs">
            PP
          </div>
          <div>
            <h1 className="font-bold text-lg">Pickleball Scorer</h1>
            <p className="text-xs text-gray-400">Doubles Match Setup</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={undo} disabled={history.length === 0}>
          <RotateCcw className="w-5 h-5 text-gray-400" />
        </Button>
      </div>

      {/* Score Display */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-center">
          <div className="font-mono text-xl font-bold mb-2">GOAL: {matchGoal}</div>
          
          <div className="inline-block bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-bold mb-4">
            SERVING • {server === 1 ? '1ST' : '2ND'}
          </div>
          
          <h2 className={`text-3xl font-bold mb-6 ${servingTeam === 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
            Team 1
          </h2>

          <div className="flex items-center justify-center gap-8">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-gray-100 border-none" onClick={() => setTeam1Score(s => Math.max(0, s - 1))}>
              <Minus className="w-6 h-6 text-gray-400" />
            </Button>
            <div className="text-8xl font-bold font-mono tracking-tighter">
              {team1Score}
            </div>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-gray-100 border-none" onClick={() => setTeam1Score(s => s + 1)}>
              <Plus className="w-6 h-6 text-gray-400" />
            </Button>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-0">
          <button 
            className={`p-8 text-white font-bold text-xl transition-colors ${servingTeam === 1 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-300'}`}
            onClick={() => handleScore(1)}
            disabled={servingTeam !== 1}
          >
            Team 1<br/><span className="text-sm opacity-80">WON RALLY</span>
          </button>
          <button 
            className={`p-8 text-white font-bold text-xl transition-colors ${servingTeam === 2 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-300'}`}
            onClick={() => handleScore(2)}
            disabled={servingTeam !== 2}
          >
            Team 2<br/><span className="text-sm opacity-80">WON RALLY</span>
          </button>
        </div>

        <div className="text-center">
          <h2 className={`text-3xl font-bold mb-6 ${servingTeam === 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
            Team 2
          </h2>

          <div className="flex items-center justify-center gap-8">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-gray-100 border-none" onClick={() => setTeam2Score(s => Math.max(0, s - 1))}>
              <Minus className="w-6 h-6 text-gray-400" />
            </Button>
            <div className="text-8xl font-bold font-mono tracking-tighter">
              {team2Score}
            </div>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-gray-100 border-none" onClick={() => setTeam2Score(s => s + 1)}>
              <Plus className="w-6 h-6 text-gray-400" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 flex justify-center gap-4 text-sm text-gray-400 underline">
        <button onClick={() => setServingTeam(t => t === 1 ? 2 : 1)}>Switch Sides</button>
        <button onClick={() => setServer(s => s === 1 ? 2 : 1)}>Toggle Server 1/2</button>
      </div>
    </div>
  );
}
