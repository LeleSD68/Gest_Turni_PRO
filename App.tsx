
import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { Planner } from './views/Planner';
import { Settings } from './views/Settings';
import { Dashboard } from './views/Dashboard';
import { Assignments } from './views/Assignments';
import { Coverage } from './views/Coverage';
import { DataManagement } from './views/DataManagement';
import { Help } from './views/Help';
import { Login } from './views/Login';
import { Calendar, Settings as SettingsIcon, BarChart2, Menu, Briefcase, Database, ShieldCheck, LogOut, User, HelpCircle } from 'lucide-react';

const MainLayout = () => {
  const { dispatch, state, syncFromCloud } = useApp();
  const [view, setView] = useState<'PLANNER' | 'DASHBOARD' | 'SETTINGS' | 'ASSIGNMENTS' | 'DATA' | 'COVERAGE' | 'HELP'>('PLANNER');
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

  // Se non autenticato, mostra il Login
  if (!state.isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-slate-100 animate-in fade-in duration-500">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white transition-all duration-300 flex flex-col no-print shadow-2xl z-50`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setSidebarOpen(!sidebarOpen)}>
           {sidebarOpen ? <span className="font-bold text-lg tracking-wider">SHIFTMASTER</span> : <span className="font-bold">SM</span>}
        </div>
        
        <nav className="flex-1 py-6 space-y-2">
           <NavItem icon={<Calendar />} label="Planner" active={view === 'PLANNER'} expanded={sidebarOpen} onClick={() => setView('PLANNER')} />
           <NavItem icon={<ShieldCheck />} label="Copertura" active={view === 'COVERAGE'} expanded={sidebarOpen} onClick={() => setView('COVERAGE')} />
           <NavItem icon={<Briefcase />} label="Incarichi" active={view === 'ASSIGNMENTS'} expanded={sidebarOpen} onClick={() => setView('ASSIGNMENTS')} />
           <NavItem icon={<BarChart2 />} label="Analisi & Log" active={view === 'DASHBOARD'} expanded={sidebarOpen} onClick={() => setView('DASHBOARD')} />
           <NavItem icon={<Database />} label="Gestione Dati" active={view === 'DATA'} expanded={sidebarOpen} onClick={() => setView('DATA')} />
           <div className="my-4 border-t border-slate-800 mx-2"></div>
           <NavItem icon={<SettingsIcon />} label="Configurazione" active={view === 'SETTINGS'} expanded={sidebarOpen} onClick={() => setView('SETTINGS')} />
           <NavItem icon={<HelpCircle />} label="Aiuto & Guida" active={view === 'HELP'} expanded={sidebarOpen} onClick={() => setView('HELP')} />
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          {sidebarOpen && (
              <button 
                onClick={() => dispatch({ type: 'LOGOUT' })}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
              >
                  <LogOut size={14} /> <span>Esci dal sistema</span>
              </button>
          )}
          <div className="text-xs text-slate-500 text-center flex flex-col gap-1 overflow-hidden">
              <span className="font-mono text-slate-400">v2.5.{state.dataRevision || 0}</span>
              {state.logs.length > 0 && sidebarOpen && (
                  <span className="text-[10px] text-slate-600 truncate max-w-full italic mt-1 px-1" title={state.logs[0].reason}>
                      {state.logs[0].reason || 'Modifica'}
                  </span>
              )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between lg:hidden no-print">
            <div className="font-bold text-slate-800 flex items-center gap-2"><div className="w-2 h-2 bg-blue-600 rounded-full"></div> ShiftMaster Pro</div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><Menu /></button>
         </header>
         <main className="flex-1 overflow-hidden relative">
            {view === 'PLANNER' && <Planner />}
            {view === 'COVERAGE' && <Coverage />}
            {view === 'ASSIGNMENTS' && <Assignments />}
            {view === 'DASHBOARD' && <Dashboard />}
            {view === 'DATA' && <DataManagement />}
            {view === 'SETTINGS' && <Settings />}
            {view === 'HELP' && <Help />}
         </main>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, expanded, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center px-4 py-3 transition-all relative group ${active ? 'bg-blue-600/10 border-l-4 border-blue-500 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
  >
    <div className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>{icon}</div>
    {expanded && <span className="ml-3 text-sm font-medium">{label}</span>}
    {!expanded && active && <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">{label}</div>}
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
