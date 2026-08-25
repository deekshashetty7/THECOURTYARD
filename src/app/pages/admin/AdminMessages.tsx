import { useEffect, useMemo, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { Button } from '../../components/Button';
import { getAuthAccessToken } from '../../lib/authToken';

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: 'new' | 'replied';
  adminReply?: string | null;
  adminReplyBy?: string | null;
  adminReplyAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';
const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname.includes('localhost')
    ? '/api'
    : RAW_API_BASE_URL;

export const AdminMessages = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const loadMessages = async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to view messages.');
      }

      const response = await fetch(`${API_BASE_URL}/admin/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to load messages');
      }

      const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
      setMessages(nextMessages);
      setReplyDrafts((prev) => {
        const next: Record<string, string> = { ...prev };
        nextMessages.forEach((message: ContactMessage) => {
          if (!(message.id in next)) {
            next[message.id] = message.adminReply || '';
          }
        });
        return next;
      });
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load messages';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
  }, []);

  const newMessages = useMemo(() => messages.filter((msg) => msg.status === 'new'), [messages]);
  const repliedMessages = useMemo(() => messages.filter((msg) => msg.status === 'replied'), [messages]);

  const saveReply = async (messageId: string) => {
    const reply = (replyDrafts[messageId] || '').trim();
    if (!reply) {
      return;
    }

    setSavingMessageId(messageId);
    setError('');

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again to save reply.');
      }

      const response = await fetch(`${API_BASE_URL}/admin/messages/${messageId}/reply`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reply }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to save reply');
      }

      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? payload.message : msg)));
      setExpandedMessageId(null);
      window.dispatchEvent(new CustomEvent('tcy:settings-updated'));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save reply';
      setError(message);
    } finally {
      setSavingMessageId(null);
    }
  };

  return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Messages</h1>
          <p className="text-sm text-gray-500">Quick reply to inquiries</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          <GlassCard className="p-3">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-gray-900">{messages.length}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-xs text-gray-500">New</p>
            <p className="text-lg font-bold text-orange-600">{newMessages.length}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-xs text-gray-500">Replied</p>
            <p className="text-lg font-bold text-green-900">{repliedMessages.length}</p>
          </GlassCard>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No messages</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <GlassCard
                key={msg.id}
                className={`p-3 ${msg.status === 'new' ? 'bg-orange-50 border border-orange-100' : 'bg-green-50 border border-green-100'}`}
              >
                <button
                  onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                  className="w-full text-left hover:opacity-70 transition-opacity"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{msg.name}</h3>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            msg.status === 'new'
                              ? 'bg-orange-200 text-orange-700'
                              : 'bg-green-200 text-green-700'
                          }`}
                        >
                          {msg.status === 'new' ? 'New' : '✓'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{msg.email}</p>
                      <p className="text-xs font-semibold text-gray-800 mt-1 truncate">{msg.subject}</p>
                      <p className="text-xs text-gray-700 line-clamp-1 mt-0.5">{msg.message}</p>
                    </div>
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </button>

                {expandedMessageId === msg.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-xs mb-1">Message</h4>
                      <p className="text-gray-700 text-xs whitespace-pre-wrap">{msg.message}</p>
                      {msg.phone && <p className="text-xs text-gray-500 mt-1">📱 {msg.phone}</p>}
                    </div>

                    {msg.adminReply && (
                      <div className="bg-green-100 p-2 rounded text-xs border border-green-200">
                        <p className="font-semibold text-green-800 mb-1">✓ Your Reply</p>
                        <p className="text-green-800">{msg.adminReply}</p>
                        <p className="text-green-900 text-xs mt-1">by {msg.adminReplyBy}</p>
                      </div>
                    )}

                    {msg.status === 'new' || !msg.adminReply ? (
                      <div className="space-y-2">
                        <textarea
                          value={replyDrafts[msg.id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [msg.id]: e.target.value,
                            }))
                          }
                          placeholder="Type reply..."
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            onClick={() => setExpandedMessageId(null)}
                            className="px-3 py-1 text-xs bg-gray-200 text-gray-800 hover:bg-gray-300"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => void saveReply(msg.id)}
                            disabled={
                              !((replyDrafts[msg.id] || '').trim()) ||
                              savingMessageId === msg.id
                            }
                            className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingMessageId === msg.id ? (
                              'Saving...'
                            ) : (
                              <>
                                <Send className="w-3 h-3 inline mr-1" />
                                Reply
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
  );
};

