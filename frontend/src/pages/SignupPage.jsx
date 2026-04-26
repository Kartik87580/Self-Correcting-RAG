import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function SignupPage() {
    const [name, setName] = useState('');
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
        if (!name || !email || !password) return setError('All fields are required');
        if (password.length < 6) return setError('Password must be at least 6 characters');

        setLoading(true);
        try {
            const res = await api.post('/auth/signup', { name, email, password });
            login(res.data.access_token, res.data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-base flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background glows */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/8 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Cpu size={20} className="text-white" />
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        CRAG Pipeline
                    </span>
                </div>

                {/* Card */}
                <div className="bg-card/80 backdrop-blur-xl border border-subtle rounded-2xl p-8 shadow-2xl shadow-black/30">
                    <h2 className="text-2xl font-bold text-txt mb-1">Create account</h2>
                    <p className="text-sm text-txt-sec mb-6">Get started with your free account</p>

                    {error && (
                        <div className="mb-4 px-4 py-2.5 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-txt-sec mb-1.5">Full Name</label>
                            <input
                                id="signup-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                className="w-full px-4 py-2.5 rounded-xl bg-surface border border-subtle text-txt text-sm placeholder:text-txt-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-txt-sec mb-1.5">Email</label>
                            <input
                                id="signup-email"
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
                                    id="signup-password"
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Minimum 6 characters"
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
                            id="signup-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-txt-sec">
                        Already have an account?{' '}
                        <Link to="/signin" className="text-primary hover:text-primary-hover font-medium transition-colors">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
