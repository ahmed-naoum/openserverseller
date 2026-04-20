import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, adminApi, BACKEND_URL } from '../../lib/api';
import {
  Send, Search, Plus, MessageSquare, CheckCheck,
  ChevronLeft, Headphones, MoreVertical, Smile, Paperclip, Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupMessagesByDate(messages: any[]) {
  const groups: { label: string; messages: any[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const label = formatDate(msg.createdAt);
    if (label !== lastDate) {
      groups.push({ label, messages: [] });
      lastDate = label;
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function getConvTitle(conv: any, myId?: number) {
  if (conv.title) return conv.title;
  const other = conv.participants?.find((p: any) => p.userId !== myId);
  return other?.fullName || 'Unknown';
}

function getConvAvatar(conv: any, myId?: number) {
  if (conv.type === 'SUPPORT') return null; // show icon
  const other = conv.participants?.find((p: any) => p.userId !== myId);
  return other?.fullName;
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];
  const colorIdx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`${sizeClasses[size]} ${colors[colorIdx]} rounded-2xl flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Chat() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    searchParams.get('convId')
  );
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState<{[key: string]: { name: string; isTyping: boolean }}>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showMobileList, setShowMobileList] = useState(!searchParams.get('convId'));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversations
  const { data: convData, isLoading: isLoadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => {
      const isAdmin = ['SUPER_ADMIN', 'SYSTEM_SUPPORT', 'FINANCE_ADMIN'].includes(user?.role || '');
      if (isAdmin) {
        return adminApi.getConversations();
      }
      return chatApi.conversations();
    },
    refetchInterval: false, // Turn off polling since we have sockets
  });

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => chatApi.messages(selectedConvId!, { limit: 100 }),
    enabled: !!selectedConvId,
    refetchInterval: false, // Turn off polling
  });

  const conversations: any[] = convData?.data?.data?.conversations || [];
  const messages: any[] = messagesData?.data?.data?.messages || [];
  const orderNum = searchParams.get('orderNum');
  const urlConvId = searchParams.get('convId');

  // Unified selection & deep linking logic
  useEffect(() => {
    if (conversations.length === 0) return;

    // Priority 1: ID from URL parameter
    if (urlConvId) {
      if (selectedConvId !== urlConvId) {
        setSelectedConvId(urlConvId);
        setShowMobileList(false);
      }
      return;
    }

    // Priority 2: Order Number from URL parameter
    if (orderNum) {
      const match = conversations.find((c: any) => c.metadata?.orderNumber === orderNum);
      if (match) {
        const matchId = String(match.id);
        if (selectedConvId !== matchId) {
          // Update URL to the matched conversation ID and clear orderNum
          setSearchParams({ convId: matchId });
          setSelectedConvId(matchId);
          setShowMobileList(false);
        }
        return;
      }
    }

    // Priority 3: Fallback - Select first message if nothing is selected
    if (!selectedConvId && conversations.length > 0) {
      setSelectedConvId(conversations[0].id.toString());
    }
  }, [urlConvId, orderNum, conversations, selectedConvId, setSearchParams]);

  // Real-time socket message handler
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { message: any; conversationId: number }) => {
      // 1. Update messages list if viewing the conversation
      if (selectedConvId === String(data.conversationId)) {
        queryClient.setQueryData(['messages', selectedConvId], (oldData: any) => {
          if (!oldData?.data?.data?.messages) return oldData;
          // Avoid duplicates
          const msgExists = oldData.data.data.messages.some((m: any) => m.id === data.message.id);
          if (msgExists) return oldData;
          
          // Determine isMe based on current user
          const processedMessage = {
            ...data.message,
            sender: {
              ...data.message.sender,
              isMe: data.message.sender.id === user?.id
            }
          };

          return {
            ...oldData,
            data: {
              ...oldData.data,
              data: {
                ...oldData.data.data,
                messages: [...oldData.data.data.messages, processedMessage]
              }
            }
          };
        });
        scrollToBottom();
      }

      // 2. Update conversation list preview & timestamps
      queryClient.setQueryData(['conversations'], (oldData: any) => {
        if (!oldData?.data?.data?.conversations) return oldData;
        
        const newConvs = oldData.data.data.conversations.map((conv: any) => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              lastMessage: data.message,
              updatedAt: new Date().toISOString()
            };
          }
          return conv;
        });

        // Always push active one to top
        newConvs.sort((a: any, b: any) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        return {
          ...oldData,
          data: {
            ...oldData.data,
            data: {
              ...oldData.data.data,
              conversations: newConvs
            }
          }
        };
      });
    };

    const handleTypingEvent = (data: { userId: string; fullName?: string; isTyping: boolean }) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.userId]: { name: data.fullName || 'Someone', isTyping: data.isTyping }
      }));
    };

    socket.on('new-message', handleNewMessage);
    socket.on('typing', handleTypingEvent);
    
    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('typing', handleTypingEvent);
    };
  }, [socket, selectedConvId, queryClient, user?.id]);

  // Join/Leave conversation room
  useEffect(() => {
    if (!socket || !selectedConvId) return;

    socket.emit('join-conversation', selectedConvId);

    return () => {
      socket.emit('leave-conversation', selectedConvId);
    };
  }, [socket, selectedConvId]);

  // Real-time socket message handler logic above...


  // Scroll to bottom when messages load
  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, selectedConvId]);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (selectedConvId) {
      chatApi.markAsRead(selectedConvId).catch(() => {});
    }
  }, [selectedConvId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [newMessage]);

  const handleTyping = () => {
    if (!socket || !selectedConvId) return;

    // Send typing:start
    socket.emit('typing:start', { conversationId: selectedConvId });

    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set timeout to send typing:stop after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: selectedConvId });
    }, 2000);
  };

  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string }) => chatApi.sendMessage(selectedConvId!, data),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      scrollToBottom();
    },
    onError: () => toast.error('Failed to send message'),
  });

  const createConvMutation = useMutation({
    mutationFn: (data: { participantId?: string; type: string; title?: string }) =>
      chatApi.createConversation(data),
    onSuccess: (res) => {
      const convId = res.data.data.conversation.id.toString();
      setSelectedConvId(convId);
      setShowMobileList(false);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => toast.error('Failed to create conversation'),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvId || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate({ content: newMessage.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const filteredConvs = conversations.filter((c: any) =>
    getConvTitle(c, user?.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConv = conversations.find((c: any) => c.id.toString() === selectedConvId);
  const isAdmin = user?.roleName === 'SUPER_ADMIN' || user?.roleName === 'FINANCE_ADMIN';

  const handleSelectConv = (id: string) => {
    setSearchParams({ convId: id });
    setSelectedConvId(id);
    setShowMobileList(false);
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div
      className="flex bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
      style={{ height: 'calc(100vh - 9rem)' }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div
        className={`${showMobileList ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 xl:w-96 flex-col border-r border-slate-100 flex-shrink-0 bg-white`}
      >
        {/* Sidebar Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Messages</h2>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConvs ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-slate-100 rounded-2xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded-full w-3/4" />
                    <div className="h-2.5 bg-slate-50 rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-3xl flex items-center justify-center mb-3">
                <MessageSquare size={24} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">Vos conversations d'achat s'afficheront ici.</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredConvs.map((conv: any) => {
                const isActive = selectedConvId === conv.id.toString();
                const title = getConvTitle(conv, user?.id);
                const avatarName = getConvAvatar(conv, user?.id);
                const isSupport = conv.type === 'SUPPORT';
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConv(conv.id.toString())}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all group ${
                      isActive
                        ? 'bg-violet-50 border-r-2 border-violet-500'
                        : 'hover:bg-slate-50 border-r-2 border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {isSupport ? (
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <Headphones size={18} className="text-white" />
                        </div>
                      ) : (
                        <Avatar name={avatarName} size="md" />
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1 mb-0.5">
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm font-semibold truncate ${isActive ? 'text-violet-700' : 'text-slate-800'}`}>
                            {title}
                          </span>
                        </div>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className="text-xs text-slate-400 truncate">
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Area ────────────────────────────────────────────────── */}
      <div className={`${!showMobileList ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-w-0 bg-gradient-to-b from-slate-50/30 to-white`}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center gap-3 shadow-sm">
              {/* Mobile back */}
              <button
                onClick={() => setShowMobileList(true)}
                className="lg:hidden mr-1 w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>

              {selectedConv.type === 'SUPPORT' ? (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Headphones size={18} className="text-white" />
                </div>
              ) : (
                <Avatar name={getConvAvatar(selectedConv, user?.id)} size="md" />
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm leading-none mb-1 truncate">
                  {getConvTitle(selectedConv, user?.id)}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedConv?.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-xs text-slate-400">
                    {selectedConv?.status === 'ACTIVE' ? 'En ligne' : 'En attente'}
                  </span>
                  {Object.values(typingUsers).some(u => u.isTyping) && (
                    <>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs font-black text-violet-500 animate-pulse">
                        En train d'écrire...
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                <MoreVertical size={16} />
              </button>
            </div>

            {/* Waiting for Agent Banner (For Users Only) */}
            {selectedConv?.status === 'PENDING_CLAIM' && user?.role !== 'SYSTEM_SUPPORT' && user?.role !== 'SUPER_ADMIN' && (
              <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                  <Clock size={16} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-900 leading-tight">En attente d'un assistant</p>
                  <p className="text-[10px] font-bold text-amber-700">Votre demande a été envoyée. Vous pouvez commencer à écrire ici.</p>
                </div>
              </div>
            )}

            {/* Agent Order Detail Card */}
            {(user?.role === 'SYSTEM_SUPPORT' || user?.role === 'SUPER_ADMIN') && selectedConv?.metadata && (
              <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shadow-sm">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center font-black">
                       🛒
                     </div>
                     <div>
                       <p className="text-xs font-black text-slate-900">{selectedConv.metadata.productName || 'Produit'}</p>
                       <p className="text-[10px] font-bold text-slate-400">SKU: {selectedConv.metadata.productSku} • Cmd: #{selectedConv.metadata.orderNumber}</p>
                     </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-6 text-sm">
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">Marque</span>
                       <span className="font-black text-slate-900">{selectedConv.metadata.brandName || 'N/A'}</span>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">Quantité</span>
                       <span className="font-black text-slate-900">{selectedConv.metadata.requestedQty || 0}</span>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">CA Attendu</span>
                       <span className="font-black text-emerald-600">{(selectedConv.metadata.requestedQty || 0) * (selectedConv.metadata.retailPriceMad || 0)} MAD</span>
                     </div>
                  </div>
                  {selectedConv.metadata.brandingLabelPrintUrl && (
                     <a 
                       href={selectedConv.metadata.brandingLabelPrintUrl.startsWith('http') ? selectedConv.metadata.brandingLabelPrintUrl : `${BACKEND_URL}${selectedConv.metadata.brandingLabelPrintUrl}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-violet-600 transition-all flex items-center gap-2 uppercase tracking-widest shrink-0"
                     >
                       <Paperclip size={14} /> PDF Label
                     </a>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-1">
              {isLoadingMessages ? (
                <div className="flex flex-col gap-3 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className={`h-10 rounded-2xl ${i % 2 === 0 ? 'bg-violet-100 w-48' : 'bg-slate-100 w-40'}`} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                    <MessageSquare size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">No messages yet</p>
                  <p className="text-xs text-slate-400 mt-1">Say hello to start the conversation!</p>
                </div>
              ) : (
                messageGroups.map((group) => (
                  <div key={group.label}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {group.messages.map((msg: any, idx: number) => {
                      const isMe = msg.sender.isMe;
                      const showAvatar = !isMe && (idx === 0 || group.messages[idx - 1]?.sender?.isMe);
                      const isSameNext = !isMe &&
                        group.messages[idx + 1] &&
                        !group.messages[idx + 1].sender.isMe;

                      return (
                        <div
                          key={msg.id}
                          className={`flex mb-1 ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}
                        >
                          {/* Avatar for others */}
                          {!isMe && (
                            <div className={`flex-shrink-0 ${isSameNext ? 'invisible' : ''}`}>
                              <Avatar name={msg.sender.fullName} size="sm" />
                            </div>
                          )}

                          <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                            {/* Sender name for first message in sequence */}
                            {!isMe && showAvatar && (
                              <span className="text-[10px] font-bold text-slate-500 ml-2 mb-0.5">
                                {msg.sender.fullName || msg.sender.role}
                              </span>
                            )}

                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-br-md'
                                  : 'bg-white text-slate-800 border border-slate-100 shadow-sm rounded-bl-md'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>

                            <div className={`flex items-center gap-1 px-1 ${isMe ? 'justify-end' : ''}`}>
                              <span className="text-[9px] text-slate-400">{formatTime(msg.createdAt)}</span>
                              {isMe && <CheckCheck size={11} className="text-violet-400" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white px-4 pb-4 pt-3 border-t border-slate-100">
              <form onSubmit={handleSend}>
                <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-400 transition-all">
                  <button
                    type="button"
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors mb-0.5"
                  >
                    <Paperclip size={16} />
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a message… (Enter to send)"
                    className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder-slate-400 py-1.5 max-h-28 leading-relaxed"
                    rows={1}
                  />

                  <button
                    type="button"
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors mb-0.5"
                  >
                    <Smile size={16} />
                  </button>

                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all mb-0.5 ${
                      newMessage.trim() && !sendMessageMutation.isPending
                        ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white hover:shadow-lg hover:shadow-violet-500/25 hover:scale-105'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {sendMessageMutation.isPending ? (
                      <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={15} strokeWidth={2.5} />
                    )}
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-2 tracking-wide">
                  ↵ Send · Shift+↵ New line
                </p>
              </form>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner">
              <MessageSquare size={36} className="text-violet-400" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Your Messages</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs">
              Start a new conversation with our support team and wait for a support member to join the chat by claiming it from their dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
