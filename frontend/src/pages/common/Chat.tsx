import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../../lib/api';
import { Send, Image as ImageIcon, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll for conversations and messages (every 5 seconds)
  const { data: convData, isLoading: isLoadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatApi.conversations(),
    refetchInterval: 5000,
  });

  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => chatApi.messages(selectedConvId!),
    enabled: !!selectedConvId,
    refetchInterval: 3000,
  });

  const scrollBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollBottom();
  }, [messagesData]);

  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string }) => chatApi.sendMessage(selectedConvId!, data),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  // Automatically start conversation with Support if none selected & admin action requested
  const createConvMutation = useMutation({
    mutationFn: (data: { participantId?: string; type: string; title?: string }) => chatApi.createConversation(data),
    onSuccess: (res) => {
      setSelectedConvId(res.data.data.conversation.id.toString());
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvId) return;
    sendMessageMutation.mutate({ content: newMessage });
  };

  const conversations = convData?.data?.data?.conversations || [];
  const messages = messagesData?.data?.data?.messages || [];

  return (
    <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 12rem)' }}>
      {/* Sidebar - Conversations List */}
      <div className="w-1/3 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Messages</h2>
          {user?.roleName !== 'SUPER_ADMIN' && user?.roleName !== 'FINANCE_ADMIN' && (
            <button 
              onClick={() => createConvMutation.mutate({ type: 'SUPPORT', title: 'Support Ticket' })}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Contact Support
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoadingConvs ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No conversations</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {conversations.map((conv: any) => {
                const otherParticipant = conv.participants.find((p: any) => p.userId !== user?.id);
                const title = conv.title || (otherParticipant ? otherParticipant.fullName : 'Unknown User');
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id.toString())}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedConvId === conv.id.toString() ? 'bg-primary-50 border-l-4 border-primary-500 selection-indicator' : ''}`}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-gray-900 truncate pr-2">{title}</h3>
                      {conv.lastMessage && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-sm text-gray-500 truncate">{conv.lastMessage.content}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50/50">
        {selectedConvId ? (
          <>
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm z-10">
              <h3 className="font-semibold text-gray-900">
                {conversations.find((c: any) => c.id.toString() === selectedConvId)?.title || 'Chat'}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.sender.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.sender.isMe 
                      ? 'bg-primary-600 text-white rounded-br-sm' 
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                  }`}>
                    {!msg.sender.isMe && (
                      <div className="text-xs font-medium text-gray-500 mb-1">{msg.sender.fullName}</div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className={`text-[10px] mt-1 text-right ${msg.sender.isMe ? 'text-primary-200' : 'text-gray-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white p-4 border-t border-gray-100">
              <form onSubmit={handleSend} className="flex gap-2 items-end">
                <button type="button" className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                  <ImageIcon className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
              <Send className="w-8 h-8 text-gray-300" />
            </div>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
