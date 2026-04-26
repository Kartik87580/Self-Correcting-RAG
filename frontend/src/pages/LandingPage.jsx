import { Link } from 'react-router-dom';
import { Cpu, Zap, Shield, Brain, ArrowRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen w-full bg-base overflow-auto">
            {/* ── Nav ─────────────────────────── */}
            <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20 object-cover"
                    />
                    <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        CRAG Pipeline
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to="/signin"
                        className="px-5 py-2 text-sm font-medium text-txt-sec hover:text-txt transition-colors rounded-lg"
                    >
                        Sign In
                    </Link>
                    <Link
                        to="/signup"
                        className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* ── Hero ────────────────────────── */}
            <section className="flex flex-col items-center text-center px-6 pt-20 pb-28 max-w-4xl mx-auto relative">
                {/* Glow */}
                <div className="absolute -top-20 w-[600px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-subtle text-xs text-txt-sec mb-6">
                    <Sparkles size={14} className="text-indigo-400" />
                    Corrective Retrieval-Augmented Generation
                </div>

                <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
                    <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Intelligent
                    </span>{' '}
                    Document Q&A
                    <br />
                    <span className="text-txt">with Self-Correction</span>
                </h1>

                <p className="mt-6 text-lg text-txt-sec max-w-2xl leading-relaxed">
                    Upload any document, ask questions, and get precise answers powered by a
                    self-correcting RAG pipeline. When retrieval falls short, the system
                    automatically rewrites queries and searches the web.
                </p>

                <div className="mt-10 flex gap-4">
                    <Link
                        to="/signup"
                        className="group px-8 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:shadow-xl hover:shadow-indigo-500/30 transition-all hover:-translate-y-1 flex items-center gap-2"
                    >
                        Start for Free
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                        to="/signin"
                        className="px-8 py-3.5 text-sm font-semibold text-txt-sec bg-card border border-subtle rounded-xl hover:bg-card-hover hover:border-primary/40 transition-all"
                    >
                        Sign In
                    </Link>
                </div>
            </section>

            {/* ── Features ────────────────────── */}
            <section className="px-6 pb-24 max-w-5xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            icon: <Brain size={22} />,
                            title: 'Self-Correcting',
                            desc: 'Automatically evaluates retrieved chunks and falls back to web search when confidence is low.',
                            color: 'from-indigo-500 to-blue-500',
                        },
                        {
                            icon: <Shield size={22} />,
                            title: 'Per-User Isolation',
                            desc: 'Every user gets private, sandboxed chats. Your data is never shared with others.',
                            color: 'from-purple-500 to-pink-500',
                        },
                        {
                            icon: <Zap size={22} />,
                            title: 'Multi-Format Ingest',
                            desc: 'Upload PDFs, text files, paste URLs, or YouTube videos — everything gets chunked and indexed.',
                            color: 'from-amber-500 to-orange-500',
                        },
                    ].map((f) => (
                        <div
                            key={f.title}
                            className="group p-6 rounded-2xl bg-card border border-subtle hover:border-primary/40 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10"
                        >
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 shadow-lg`}>
                                {f.icon}
                            </div>
                            <h3 className="text-base font-semibold text-txt mb-2">{f.title}</h3>
                            <p className="text-sm text-txt-sec leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Footer ──────────────────────── */}
            <footer className="border-t border-subtle py-6 text-center text-xs text-txt-muted">
                © 2026 CRAG Pipeline — Built with LangGraph, Groq & Qdrant
            </footer>
        </div>
    );
}
