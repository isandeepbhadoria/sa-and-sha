import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  RefreshCw,
  Send,
  User,
  Phone,
  Search,
  CheckCheck,
  AlertCircle,
  Inbox
} from 'lucide-react';

export interface WhatsAppMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  wa_message_id: string | null;
  phone: string;
  customer_profile_id: string | null;
  message_type: string;
  body: string | null;
  read: boolean;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WhatsAppCustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
}

export interface WhatsAppConversation {
  phone: string;
  customerProfile: WhatsAppCustomerProfile | null;
  lastMessage: WhatsAppMessage | null;
  unreadCount: number;
}

interface AdminWhatsAppInboxTabProps {
  adminToken?: string;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

const formatConversationName = (convo: WhatsAppConversation): string => {
  const name = [convo.customerProfile?.firstName, convo.customerProfile?.lastName].filter(Boolean).join(' ').trim();
  return name || formatPhone(convo.phone);
};

const formatPhone = (phone: string): string => {
  // 919876543210 -> +91 98765 43210
  if (/^91\d{10}$/.test(phone)) {
    const subscriber = phone.slice(2);
    return `+91 ${subscriber.slice(0, 5)} ${subscriber.slice(5)}`;
  }
  return `+${phone}`;
};

const formatTimestamp = (iso: string | undefined): string => {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
      date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export const AdminWhatsAppInboxTab: React.FC<AdminWhatsAppInboxTabProps> = ({
  adminToken,
  onSuccessToast,
  onErrorToast
}) => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<WhatsAppCustomerProfile | null>(null);
  const [thread, setThread] = useState<WhatsAppMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return headers;
  }, [adminToken]);

  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await fetch('/api/admin/whatsapp-inbox/conversations', { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else {
        onErrorToast?.(data.error || 'Failed to load WhatsApp conversations.');
      }
    } catch (err: any) {
      console.error('Error fetching WhatsApp conversations:', err);
      onErrorToast?.('Network error while loading WhatsApp conversations.');
    } finally {
      setLoadingConversations(false);
    }
  }, [getHeaders, onErrorToast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchThread = useCallback(async (phone: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/admin/whatsapp-inbox/conversations/${phone}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setThread(data.messages || []);
        setSelectedProfile(data.customerProfile || null);
      } else {
        onErrorToast?.(data.error || 'Failed to load conversation thread.');
      }
    } catch (err: any) {
      console.error('Error fetching WhatsApp thread:', err);
      onErrorToast?.('Network error while loading the conversation.');
    } finally {
      setLoadingThread(false);
    }
  }, [getHeaders, onErrorToast]);

  const markConversationRead = useCallback(async (phone: string) => {
    try {
      await fetch(`/api/admin/whatsapp-inbox/conversations/${phone}/read`, {
        method: 'PATCH',
        headers: getHeaders()
      });
      setConversations((prev) => prev.map((c) => (c.phone === phone ? { ...c, unreadCount: 0 } : c)));
    } catch (err) {
      console.warn('Error marking WhatsApp conversation as read:', err);
    }
  }, [getHeaders]);

  const handleSelectConversation = (convo: WhatsAppConversation) => {
    setSelectedPhone(convo.phone);
    setSelectedProfile(convo.customerProfile);
    fetchThread(convo.phone);
    if (convo.unreadCount > 0) {
      markConversationRead(convo.phone);
    }
  };

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const handleSendReply = async () => {
    if (!selectedPhone || !replyText.trim() || sending) return;
    const body = replyText.trim();
    setSending(true);
    try {
      const res = await fetch(`/api/admin/whatsapp-inbox/conversations/${selectedPhone}/reply`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ body })
      });
      const data = await res.json();
      if (data.message) {
        setThread((prev) => [...prev, data.message]);
      }
      if (data.success) {
        setReplyText('');
        onSuccessToast?.('Reply sent.');
        fetchConversations();
      } else {
        onErrorToast?.(data.error || 'WhatsApp did not accept this reply — it was saved, but was not delivered.');
      }
    } catch (err: any) {
      console.error('Error sending WhatsApp reply:', err);
      onErrorToast?.('Network error while sending the reply.');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = formatConversationName(c).toLowerCase();
    return name.includes(q) || c.phone.includes(q.replace(/\D/g, ''));
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const selectedConvo = conversations.find((c) => c.phone === selectedPhone) || null;

  return (
    <div className="bg-white rounded-xl border border-[#E5D2BC]/20 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#B08D57]" />
          <h2 className="font-serif text-base font-bold text-[#2A211C]">WhatsApp Inbox</h2>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 bg-[#B08D57] text-white rounded-full text-[10px] font-bold">
              {totalUnread} unread
            </span>
          )}
        </div>
        <button
          onClick={fetchConversations}
          disabled={loadingConversations}
          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingConversations ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-320px)] min-h-[480px]">
        {/* CONVERSATION LIST */}
        <div className="border-r border-stone-100 flex flex-col min-h-0">
          <div className="p-3 border-b border-stone-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-[#B08D57]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="py-12 text-center text-stone-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#B08D57]" />
                <span>Loading conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs px-4">
                <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300" />
                <span>No WhatsApp conversations yet.</span>
              </div>
            ) : (
              filteredConversations.map((convo) => (
                <button
                  key={convo.phone}
                  type="button"
                  onClick={() => handleSelectConversation(convo)}
                  className={`w-full text-left px-4 py-3 border-b border-stone-50 transition-colors cursor-pointer flex items-start gap-3 ${
                    selectedPhone === convo.phone ? 'bg-[#B08D57]/10' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${convo.unreadCount > 0 ? 'font-bold text-[#2A211C]' : 'font-semibold text-stone-700'}`}>
                        {formatConversationName(convo)}
                      </p>
                      <span className="text-[10px] text-stone-400 flex-shrink-0">
                        {formatTimestamp(convo.lastMessage?.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-[11px] text-stone-500 truncate">
                        {convo.lastMessage?.direction === 'OUTBOUND' ? 'You: ' : ''}
                        {convo.lastMessage?.body || (convo.lastMessage ? `[${convo.lastMessage.message_type}]` : '')}
                      </p>
                      {convo.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-[#B08D57] text-white rounded-full text-[9px] font-bold flex-shrink-0">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* THREAD VIEW */}
        <div className="flex flex-col min-h-0 bg-stone-50/40">
          {!selectedPhone ? (
            <div className="flex-1 flex items-center justify-center text-stone-400 text-xs px-6 text-center">
              <div>
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <span>Select a conversation to view the thread.</span>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-stone-100 bg-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2A211C]">
                    {selectedConvo ? formatConversationName(selectedConvo) : formatPhone(selectedPhone)}
                  </p>
                  <p className="text-[11px] text-stone-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {formatPhone(selectedPhone)}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingThread ? (
                  <div className="py-12 text-center text-stone-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#B08D57]" />
                    <span>Loading thread...</span>
                  </div>
                ) : thread.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 text-xs">No messages in this conversation yet.</div>
                ) : (
                  thread.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs shadow-xs ${
                          msg.direction === 'OUTBOUND'
                            ? 'bg-[#B08D57] text-white rounded-br-sm'
                            : 'bg-white text-stone-800 border border-stone-100 rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.body || `[${msg.message_type}]`}
                        </p>
                        <div
                          className={`flex items-center gap-1 mt-1 text-[10px] ${
                            msg.direction === 'OUTBOUND' ? 'text-white/70 justify-end' : 'text-stone-400'
                          }`}
                        >
                          <span>{formatTimestamp(msg.created_at)}</span>
                          {msg.direction === 'OUTBOUND' && !msg.error_message && (
                            <CheckCheck className="w-3 h-3" />
                          )}
                        </div>
                        {msg.error_message && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-100 bg-rose-900/20 rounded px-1.5 py-0.5">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{msg.error_message}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              <div className="p-3 border-t border-stone-100 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    placeholder="Type a reply..."
                    rows={2}
                    className="flex-1 resize-none px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-[#B08D57]"
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2.5 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                  >
                    {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send</span>
                  </button>
                </div>
                <p className="text-[10px] text-stone-400 mt-1.5">
                  Deliverable only within 24 hours of the customer's last message, per WhatsApp policy.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
