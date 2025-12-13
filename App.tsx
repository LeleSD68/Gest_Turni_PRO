import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { Planner } from './views/Planner';
import { Settings } from './views/Settings';
import { Dashboard } from './views/Dashboard';
import { Assignments } from './views/Assignments';
import { DataManagement } from './views/DataManagement';
import { Calendar, Settings as SettingsIcon, BarChart2, Menu, Briefcase, Database, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Input, Card } from './components/UI';

const LoginScreen = () => {
    const { checkAuth, syncStatus } = useApp();
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        const success = await checkAuth(code);
        if (!success) {
            setError('Codice di accesso non valido. Riprova.');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Lock size={32} className="text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">ShiftMaster Pro</h1>
                    <p className="text-slate-500 text-sm">Area Riservata</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Codice di Accesso</label>
                        <input 
                            type="password" 
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Inserisci il tuo codice univoco"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200 text-center animate-pulse">
                            {error}
                        </div>
                    )}
                    
                    <button 
                        type="submit" 
                        disabled={isLoading || !code}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <>Accedi <ArrowRight size={20} /></>}
                    </button>
                </form>
                
                <div className="mt-6 text-center text-xs text-slate-400">
                    Il codice deve essere configurato nelle impostazioni di Netlify<br/>
                    (Variabile: <code>APP_ACCESS_CODE</code>)
                </div>
            </div>
        </div>
    );
};

const MainLayout = () => {
  const { dispatch, state, syncStatus } = useApp();
  const [view, setView] = useState<'PLANNER' | 'DASHBOARD' | 'SETTINGS' | 'ASSIGNMENTS' | 'DATA'>('PLANNER');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // Show Login Screen if not authenticated
  if (!state.isAuthenticated) {
      return <LoginScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white transition-all duration-300 flex flex-col no-print`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-800 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
           {sidebarOpen ? <span className="font-bold text-lg tracking-wider">SHIFTMASTER</span> : <span className="font-bold">SM</span>}
        </div>
        
        <nav className="flex-1 py-6 space-y-2">
           <NavItem icon={<Calendar />} label="Planner" active={view === 'PLANNER'} expanded={sidebarOpen} onClick={() => setView('PLANNER')} />
           <NavItem icon={<Briefcase />} label="Incarichi" active={view === 'ASSIGNMENTS'} expanded={sidebarOpen} onClick={() => setView('ASSIGNMENTS')} />
           <NavItem icon={<BarChart2 />} label="Analisi & Log" active={view === 'DASHBOARD'} expanded={sidebarOpen} onClick={() => setView('DASHBOARD')} />
           <NavItem icon={<Database />} label="Gestione Dati" active={view === 'DATA'} expanded={sidebarOpen} onClick={() => setView('DATA')} />
           <NavItem icon={<SettingsIcon />} label="Configurazione" active={view === 'SETTINGS'} expanded={sidebarOpen} onClick={() => setView('SETTINGS')} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 text-center flex flex-col gap-1">
              <span>v1.5.0</span>
              <button onClick={() => dispatch({type: 'LOGOUT'})} className="text-red-400 hover:text-red-300 hover:underline">Esci</button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between lg:hidden no-print">
            <div className="font-bold text-slate-800">ShiftMaster Pro</div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}><Menu /></button>
         </header>
         <main className="flex-1 overflow-hidden relative">
            {view === 'PLANNER' && <Planner />}
            {view === 'ASSIGNMENTS' && <Assignments />}
            {view === 'DASHBOARD' && <Dashboard />}
            {view === 'DATA' && <DataManagement />}
            {view === 'SETTINGS' && <Settings />}
         </main>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, expanded, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center px-4 py-3 transition-colors ${active ? 'bg-primary border-l-4 border-accent text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
  >
    {icon}
    {expanded && <span className="ml-3 text-sm font-medium">{label}</span>}
  </button>
);

const App = () => {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
};

export default App;
