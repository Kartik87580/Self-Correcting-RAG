import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, LogOut, User, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import KnowledgeBase from './KnowledgeBase';
import api from '../services/api';

export default function Sidebar({ activeChatId, onSelectChat, onKbChange }) {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const fetchChats = async () => {
        try {
            const res = await api.get('/chats');
            setChats(res.data);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChats();
    }, []);

    const createChat = async () => {
        try {
            const res = await api.post('/chats', { title: 'New Chat' });
            setChats((prev) => [res.data, ...prev]);
            onSelectChat(res.data.id);
        } catch {
            // silent
        }
    };

    const deleteChat = async (e, chatId) => {
        e.stopPropagation();
        try {
            await api.delete(`/chats/${chatId}`);
            setChats((prev) => prev.filter((c) => c.id !== chatId));
            if (activeChatId === chatId) onSelectChat(null);
        } catch {
            // silent
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="w-64 shrink-0 h-full flex flex-col bg-surface/60 backdrop-blur-xl border-r border-subtle">
            {/* Knowledge Base */}
            <KnowledgeBase onKbChange={onKbChange} />

            {/* New Chat button */}
            <div className="px-4 py-3">
                <button
                    id="new-chat-btn"
                    onClick={createChat}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all"
                >
                    <Plus size={16} />
                    New Chat
                </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-2 space-y-1">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 size={20} className="animate-spin text-txt-muted" />
                    </div>
                ) : chats.length === 0 ? (
                    <p className="text-xs text-txt-muted text-center py-6 px-4">
                        No chats yet. Upload docs to your KB, then create a chat!
                    </p>
                ) : (
                    chats.map((chat) => (
                        <div
                            key={chat.id}
                            onClick={() => onSelectChat(chat.id)}
                            className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm ${activeChatId === chat.id
                                    ? 'bg-primary/15 text-txt border border-primary/30'
                                    : 'text-txt-sec hover:bg-card-hover hover:text-txt border border-transparent'
                                }`}
                        >
                            <MessageSquare size={14} className="shrink-0" />
                            <span className="flex-1 truncate">{chat.title}</span>
                            <button
                                onClick={(e) => deleteChat(e, chat.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-error/20 text-txt-muted hover:text-error transition-all"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* User section */}
            <div className="p-3 border-t border-subtle">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow">
                        {user?.name?.charAt(0)?.toUpperCase() || <User size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-txt truncate">{user?.name}</p>
                        <p className="text-[11px] text-txt-muted truncate">{user?.email}</p>
                    </div>
                    <button
                        id="logout-btn"
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg hover:bg-error/20 text-txt-muted hover:text-error transition-all"
                        title="Logout"
                    >
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
