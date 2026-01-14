
import React, { useState } from 'react';
import { useApp } from '../store';
import { Button, Input, Card } from '../components/UI';
import { Lock, User, ShieldCheck, AlertCircle, Loader2, KeyRound, ArrowLeft, CheckCircle, Search } from 'lucide-react';

export const Login = () => {
    const { dispatch, syncFromCloud } = useApp();
    const [mode, setMode] = useState<'LOGIN' | 'RECOVERY'>('LOGIN');
    const [recoveryTab, setRecoveryTab] = useState<'PASSWORD' | 'USERNAME'>('PASSWORD');
    
    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    // Reset State
    const [resetData, setResetData] = useState({ username: '', masterKey: '', newPassword: '' });
    const [foundUsernames, setFoundUsernames] = useState<string[]>([]);
    
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
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
                    localStorage.setItem('sm_username', data.user.username);
                    dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
                    await syncFromCloud(true).catch(() => {});
                    return;
                }
            }
            
            // Fallback locale
            if ((response.status === 404 || response.status === 500) && username === 'admin' && password === 'admin') {
                localStorage.setItem('sm_token', 'local-demo-token');
                localStorage.setItem('sm_username', 'admin');
                dispatch({ type: 'LOGIN_SUCCESS', payload: { username: 'admin', role: 'admin' } });
                return;
            }

            const data = await response.json().catch(() => ({}));
            setError(data.error || 'Credenziali non valide. Riprova.');
        } catch (err) {
            if (username === 'admin' && password === 'admin') {
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

    const handleRecoverUsername = async () => {
        setError('');
        setSuccessMsg('');
        setFoundUsernames([]);
        setLoading(true);

        if (!resetData.masterKey) {
            setError("Inserisci il Codice Master.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'recover_username', 
                    masterKey: resetData.masterKey
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setFoundUsernames(data.usernames);
                setSuccessMsg(`Trovati ${data.usernames.length} utenti.`);
            } else {
                setError(data.error || 'Errore durante il recupero. Verifica il Codice Master.');
            }
        } catch (err) {
            setError('Errore di connessione al server.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        if (!resetData.username || !resetData.masterKey || !resetData.newPassword) {
            setError("Tutti i campi sono obbligatori.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'reset_password', 
                    username: resetData.username, 
                    newPassword: resetData.newPassword,
                    masterKey: resetData.masterKey
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccessMsg('Password reimpostata con successo!');
                setTimeout(() => {
                    setMode('LOGIN');
                    setUsername(resetData.username);
                    setResetData({ username: '', masterKey: '', newPassword: '' });
                    setSuccessMsg('');
                    setError('');
                }, 2000);
            } else {
                setError(data.error || 'Errore durante il ripristino. Verifica il Codice Master.');
            }
        } catch (err) {
            setError('Errore di connessione al server.');
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
                    <div className="text-center mb-6 pt-4">
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 border transition-colors ${mode === 'RECOVERY' ? 'bg-amber-600/20 border-amber-500/30' : 'bg-blue-600/20 border-blue-500/30'}`}>
                            {mode === 'RECOVERY' ? <KeyRound size={32} className="text-amber-500" /> : <ShieldCheck size={32} className="text-blue-500" />}
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">ShiftMaster Pro</h1>
                        <p className="text-slate-400 text-sm mt-2">
                            {mode === 'RECOVERY' ? 'Recupero Accesso' : 'Accedi per gestire la programmazione turni'}
                        </p>
                    </div>

                    {mode === 'LOGIN' ? (
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
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Password</label>
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
                                <div className="text-right">
                                    <button 
                                        type="button" 
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                        onClick={() => { setMode('RECOVERY'); setError(''); setSuccessMsg(''); setFoundUsernames([]); }}
                                    >
                                        Credenziali dimenticate?
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button 
                                    type="submit" 
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 size={20} className="animate-spin" /> : <span>Accedi al Planner</span>}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        // RECOVERY MODE
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            
                            {/* Recovery Tabs */}
                            <div className="flex p-1 bg-slate-800/50 rounded-lg mb-4">
                                <button 
                                    type="button"
                                    onClick={() => { setRecoveryTab('PASSWORD'); setError(''); setSuccessMsg(''); }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${recoveryTab === 'PASSWORD' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Reset Password
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => { setRecoveryTab('USERNAME'); setError(''); setSuccessMsg(''); }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${recoveryTab === 'USERNAME' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Trova Username
                                </button>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
                                    <AlertCircle size={18} className="shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                            {successMsg && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3 text-green-400 text-sm">
                                    <CheckCircle size={18} className="shrink-0" />
                                    <span>{successMsg}</span>
                                </div>
                            )}

                            {recoveryTab === 'PASSWORD' ? (
                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Nome Utente</label>
                                        <input 
                                            type="text"
                                            required
                                            className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                            placeholder="Es. admin"
                                            value={resetData.username}
                                            onChange={(e) => setResetData({...resetData, username: e.target.value})}
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Codice Master</label>
                                        <input 
                                            type="password"
                                            required
                                            className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                            placeholder="Codice Cloud (APP_ACCESS_CODE)"
                                            value={resetData.masterKey}
                                            onChange={(e) => setResetData({...resetData, masterKey: e.target.value})}
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Nuova Password</label>
                                        <input 
                                            type="password"
                                            required
                                            className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                            placeholder="Nuova password sicura"
                                            value={resetData.newPassword}
                                            onChange={(e) => setResetData({...resetData, newPassword: e.target.value})}
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="pt-2 flex gap-3">
                                        <Button 
                                            type="button" 
                                            variant="secondary"
                                            className="px-4 bg-transparent border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                                            onClick={() => { setMode('LOGIN'); setError(''); setSuccessMsg(''); }}
                                            disabled={loading}
                                        >
                                            <ArrowLeft size={20} />
                                        </Button>
                                        <Button 
                                            type="submit" 
                                            className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
                                            disabled={loading}
                                        >
                                            {loading ? <Loader2 size={20} className="animate-spin" /> : <span>Reimposta Password</span>}
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-400">
                                        Inserisci il <strong>Codice Master</strong> per visualizzare l'elenco degli utenti registrati nel sistema.
                                    </p>
                                    
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Codice Master</label>
                                        <input 
                                            type="password"
                                            className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                                            placeholder="Codice Cloud (APP_ACCESS_CODE)"
                                            value={resetData.masterKey}
                                            onChange={(e) => setResetData({...resetData, masterKey: e.target.value})}
                                            disabled={loading}
                                        />
                                    </div>

                                    {foundUsernames.length > 0 && (
                                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 max-h-32 overflow-y-auto">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Utenti Trovati:</div>
                                            <div className="space-y-1">
                                                {foundUsernames.map(u => (
                                                    <div key={u} className="flex items-center justify-between text-sm text-white border-b border-slate-700/50 pb-1 last:border-0">
                                                        <span>{u}</span>
                                                        <button 
                                                            onClick={() => {
                                                                setResetData(prev => ({ ...prev, username: u }));
                                                                setRecoveryTab('PASSWORD');
                                                                setSuccessMsg(`Utente "${u}" selezionato per il reset.`);
                                                            }}
                                                            className="text-xs text-amber-500 hover:underline"
                                                        >
                                                            Reset Password
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 flex gap-3">
                                        <Button 
                                            type="button" 
                                            variant="secondary"
                                            className="px-4 bg-transparent border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                                            onClick={() => { setMode('LOGIN'); setError(''); setSuccessMsg(''); }}
                                            disabled={loading}
                                        >
                                            <ArrowLeft size={20} />
                                        </Button>
                                        <Button 
                                            type="button"
                                            onClick={handleRecoverUsername}
                                            className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
                                            disabled={loading}
                                        >
                                            {loading ? <Loader2 size={20} className="animate-spin" /> : <><Search size={18} /> <span>Trova Utenti</span></>}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
