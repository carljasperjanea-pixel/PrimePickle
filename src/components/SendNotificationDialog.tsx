import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/api';
import { Send, BellRing } from 'lucide-react';

export function SendNotificationDialog({ userRole }: { userRole: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetRole, setTargetRole] = useState('player');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSend = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setSuccess('');
    try {
      const res = await apiRequest('/admin/notify', 'POST', {
        targetRole,
        message,
      });
      setSuccess(`Successfully sent to ${res.count} users.`);
      setTimeout(() => {
        setIsOpen(false);
        setMessage('');
        setSuccess('');
      }, 2000);
    } catch (error: any) {
      console.error('Failed to send notification:', error);
      alert(error.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200 shadow-sm gap-2">
          <BellRing className="w-4 h-4" /> Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Audience</label>
            <Select value={targetRole} onValueChange={setTargetRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">All Players</SelectItem>
                {userRole === 'super_admin' && (
                  <>
                    <SelectItem value="admin">All Admins</SelectItem>
                    <SelectItem value="all">Everyone (Players & Admins)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          {success && <div className="text-sm text-emerald-600 font-medium">{success}</div>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={loading || !message.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? 'Sending...' : <><Send className="w-4 h-4 mr-2" /> Send</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
