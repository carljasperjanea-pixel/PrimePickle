import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest, useUser } from '@/lib/api';
import { ArrowLeft, Send, Search, User, MessageSquare } from 'lucide-react';

export default function Messages() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useUser().then(u => {
      if (!u) navigate('/login');
      else {
        setUser(u);
        fetchConversations();
      }
    });
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      fetchMessages(selectedPartner.id);
      // Set up polling for new messages
      const interval = setInterval(() => {
        fetchMessages(selectedPartner.id, true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedPartner]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const data = await apiRequest('/messages/conversations');
      setConversations(data.conversations);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (partnerId: string, silent = false) => {
    try {
      const data = await apiRequest(`/messages/${partnerId}`);
      setMessages(data.messages);
      if (!silent) {
        // Refresh conversations to update unread counts
        fetchConversations();
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(data.users);
    } catch (err) {
      console.error('Failed to search users:', err);
    }
  };

  const handleSelectPartner = (partner: any) => {
    setSelectedPartner(partner);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedPartner) return;

    const content = newMessage;
    setNewMessage(''); // Optimistic clear

    try {
      await apiRequest('/messages', 'POST', {
        receiverId: selectedPartner.id,
        content
      });
      fetchMessages(selectedPartner.id);
      fetchConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(content); // Restore on failure
    }
  };

  const goBack = () => {
    if (user?.role === 'admin') navigate('/admin');
    else if (user?.role === 'superadmin') navigate('/superadmin');
    else navigate('/dashboard');
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white p-4 shadow-md shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-white hover:bg-white/20 p-2 h-auto rounded-full"
            onClick={goBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Messages
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 flex gap-4 h-[calc(100vh-72px)]">
        
        {/* Sidebar: Conversations & Search */}
        <div className={`w-full md:w-1/3 flex flex-col gap-4 ${selectedPartner ? 'hidden md:flex' : 'flex'}`}>
          <Card className="border-none shadow-md bg-white flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Search users..." 
                  className="pl-9 bg-gray-50"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {searchQuery ? (
                <div className="p-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Search Results</h3>
                  {searchResults.length === 0 ? (
                    <div className="text-sm text-gray-500 p-2 text-center">No users found</div>
                  ) : (
                    searchResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectPartner(u)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            u.display_name?.charAt(0) || <User className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{u.display_name}</div>
                          <div className="text-xs text-gray-500 capitalize">{u.role}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="p-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Recent Conversations</h3>
                  {conversations.length === 0 ? (
                    <div className="text-sm text-gray-500 p-4 text-center border border-dashed rounded-lg m-2">
                      No conversations yet. Search for a user to start chatting.
                    </div>
                  ) : (
                    conversations.map(conv => (
                      <button
                        key={conv.partner.id}
                        onClick={() => handleSelectPartner(conv.partner)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${selectedPartner?.id === conv.partner.id ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                            {conv.partner.avatar_url ? (
                              <img src={conv.partner.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              conv.partner.display_name?.charAt(0) || <User className="w-5 h-5" />
                            )}
                          </div>
                          {conv.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                              {conv.unreadCount}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <div className="font-medium text-gray-900 truncate">{conv.partner.display_name}</div>
                            <div className="text-[10px] text-gray-400 shrink-0 ml-2">
                              {new Date(conv.lastMessage.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                            {conv.lastMessage.sender_id === user.id ? 'You: ' : ''}{conv.lastMessage.content}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className={`w-full md:w-2/3 flex flex-col ${!selectedPartner ? 'hidden md:flex' : 'flex'}`}>
          {selectedPartner ? (
            <Card className="border-none shadow-md bg-white flex-1 flex flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center gap-3 bg-white">
                <Button 
                  variant="ghost" 
                  className="md:hidden p-2 h-auto -ml-2"
                  onClick={() => setSelectedPartner(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden shrink-0">
                  {selectedPartner.avatar_url ? (
                    <img src={selectedPartner.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    selectedPartner.display_name?.charAt(0) || <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{selectedPartner.display_name}</div>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                    No messages yet. Say hi!
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.sender_id === user.id;
                    const showDate = index === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();
                    
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded-full">
                              {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                          <div 
                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              isMe 
                                ? 'bg-emerald-600 text-white rounded-tr-sm' 
                                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 bg-white border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-gray-50 border-gray-200 focus-visible:ring-emerald-500"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </Card>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <MessageSquare className="w-16 h-16 mb-4 text-gray-200" />
              <p className="text-lg font-medium text-gray-500">Your Messages</p>
              <p className="text-sm">Select a conversation or search for a user to start chatting.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
