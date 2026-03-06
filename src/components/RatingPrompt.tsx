import { useState } from 'react';
import { Star, MessageCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiRequest } from '@/lib/api';

interface Player {
  id: string;
  display_name: string;
  avatar_url?: string;
}

interface RatingPromptProps {
  matchId: string;
  players: Player[]; // List of OTHER players to rate
  isOpen: boolean;
  onComplete: () => void;
}

export default function RatingPrompt({ matchId, players, isOpen, onComplete }: RatingPromptProps) {
  const [ratings, setRatings] = useState<Record<string, { sportsmanship: number; communication: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRate = (playerId: string, category: 'sportsmanship' | 'communication', value: number) => {
    setRatings(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || { sportsmanship: 0, communication: 0 }),
        [category]: value
      }
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Filter out players who haven't been rated at all (optional, or send 0?)
      // Requirement says "Capture a rating". Assuming mandatory for the ones submitted.
      // We will submit whatever is set.
      
      const payload = players.map(player => ({
        ratedId: player.id,
        sportsmanship: ratings[player.id]?.sportsmanship || 5, // Default to 5
        communication: ratings[player.id]?.communication || 5  // Default to 5
      }));

      if (payload.length > 0) {
        await apiRequest(`/matches/${matchId}/rate`, 'POST', { ratings: payload });
      }
      
      onComplete();
    } catch (error) {
      console.error('Failed to submit ratings:', error);
      // Even if fail, we might want to close or show error.
      // For now, alert and close.
      alert('Failed to submit ratings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // If user tries to close without clicking submit (e.g. click outside),
    // we treat it as submitting defaults (5/5) to prevent the modal from reappearing endlessly.
    handleSubmit();
  };

  if (!players || players.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Match Complete!</DialogTitle>
          <DialogDescription>
            Please rate your fellow players. Your feedback helps improve the community.
            Ratings are anonymous.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {players.map(player => (
            <div key={player.id} className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={player.avatar_url} />
                  <AvatarFallback>{player.display_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{player.display_name}</span>
              </div>

              {/* Sportsmanship */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Shield className="w-3 h-3" /> Sportsmanship
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => handleRate(player.id, 'sportsmanship', star)}
                      className={`p-1 transition-all ${
                        (ratings[player.id]?.sportsmanship || 0) >= star 
                          ? 'text-yellow-500 scale-110' 
                          : 'text-gray-300 hover:text-yellow-200'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Communication */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MessageCircle className="w-3 h-3" /> Communication
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => handleRate(player.id, 'communication', star)}
                      className={`p-1 transition-all ${
                        (ratings[player.id]?.communication || 0) >= star 
                          ? 'text-blue-500 scale-110' 
                          : 'text-gray-300 hover:text-blue-200'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting...' : 'Submit Ratings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
