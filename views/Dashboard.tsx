import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Card, Badge } from '../components/UI';
import { format, addDays, isSameMonth } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { PlannerEntry } from '../types';
import { formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed } from '../utils';
import { CheckCircle2, AlertCircle, FileText, Clock, Calendar, AlertTriangle, ListTodo } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const Dashboard = () => {
    const { state } = useApp();
    const [tab, setTab] = useState<'LOGS' | 'STATS' | 'CALLS'>('STATS');

    // Simple Stats Calculation
    const totalShifts = Object.values(state.plannerData).length;
    const shiftDistribution = useMemo(() => {
        return state.shiftTypes.map(s => {
            const count = (Object.values(state.plannerData) as PlannerEntry[]).filter(e => e.shiftCode === s.code).length;
            return { name: s.code, value: count };
        }).filter(d => d.value > 0);
    }, [state.plannerData, state.shiftTypes]);

    // To-Do List Logic
    const todoItems = useMemo(() => {
        const items = [];
        const today = new Date();

        try {
            // 1. Check Critical Coverage for next 7 days
            for (let i = 0; i < 7; i++) {
                const d = addDays(today, i);
                const dateKey = formatDateKey(d);
                
                const configM = state.config?.coverage?.['M8'];

                if (configM) {
                    let countM = 0;
                    let countSupport = 0;

                    state.operators.filter(o => o.isActive).forEach(op => {
                         if (!isOperatorEmployed(op, dateKey)) return;
                         const entry = getEntry(state, op.id, dateKey);
                         const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
                         const code = entry?.shiftCode || matrixCode || '';
                         
                         // Standard M counts
                         if (['M6','M7','M7-','M8','M8-'].includes(code)) countM++;
                         // Support counts
                         if (code === 'DM') countSupport++;
                    });

                    // Determine effective count based on mode
                    const mode = configM.mode || 'VISUAL';
                    let effectiveCount = countM;
                    if (mode === 'SUM') effectiveCount = countM + countSupport;

                    if (effectiveCount < configM.min) {
                        items.push({
                            id: `cov-${dateKey}`,
                            type: 'ALERT',
                            title: `Copertura Critica: Mattina`,
                            subtitle: format(d, 'dd/MM/yyyy'),
                            priority: 'HIGH'
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Error calculating coverage todo", e);
        }

        // 2. Pending Calls check
        const pendingCalls = state.calls ? state.calls.filter(c => c.status === 'PENDING').length : 0;
        if (pendingCalls > 0) {
            items.push({
                id: 'calls',
                type: 'ACTION',
                title: 'Richieste Sostituzione',
                subtitle: `${pendingCalls} in attesa di approvazione`,
                priority: 'MEDIUM'
            });
        }

        // 3. Static Admin Tasks (Mock) to ensure visibility for demo
        items.push({
            id: 'task-1',
            type: 'DOC',
            title: 'Chiusura Cartellini Mese',
            subtitle: 'Scadenza tra 3 giorni',
            priority: 'MEDIUM'
        });
        
        items.push({
            id: 'task-2',
            type: 'DOC',
            title: 'Revisione Piano Ferie',
            subtitle: 'In attesa di pubblicazione',
            priority: 'LOW'
        });

        return items.slice(0, 5); // Max 5 items
    }, [state]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
             <div className="flex border-b bg-white px-6 shadow-sm z-10">
                <button onClick={() => setTab('STATS')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'STATS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    Panoramica
                </button>
                <button onClick={() => setTab('LOGS')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'LOGS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    Registro Log
                </button>
                <button onClick={() => setTab('CALLS')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'CALLS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    Chiamate
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {tab === 'STATS' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                        {/* Left Column */}
                        <div className="space-y-6">
                             <Card title="Riepilogo Attività">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="p-2 rounded bg-blue-50 border border-blue-100">
                                        <div className="text-2xl font-bold text-blue-700">{totalShifts}</div>
                                        <div className="text-xs text-blue-600 uppercase font-bold">Turni Assegnati</div>
                                    </div>
                                    <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                                        <div className="text-2xl font-bold text-emerald-700">{state.operators.filter(o => o.isActive).length}</div>
                                        <div className="text-xs text-emerald-600 uppercase font-bold">Operatori Attivi</div>
                                    </div>
                                    <div className="p-2 rounded bg-amber-50 border border-amber-100">
                                        <div className="text-2xl font-bold text-amber-700">{todoItems.length}</div>
                                        <div className="text-xs text-amber-600 uppercase font-bold">Avvisi / Task</div>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Distribuzione Tipologia Turni">
                                <div className="h-64 w-full">
                                    {shiftDistribution.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={shiftDistribution} 
                                                    cx="50%" cy="50%" 
                                                    innerRadius={60}
                                                    outerRadius={80} 
                                                    fill="#8884d8" 
                                                    dataKey="value" 
                                                    paddingAngle={2}
                                                    label={({name, value}) => `${name} (${value})`}
                                                >
                                                    {shiftDistribution.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={state.shiftTypes.find(s => s.code === entry.name)?.color || COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nessun turno assegnato</div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            <Card title="Da Fare / Promemoria" className="border-l-4 border-l-indigo-500 shadow-md">
                                <div className="space-y-0 divide-y divide-slate-100">
                                    {todoItems.length > 0 ? todoItems.map((item, idx) => (
                                        <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors">
                                            <div className={`mt-0.5 p-2 rounded-full shrink-0 shadow-sm
                                                ${item.type === 'ALERT' ? 'bg-red-100 text-red-600' : 
                                                  item.type === 'ACTION' ? 'bg-amber-100 text-amber-600' : 
                                                  'bg-indigo-100 text-indigo-600'}`}>
                                                {item.type === 'ALERT' && <AlertTriangle size={16} />}
                                                {item.type === 'ACTION' && <Clock size={16} />}
                                                {item.type === 'DOC' && <ListTodo size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <span className={`text-sm font-bold truncate ${item.type === 'ALERT' ? 'text-red-700' : 'text-slate-700'}`}>
                                                        {item.title}
                                                    </span>
                                                    {item.priority === 'HIGH' && <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse"></span>}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    {item.type === 'ALERT' && <Calendar size={10} />}
                                                    {item.subtitle}
                                                </div>
                                            </div>
                                            <button className="text-slate-300 hover:text-emerald-500 transition-colors self-center p-1" title="Segna come fatto">
                                                <CheckCircle2 size={18} />
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 text-slate-400 italic text-sm flex flex-col items-center gap-2">
                                            <CheckCircle2 size={32} className="text-emerald-200" />
                                            <span>Nessuna attività in sospeso. Ottimo lavoro!</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 bg-slate-50 border-t text-[10px] text-center text-slate-400 uppercase tracking-wider font-medium">
                                    Aggiornato in tempo reale
                                </div>
                            </Card>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-2"><FileText size={16}/> Note di Versione</h4>
                                <p className="text-xs leading-relaxed opacity-80">
                                    Il sistema di notifiche analizza automaticamente la copertura dei turni per i prossimi 7 giorni e segnala eventuali carenze rispetto ai minimi configurati nelle impostazioni.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'LOGS' && (
                    <Card className="overflow-hidden shadow-md">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-3">Ora</th>
                                    <th className="p-3">Operatore</th>
                                    <th className="p-3">Azione</th>
                                    <th className="p-3">Dettagli</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {state.logs.length > 0 ? state.logs.map(log => {
                                    const opName = state.operators.find(o => o.id === log.operatorId)?.lastName || log.operatorId;
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-slate-500 whitespace-nowrap">
                                                {(() => {
                                                    const d = new Date(log.timestamp);
                                                    return isNaN(d.getTime()) ? '-' : format(d, 'dd/MM HH:mm');
                                                })()}
                                            </td>
                                            <td className="p-3 font-medium text-slate-700">{opName}</td>
                                            <td className="p-3">
                                                <Badge color="bg-blue-100 text-blue-800">{log.actionType}</Badge>
                                            </td>
                                            <td className="p-3 text-slate-600 text-xs md:text-sm">{log.reason || `${log.oldValue || '-'} -> ${log.newValue || '-'}`}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 italic">Nessun log registrato.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </Card>
                )}
                
                 {tab === 'CALLS' && (
                    <Card title="Sistema Chiamate Sostituzione">
                        <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-3">
                            <Clock size={40} className="text-slate-200" />
                            <p>Nessuna chiamata attiva al momento.</p>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};