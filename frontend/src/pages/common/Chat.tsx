import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, adminApi, uploadApi, BACKEND_URL } from '../../lib/api';
import {
  Send, Search, Plus, MessageSquare, CheckCheck,
  ChevronLeft, ChevronRight, Headphones, MoreVertical, Smile, Paperclip, Clock,
  FileText, Download, Image as ImageIcon,
  CheckCircle, UserPlus, X, RotateCcw, Ticket, Eye
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: string | Date, language: string, t: any) {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return t('today', 'chat');
  if (diff === 1) return t('yesterday', 'chat');
  return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : language, { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupMessagesByDate(messages: any[], language: string, t: any) {
  const groups: { label: string; messages: any[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const label = formatDate(msg.createdAt, language, t);
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

function getConvTitle(conv: any, myId?: number, t?: any) {
  if (conv.title) return conv.title;
  const other = conv.participants?.find((p: any) => p.userId !== myId);
  if (other?.fullName) return other.fullName;
  if (conv.metadata?.subject) return conv.metadata.subject;
  if (conv.type === 'SUPPORT' && conv.id) return t ? t('ticket_ref', 'chat', { id: conv.id }).replace('{id}', conv.id.toString()) : `Ticket #${conv.id}`;
  return t ? t('unknown', 'chat') : 'Unknown';
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
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Fetch PDF as blob to bypass X-Frame-Options: DENY
  useEffect(() => {
    if (!pdfModalUrl) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }
    setPdfLoading(true);
    fetch(pdfModalUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      })
      .catch(() => toast.error('Failed to load PDF'))
      .finally(() => setPdfLoading(false));
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfModalUrl]);

  const getSupportRoute = () => {
    const role = user?.role || user?.roleName;
    switch (role) {
      case 'SUPER_ADMIN':
      case 'FINANCE_ADMIN':
      case 'SYSTEM_SUPPORT': return '/admin/support';
      case 'VENDOR': return '/dashboard/support';
      case 'GROSSELLER': return '/grosseller/support';
      case 'INFLUENCER': return '/influencer/support';
      default: return '/admin/support';
    }
  };

  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['conversation-logs', selectedConvId],
    queryFn: () => chatApi.getConversationLogs(selectedConvId!),
    enabled: !!selectedConvId && showLogsModal,
  });
  const logs = logsData?.data?.data?.logs || [];

  // Click outside to close action menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setShowActionMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClaim = async () => {
    if (!selectedConvId) return;
    try {
      await chatApi.claimConversation(selectedConvId);
      toast.success(t('toast_claimed', 'chat'));
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setShowActionMenu(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('toast_error_claim', 'chat'));
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedConvId) return;
    try {
      await chatApi.closeConversation(selectedConvId);
      toast.success(t('toast_closed', 'chat'));
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-detail', selectedConvId] });
      setShowActionMenu(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('toast_error_close', 'chat'));
    }
  };

  const handleOpenTicket = async () => {
    if (!selectedConvId) return;
    try {
      await chatApi.openConversation(selectedConvId);
      toast.success(t('toast_reopened', 'chat'));
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-detail', selectedConvId] });
      setShowActionMenu(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('toast_error_reopen', 'chat'));
    }
  };

  // Fetch conversations
  const { data: convData, isLoading: isLoadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatApi.conversations(),
    refetchInterval: false, // Turn off polling since we have sockets
  });

  const conversations: any[] = convData?.data?.data?.conversations || [];

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => chatApi.messages(selectedConvId!, { limit: 100 }),
    enabled: !!selectedConvId,
    refetchInterval: false, // Turn off polling
  });

  const messages: any[] = messagesData?.data?.data?.messages || [];

  // Fetch single conversation detail if it's not in the main list (for admins deep-linking)
  const { data: singleConvData } = useQuery({
    queryKey: ['conversation-detail', selectedConvId],
    queryFn: () => chatApi.getConversation(selectedConvId!),
    enabled: !!selectedConvId && !conversations.find((c: any) => c.id.toString() === selectedConvId),
  });

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
            const isViewing = selectedConvId === String(data.conversationId);
            return {
              ...conv,
              lastMessage: data.message,
              updatedAt: new Date().toISOString(),
              unreadCount: isViewing ? 0 : (conv.unreadCount || 0) + 1
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

    const handleNewTicket = (data: { conversation: any }) => {
      // ONLY add to sidebar if I am the creator/participant
      const isParticipant = data.conversation.participants?.some((p: any) => p.userId === user?.id);
      if (!isParticipant) return;

      queryClient.setQueryData(['conversations'], (oldData: any) => {
        if (!oldData?.data?.data?.conversations) return oldData;
        if (oldData.data.data.conversations.some((c: any) => c.id === data.conversation.id)) return oldData;
        
        const newTicket = {
          ...data.conversation,
          unreadCount: 1,
          updatedAt: new Date().toISOString()
        };
        const newConvs = [newTicket, ...oldData.data.data.conversations];
        return {
          ...oldData,
          data: { ...oldData.data, data: { ...oldData.data.data, conversations: newConvs } }
        };
      });
    };

    const handleClaimed = (data: { conversationId: number, participant: any }) => {
      queryClient.setQueryData(['conversations'], (oldData: any) => {
        if (!oldData?.data?.data?.conversations) return oldData;
        
        const isMe = data.participant.userId === user?.id;
        const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.roleName || '');
        
        const newConvs = oldData.data.data.conversations.map((c: any) => {
          if (c.id === data.conversationId) {
            // Update status to ACTIVE for everyone who keeps the conversation
            return { ...c, status: 'ACTIVE', participants: [...(c.participants || []), data.participant] };
          }
          return c;
        }).filter((c: any) => {
          if (c.id === data.conversationId && isAgent) {
            // Agents only keep it if they are the one who claimed it
            return isMe;
          }
          // Non-agents (clients) always keep their conversations
          return true;
        });

        return {
          ...oldData,
          data: { ...oldData.data, data: { ...oldData.data.data, conversations: newConvs } }
        };
      });

      // Also invalidate selected conversation if it's the one claimed
      if (selectedConvId === String(data.conversationId)) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      }
    };
    const handleClosed = (data: { conversationId: number }) => {
      queryClient.setQueryData(['conversations'], (oldData: any) => {
        if (!oldData?.data?.data?.conversations) return oldData;
        const newConvs = oldData.data.data.conversations.map((c: any) => {
          if (c.id === data.conversationId) {
            return { ...c, status: 'CLOSED' };
          }
          return c;
        });
        return {
          ...oldData,
          data: { ...oldData.data, data: { ...oldData.data.data, conversations: newConvs } }
        };
      });
      // Invalidate specific message query to ensure state consistency
      if (selectedConvId === String(data.conversationId)) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
        queryClient.invalidateQueries({ queryKey: ['conversation-detail', selectedConvId] });
      }
    };

    const handleOpened = (data: { conversationId: number }) => {
      queryClient.setQueryData(['conversations'], (oldData: any) => {
        if (!oldData?.data?.data?.conversations) return oldData;
        const newConvs = oldData.data.data.conversations.map((c: any) => {
          if (c.id === data.conversationId) {
            return { ...c, status: 'ACTIVE' };
          }
          return c;
        });
        return {
          ...oldData,
          data: { ...oldData.data, data: { ...oldData.data.data, conversations: newConvs } }
        };
      });
      // Invalidate queries to refresh UI
      if (selectedConvId === String(data.conversationId)) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
        queryClient.invalidateQueries({ queryKey: ['conversation-detail', selectedConvId] });
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('typing', handleTypingEvent);
    socket.on('new-support-ticket', handleNewTicket);
    socket.on('conversation-claimed', handleClaimed);
    socket.on('conversation-closed', handleClosed);
    socket.on('conversation-opened', handleOpened);
    
    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('typing', handleTypingEvent);
      socket.off('new-support-ticket', handleNewTicket);
      socket.off('conversation-claimed', handleClaimed);
      socket.off('conversation-closed', handleClosed);
      socket.off('conversation-opened', handleOpened);
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

  // Join support queue room for agents
  useEffect(() => {
    const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.roleName || '');
    if (!socket || !isAgent) return;

    socket.emit('join-room', 'support-queue');

    return () => {
      socket.emit('leave-room', 'support-queue');
    };
  }, [socket, user?.roleName]);

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
      
      // Update local unread count
      queryClient.setQueryData(['conversations'], (oldData: any) => {
        if (!oldData?.data?.data?.conversations) return oldData;
        
        let readCount = 0;
        const newConvs = oldData.data.data.conversations.map((conv: any) => {
          if (conv.id.toString() === selectedConvId) {
            readCount = conv.unreadCount || 0;
            return { ...conv, unreadCount: 0 };
          }
          return conv;
        });

        // Notify DashboardLayout to update its totalUnread state
        if (readCount > 0) {
          window.dispatchEvent(new CustomEvent('chat:read', { detail: { count: readCount } }));
        }

        return { ...oldData, data: { ...oldData.data, data: { ...oldData.data.data, conversations: newConvs } } };
      });
    }
  }, [selectedConvId, queryClient]);

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
    mutationFn: (data: { content: string; messageType?: string; attachmentUrl?: string }) => 
      chatApi.sendMessage(selectedConvId!, data),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      scrollToBottom();
    },
    onError: () => toast.error(t('toast_error_send', 'chat')),
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
    onError: () => toast.error(t('toast_error_create', 'chat')),
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;

    // Validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('toast_error_file_type', 'chat'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('toast_error_file_size', 'chat'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const toastId = toast.loading(t('toast_uploading', 'chat'));

    try {
      const res = await uploadApi.image(formData);
      const url = res.data.data.url;
      const type = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';
      
      sendMessageMutation.mutate({
        content: t('file_sent', 'chat').replace('{name}', file.name),
        messageType: type,
        attachmentUrl: url
      });
      toast.success(t('toast_success_upload', 'chat'), { id: toastId });
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error(t('toast_error_upload', 'chat'), { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredConvs = conversations.filter((c: any) =>
    getConvTitle(c, user?.id, t).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConv = conversations.find((c: any) => c.id.toString() === selectedConvId) || singleConvData?.data?.data?.conversation;
  const isAdmin = user?.roleName === 'SUPER_ADMIN' || user?.roleName === 'FINANCE_ADMIN';

  const handleSelectConv = (id: string) => {
    setSearchParams({ convId: id });
    setSelectedConvId(id);
    setShowMobileList(false);
  };

  const messageGroups = groupMessagesByDate(messages, language, t);

  return (
    <div
      className="flex bg-white rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
      style={{ height: 'calc(100vh - 9rem)' }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div
        className={`${showMobileList ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 xl:w-96 flex-col ${language === 'ar' ? 'border-l' : 'border-r'} border-slate-100 flex-shrink-0 bg-white`}
      >
        {/* Sidebar Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('messages', 'chat')}</h2>
            <button
              onClick={() => navigate(getSupportRoute())}
              className="flex items-center gap-2 px-3 py-1.5 h-8 rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors text-xs font-bold"
              title={t('tickets', 'chat')}
            >
              {t('tickets', 'chat')} <Ticket size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={15} className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
            <input
              type="text"
              placeholder={t('search_placeholder', 'chat')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-slate-50 border border-slate-100 rounded-xl ${language === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all`}
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
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                <MessageSquare size={24} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">{t('no_conversations', 'chat')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('no_conversations_desc', 'chat')}</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredConvs.map((conv: any) => {
                const isActive = selectedConvId === conv.id.toString();
                const title = getConvTitle(conv, user?.id, t);
                const avatarName = getConvAvatar(conv, user?.id);
                const isSupport = conv.type === 'SUPPORT';
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConv(conv.id.toString())}
                    className={`w-full ${language === 'ar' ? 'text-right' : 'text-left'} px-4 py-3.5 flex items-center gap-3 transition-all group ${
                      isActive
                        ? `bg-violet-50 ${language === 'ar' ? 'border-l-2' : 'border-r-2'} border-violet-500`
                        : `hover:bg-slate-50 ${language === 'ar' ? 'border-l-2' : 'border-r-2'} border-transparent`
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
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {conv.lastMessage && (
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {formatTime(conv.lastMessage.createdAt)}
                            </span>
                          )}
                          {conv.unreadCount > 0 && (
                            <span className="bg-violet-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-violet-200">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
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
                 className={`lg:hidden ${language === 'ar' ? 'ml-1' : 'mr-1'} w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors`}
               >
                 {language === 'ar' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
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
                  {getConvTitle(selectedConv, user?.id, t)}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedConv?.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 
                    selectedConv?.status === 'CLOSED' ? 'bg-slate-400' : 
                    'bg-amber-400'
                  }`} />
                  <span className="text-xs text-slate-400">
                    {selectedConv?.status === 'ACTIVE' ? t('online', 'chat') : 
                     selectedConv?.status === 'CLOSED' ? t('closed_status', 'chat') : 
                     t('pending_status', 'chat')}
                  </span>
                </div>
              </div>

              <div className="relative" ref={actionMenuRef}>
                <button 
                  onClick={() => setShowActionMenu(!showActionMenu)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    showActionMenu ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                >
                  <MoreVertical size={16} />
                </button>

                 {showActionMenu && (
                   <div className={`absolute ${language === 'ar' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[60] animate-in fade-in zoom-in-95 duration-200`}>
                    <div className="px-3 py-2 border-b border-slate-50 mb-1">
                       <p className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ${language === 'ar' ? 'text-right' : 'text-left'}`}>{t('actions_ticket', 'chat')}</p>
                    </div>

                    {(user?.role === 'SYSTEM_SUPPORT' || user?.role === 'SUPER_ADMIN') && selectedConv?.status === 'PENDING_CLAIM' && (
                      <button
                        onClick={handleClaim}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${language === 'ar' ? 'text-right' : 'text-left'} text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors group`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <UserPlus size={16} />
                        </div>
                        <div>
                          <p className="leading-none">{t('claim', 'chat')}</p>
                          <p className="text-[10px] font-medium text-emerald-600/60 mt-1">{t('claim_desc', 'chat')}</p>
                        </div>
                      </button>
                    )}

                    {(user?.role === 'SYSTEM_SUPPORT' || user?.role === 'SUPER_ADMIN') && selectedConv?.status === 'ACTIVE' && (
                      <button
                        onClick={handleCloseTicket}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${language === 'ar' ? 'text-right' : 'text-left'} text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors group`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <CheckCircle size={16} />
                        </div>
                        <div>
                          <p className="leading-none">{t('close', 'chat')}</p>
                          <p className="text-[10px] font-medium text-rose-600/60 mt-1">{t('close_desc', 'chat')}</p>
                        </div>
                      </button>
                    )}

                    {(user?.role === 'SYSTEM_SUPPORT' || user?.role === 'SUPER_ADMIN') && selectedConv?.status === 'CLOSED' && (
                      <button
                        onClick={handleOpenTicket}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${language === 'ar' ? 'text-right' : 'text-left'} text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors group`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <RotateCcw size={16} />
                        </div>
                        <div>
                          <p className="leading-none">{t('reopen', 'chat')}</p>
                          <p className="text-[10px] font-medium text-emerald-600/60 mt-1">{t('reopen_desc', 'chat')}</p>
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => { setShowLogsModal(true); setShowActionMenu(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 ${language === 'ar' ? 'text-right' : 'text-left'} text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors group`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform text-slate-400">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="leading-none">{t('history', 'chat')}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">{t('history_desc', 'chat')}</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Waiting for Agent Banner (For Users Only) */}
            {selectedConv?.status === 'PENDING_CLAIM' && user?.role !== 'SYSTEM_SUPPORT' && user?.role !== 'SUPER_ADMIN' && (
              <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                    <Clock size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-900 leading-tight">{t('waiting_assistant', 'chat')}</p>
                    <p className="text-[10px] font-bold text-amber-700">{t('waiting_assistant_desc', 'chat')}</p>
                  </div>
                </div>
                <a 
                  href="https://wa.me/212660517679" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-black hover:bg-[#128C7E] transition-colors shadow-sm shrink-0"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                  </svg>
                  Contact WhatsApp
                </a>
              </div>
            )}

            {/* Agent Order Detail Card */}
            {(user?.role === 'SYSTEM_SUPPORT' || user?.role === 'SUPER_ADMIN') && selectedConv?.metadata && (
              <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shadow-sm">
                   <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="flex items-center gap-3">
                       <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center font-black">
                         🛒
                       </div>
                       <div>
                         <p className="text-xs font-black text-slate-900">{selectedConv.metadata.productName || t('product', 'chat')}</p>
                         <p className="text-[10px] font-bold text-slate-400">SKU: {selectedConv.metadata.productSku} • Cmd: #{selectedConv.metadata.orderNumber}</p>
                       </div>
                    </div>

                    {/* User Info Section */}
                    {(() => {
                      const customer = selectedConv?.participants?.find((p: any) => 
                        !['SUPER_ADMIN', 'FINANCE_ADMIN', 'SYSTEM_SUPPORT'].includes(p.role)
                      );
                      if (!customer) return null;
                      return (
                        <div className={`flex items-center gap-3 ${language === 'ar' ? 'border-r border-slate-100 pr-6 pl-0' : 'border-l border-slate-100 pl-6'}`}>
                           <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black">
                             👤
                           </div>
                           <div>
                             <p className="text-xs font-black text-slate-900">{customer.fullName || t('default_user', 'chat')}</p>
                             <p className="text-[10px] font-bold text-slate-400">
                               {customer.email} {customer.phone && `• ${customer.phone}`}
                             </p>
                           </div>
                        </div>
                      );
                    })()}
                   </div>
                  <div className="flex flex-wrap gap-2 md:gap-6 text-sm">
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">{t('brand', 'chat')}</span>
                       <span className="font-black text-slate-900">{selectedConv.metadata.brandName || 'N/A'}</span>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">{t('quantity', 'chat')}</span>
                       <span className="font-black text-slate-900">{selectedConv.metadata.requestedQty || 0}</span>
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">{t('expected_revenue', 'chat')}</span>
                       <span className="font-black text-emerald-600">{(selectedConv.metadata.requestedQty || 0) * (selectedConv.metadata.retailPriceMad || 0)} MAD</span>
                     </div>
                     {selectedConv.metadata.requestedLandingPageUrl && (() => {
                        const rawUrl = selectedConv.metadata.requestedLandingPageUrl;
                        if (!rawUrl) return null;
                        
                        let safeUrl = rawUrl.trim();
                        // Prevent javascript:, data:, and vbscript: URIs
                        if (/^(javascript|data|vbscript):/i.test(safeUrl)) {
                          safeUrl = '#';
                        } else if (!/^https?:\/\//i.test(safeUrl)) {
                          safeUrl = `https://${safeUrl}`;
                        }
                        
                        return (
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400">URL Landing Page</span>
                            <a 
                              href={safeUrl} 
                              target={safeUrl === '#' ? '_self' : '_blank'} 
                              rel="noopener noreferrer"
                              className="font-black text-violet-600 hover:text-violet-700 underline underline-offset-2 max-w-[150px] truncate block"
                              title={rawUrl}
                            >
                              {rawUrl}
                            </a>
                          </div>
                        );
                      })()}
                  </div>
                  {selectedConv.metadata.brandingLabelPrintUrl && (
                     <button 
                       onClick={() => setPdfModalUrl(selectedConv.metadata.brandingLabelPrintUrl.startsWith('http') ? selectedConv.metadata.brandingLabelPrintUrl : `${BACKEND_URL}${selectedConv.metadata.brandingLabelPrintUrl}`)}
                       className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-violet-600 transition-all flex items-center gap-2 uppercase tracking-widest shrink-0"
                     >
                       <Paperclip size={14} /> PDF Label
                     </button>
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
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">{t('no_messages', 'chat')}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('no_messages_desc', 'chat')}</p>
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
                              {msg.messageType === 'IMAGE' ? (
                                <div className="mt-1">
                                  <img 
                                    src={msg.attachmentUrl.startsWith('http') ? msg.attachmentUrl : `${BACKEND_URL}${msg.attachmentUrl}`} 
                                    alt="Attachment" 
                                    className="max-w-full rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(msg.attachmentUrl.startsWith('http') ? msg.attachmentUrl : `${BACKEND_URL}${msg.attachmentUrl}`, '_blank')}
                                  />
                                </div>
                              ) : msg.messageType === 'FILE' ? (
                                <a 
                                  href={msg.attachmentUrl.startsWith('http') ? msg.attachmentUrl : `${BACKEND_URL}${msg.attachmentUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-3 px-4 py-3 rounded-xl mt-1 border transition-all ${
                                    isMe ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isMe ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                                    <FileText size={16} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate">{t('pdf_document', 'chat')}</p>
                                    <p className="text-[10px] opacity-60">{t('pdf_desc', 'chat')}</p>
                                  </div>
                                  <Download size={14} className="opacity-40" />
                                </a>
                              ) : (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              )}
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

            {/* Typing Indicator at bottom */}
            {Object.values(typingUsers).some(u => u.isTyping) && (
              <div className="px-5 py-2 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
                </div>
                <span className="text-xs font-bold text-violet-500">
                  {t('typing', 'chat')}
                </span>
              </div>
            )}

            {/* Input Area */}
            <div className="bg-white px-4 pb-4 pt-3 border-t border-slate-100">
              {selectedConv?.status === 'CLOSED' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{t('chat_ended', 'chat')}</p>
                    <p className="text-[10px] font-bold text-slate-400">{t('chat_ended_desc', 'chat')}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSend}>
                  <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-400 transition-all">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendMessageMutation.isPending}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors mb-0.5"
                    >
                      <Paperclip size={16} />
                    </button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".png,.jpeg,.jpg,.webp,.pdf"
                      className="hidden"
                    />

                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={t('input_placeholder', 'chat')}
                      className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder-slate-400 py-1.5 max-h-28 leading-relaxed"
                      rows={1}
                    />

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
                    {t('input_help', 'chat')}
                  </p>
                </form>
              )}
            </div>
          </>
        ) : selectedConvId ? (
          /* Loading state when a conversation is selected but not yet available in the list */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
              <span className="w-8 h-8 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
            </div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t('opening_chat', 'chat')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('please_wait', 'chat')}</p>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-[2rem] flex items-center justify-center mb-5 shadow-inner">
              <MessageSquare size={36} className="text-violet-400" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">{t('your_messages', 'chat')}</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs">
              {t('your_messages_desc', 'chat')}
            </p>
          </div>
        )}
      </div>

      {/* PDF Label Modal */}
      {pdfModalUrl && createPortal(
        <div data-modal-portal className="fixed inset-0 flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 2147483647, isolation: 'isolate' }}>
          <div 
            data-modal-backdrop
            className="fixed inset-0 transition-opacity animate-in fade-in duration-200"
            style={{ zIndex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
            onClick={() => setPdfModalUrl(null)}
          />
          <div data-modal-content className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200" style={{ zIndex: 10 }}>
            <div className="flex-shrink-0 p-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                  <Eye size={18} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Branding Label</h3>
                  <p className="text-xs text-slate-400 font-medium">{/\.(png|jpe?g|webp|gif|svg)$/i.test(pdfModalUrl || '') ? 'Image preview' : 'PDF preview'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfModalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <Download size={14} /> Télécharger
                </a>
                <button 
                  onClick={() => setPdfModalUrl(null)}
                  className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-4 bg-slate-100">
              {pdfLoading ? (
                <div className="w-full flex flex-col items-center justify-center gap-3" style={{ minHeight: '70vh' }}>
                  <div className="w-10 h-10 border-4 border-violet-100 border-t-violet-500 rounded-full animate-spin" />
                  <span className="text-xs font-bold text-slate-500">Chargement du document PDF...</span>
                </div>
              ) : pdfBlobUrl ? (
                /\.(png|jpe?g|webp|gif|svg)$/i.test(pdfModalUrl || '') ? (
                  <div className="w-full flex items-center justify-center bg-white rounded-2xl border border-slate-200 overflow-auto p-4" style={{ minHeight: '70vh' }}>
                    <img
                      src={pdfBlobUrl}
                      alt="Branding Label"
                      className="max-w-full max-h-[75vh] object-contain shadow-md rounded-lg"
                    />
                  </div>
                ) : (
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-inner"
                    style={{ minHeight: '70vh' }}
                    title="PDF Label Preview"
                  />
                )
              ) : (
                <div className="w-full flex items-center justify-center text-slate-400 text-sm font-bold" style={{ minHeight: '70vh' }}>
                  Impossible de charger le fichier PDF
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logs Modal */}
      {showLogsModal && createPortal(
        <div data-modal-portal className="fixed inset-0 flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 2147483647, isolation: 'isolate' }}>
          <div 
            data-modal-backdrop
            className="fixed inset-0 transition-opacity animate-in fade-in duration-200"
            style={{ zIndex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
            onClick={() => setShowLogsModal(false)}
          />
          <div data-modal-content className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200" style={{ zIndex: 10 }}>
            <div className="flex-shrink-0 p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">{t('ticket_history', 'chat')}</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">{t('action_trace', 'chat')}</p>
              </div>
              <button 
                onClick={() => setShowLogsModal(false)}
                className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingLogs ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-violet-100 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock size={24} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{t('no_logs', 'chat')}</p>
                  <p className="text-xs text-slate-500 mt-1">{t('no_logs_desc', 'chat')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {logs.map((log: any, index: number) => (
                    <div key={log.id} className={`relative ${language === 'ar' ? 'pr-6 pl-0' : 'pl-6 pr-0'}`}>
                      {/* Timeline line */}
                      {index !== logs.length - 1 && (
                        <div className={`absolute ${language === 'ar' ? 'right-[11px] left-auto' : 'left-[11px] right-auto'} top-8 bottom-[-24px] w-0.5 bg-slate-100`} />
                      )}
                      
                      {/* Timeline dot */}
                      <div className={`absolute ${language === 'ar' ? 'right-0 left-auto' : 'left-0 right-auto'} top-1.5 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${
                        log.action === 'CREATED' ? 'bg-violet-500' :
                        log.action === 'CLAIMED' ? 'bg-emerald-500' :
                        log.action === 'CLOSED' ? 'bg-slate-400' :
                        'bg-blue-500'
                      }`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>

                      <div className={`bg-slate-50 rounded-2xl p-4 ${language === 'ar' ? 'mr-2 ml-0 text-right' : 'ml-2 mr-0 text-left'}`}>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className="text-sm font-bold text-slate-900">
                            {log.action === 'CREATED' ? t('log_created', 'chat') :
                             log.action === 'CLAIMED' ? t('log_claimed', 'chat') :
                             log.action === 'CLOSED' ? t('log_closed', 'chat') :
                             log.action}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-xs text-slate-500 font-medium">{log.details}</p>
                        )}
                        {log.user && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60">
                            <Avatar name={log.user.profile?.fullName || log.user.email} size="sm" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-700">{log.user.profile?.fullName || t('default_user', 'chat')}</p>
                              <p className="text-[9px] text-slate-400 font-medium">{log.user.role?.name}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
