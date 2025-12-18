
import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { Planner } from './views/Planner';
import { Settings } from './views/Settings';
import { Dashboard } from './views/Dashboard';
import { Assignments } from './views/Assignments';
import { Coverage } from './views/Coverage';
import { DataManagement } from './views/DataManagement';
import { Calendar, Settings as SettingsIcon, BarChart2, Menu, Briefcase, Database, ShieldCheck } from 'lucide-react';

const MainLayout = () => {
  const { dispatch, state } = useApp();
  const [view, setView] = useState<'PLANNER' | 'DASHBOARD' | 'SETTINGS' | 'ASSIGNMENTS' | 'DATA' | 'COVERAGE'>('PLANNER');
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

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white transition-all duration-300 flex flex-col no-print`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-800 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
           {sidebarOpen ? <span className="font-bold text-lg tracking-wider">SHIFTMASTER</span> : <span className="font-bold">SM</span>}
        </div>
        
        <nav className="flex-1 py-6 space-y-2">
           <NavItem icon={<Calendar />} label="Planner" active={view === 'PLANNER'} expanded={sidebarOpen} onClick={() => setView('PLANNER')} />
           <NavItem icon={<ShieldCheck />} label="Copertura" active={view === 'COVERAGE'} expanded={sidebarOpen} onClick={() => setView('COVERAGE')} />
           <NavItem icon={<Briefcase />} label="Incarichi" active={view === 'ASSIGNMENTS'} expanded={sidebarOpen} onClick={() => setView('ASSIGNMENTS')} />
           <NavItem icon={<BarChart2 />} label="Analisi & Log" active={view === 'DASHBOARD'} expanded={sidebarOpen} onClick={() => setView('DASHBOARD')} />
           <NavItem icon={<Database />} label="Gestione Dati" active={view === 'DATA'} expanded={sidebarOpen} onClick={() => setView('DATA')} />
           <NavItem icon={<SettingsIcon />} label="Configurazione" active={view === 'SETTINGS'} expanded={sidebarOpen} onClick={() => setView('SETTINGS')} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 text-center flex flex-col gap-1 overflow-hidden">
              <span className="font-mono text-slate-400">v2.2.{state.dataRevision || 0}</span>
              {state.logs.length > 0 && sidebarOpen && (
                  <span className="text-[10px] text-slate-600 truncate max-w-full italic mt-1 px-1" title={state.logs[0].reason}>
                      {state.logs[0].reason || 'Modifica'}
                  </span>
              )}
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
            {view === 'COVERAGE' && <Coverage />}
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
