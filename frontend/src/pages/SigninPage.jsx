import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function SigninPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password) return setError('All fields are required');

        setLoading(true);
        try {
            const res = await api.post('/auth/signin', { email, password });
            login(res.data.access_token, res.data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-base flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background glows */}
            <div className="absolute top-1/3 right-1/3 w-[500px] h-[500px] bg-purple-500/8 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/3 left-1/3 w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="w-11 h-11 rounded-xl shadow-lg shadow-indigo-500/20 object-cover"
                    />
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        CRAG Pipeline
                    </span>
                </div>

                {/* Card */}
                <div className="bg-card/80 backdrop-blur-xl border border-subtle rounded-2xl p-8 shadow-2xl shadow-black/30">
                    <h2 className="text-2xl font-bold text-txt mb-1">Welcome back</h2>
                    <p className="text-sm text-txt-sec mb-6">Sign in to continue</p>

                    {error && (
                        <div className="mb-4 px-4 py-2.5 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-txt-sec mb-1.5">Email</label>
                            <input
                                id="signin-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-4 py-2.5 rounded-xl bg-surface border border-subtle text-txt text-sm placeholder:text-txt-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-txt-sec mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    id="signin-password"
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-subtle text-txt text-sm placeholder:text-txt-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all pr-11"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt transition-colors"
                                >
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            id="signin-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-txt-sec">
                        Don&apos;t have an account?{' '}
                        <Link to="/signup" className="text-primary hover:text-primary-hover font-medium transition-colors">
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
