
import React, { useState } from 'react';
import { useApp } from '../store';
import { Button, Input, Card } from '../components/UI';
import { Lock, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export const Login = () => {
    const { dispatch, syncFromCloud } = useApp();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    localStorage.setItem('sm_token', data.token);
                    // Persist username to keep context for DataManagement
                    localStorage.setItem('sm_username', data.user.username);
                    dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
                    await syncFromCloud(true).catch(() => {});
                    return;
                }
            }
            
            // Fallback per ambienti senza backend funzionante (es. anteprima statica)
            if ((response.status === 404 || response.status === 500) && username === 'admin' && password === 'admin') {
                console.warn("Backend non rilevato. Accesso demo abilitato.");
                localStorage.setItem('sm_token', 'local-demo-token');
                localStorage.setItem('sm_username', 'admin');
                dispatch({ type: 'LOGIN_SUCCESS', payload: { username: 'admin', role: 'admin' } });
                return;
            }

            const data = await response.json().catch(() => ({}));
            setError(data.error || 'Credenziali non valide. Riprova.');
        } catch (err) {
            // Se il fetch fallisce per errore di rete/CORS, permettiamo admin/admin localmente
            if (username === 'admin' && password === 'admin') {
                console.warn("Connessione API fallita. Accesso in modalità locale.");
                localStorage.setItem('sm_token', 'local-demo-token');
                localStorage.setItem('sm_username', 'admin');
                dispatch({ type: 'LOGIN_SUCCESS', payload: { username: 'admin', role: 'admin' } });
            } else {
                setError('Impossibile connettersi al server. Verifica la connessione.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md animate-in zoom-in-95 duration-300 relative z-10">
                <Card className="shadow-2xl border-slate-800 bg-slate-900/80 backdrop-blur-xl">
                    <div className="text-center mb-8 pt-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4 border border-blue-500/30">
                            <ShieldCheck size={32} className="text-blue-500" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">ShiftMaster Pro</h1>
                        <p className="text-slate-400 text-sm mt-2">Accedi per gestire la programmazione turni</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm animate-in shake duration-300">
                                <AlertCircle size={18} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Nome Utente</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <User size={18} />
                                </div>
                                <input 
                                    type="text"
                                    required
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                                    placeholder="Es. admin"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Password Sicura</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <Lock size={18} />
                                </div>
                                <input 
                                    type="password"
                                    required
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button 
                                type="submit" 
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span>Autenticazione in corso...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Accedi al Planner</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                            Powered by Neon Cloud Database &bull; Secured Access
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};
