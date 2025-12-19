
import React, { useState } from 'react';
import { useApp } from '../store';
import { Button, Card } from '../components/UI';
import { Lock, User, ShieldCheck, AlertCircle, Loader2, Key, DatabaseZap } from 'lucide-react';

export const Login = () => {
    const { dispatch, syncFromCloud } = useApp();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showEmergency, setShowEmergency] = useState(false);

    // CODICE DI EMERGENZA (Sostituisci se desideri un codice diverso)
    const EMERGENCY_CODE = "2025"; 

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Se l'utente inserisce il codice di emergenza in password, entra direttamente (Failsafe)
        if (password === EMERGENCY_CODE) {
            localStorage.setItem('sm_token', 'emergency_access_token');
            dispatch({ type: 'LOGIN_SUCCESS' });
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            }).catch(err => {
                // Cattura l'errore di rete (Failed to fetch)
                throw new Error("NETWORK_ERROR");
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('sm_token', data.token);
                dispatch({ type: 'LOGIN_SUCCESS' });
                await syncFromCloud(true).catch(() => {});
            } else {
                setError(data.error || 'Credenziali non valide.');
            }
        } catch (err: any) {
            if (err.message === "NETWORK_ERROR") {
                setError('Errore di connessione al database Cloud.');
                setShowEmergency(true);
            } else {
                setError('Errore di sistema. Riprova più tardi.');
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
                <Card className="shadow-2xl border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4 border border-blue-500/30">
                            <ShieldCheck size={32} className="text-blue-500" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">ShiftMaster Pro</h1>
                        <p className="text-slate-400 text-sm mt-2">Protezione Accesso Personale</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex flex-col gap-2 text-red-400 text-sm animate-in shake duration-300">
                                <div className="flex items-center gap-3">
                                    <AlertCircle size={18} className="shrink-0" />
                                    <span>{error}</span>
                                </div>
                                {showEmergency && (
                                    <div className="mt-2 p-2 bg-slate-800 rounded border border-slate-700 text-[11px] text-slate-300">
                                        <p className="font-bold text-blue-400 mb-1">Accesso di Emergenza Attivo:</p>
                                        Inserisci il tuo Codice Master (2025) nel campo Password per forzare l'entrata locale.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Utente</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <User size={18} />
                                </div>
                                <input 
                                    type="text"
                                    required
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Password / PIN</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <Lock size={18} />
                                </div>
                                <input 
                                    type="password"
                                    required
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button 
                                type="submit" 
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                                disabled={loading}
                            >
                                {loading ? <Loader2 size={20} className="animate-spin" /> : "Accedi"}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                            <DatabaseZap size={12} /> Cloud Mode: {showEmergency ? 'Offline' : 'Online'}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
