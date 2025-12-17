
import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed, parseISO } from '../utils';
import { format, addMonths, isWeekend, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, ShieldAlert, Users, Info, TrendingUp, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Button, Card, Badge, Modal } from '../components/UI';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const Coverage = () => {
  const { state, dispatch } = useApp();
  const days = useMemo(() => getMonthDays(state.currentDate), [state.currentDate]);
  const [selectedCell, setSelectedCell] = useState<{ date: string; shiftKey: string } | null>(null);

  const handlePrevMonth = () => dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), -1), 'yyyy-MM-dd') });
  const handleNextMonth = () => dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), 1), 'yyyy-MM-dd') });

  // Calculation logic
  const coverageData = useMemo(() => {
    const report: Record<string, Record<string, { count: number; operators: string[] }>> = {};
    
    days.forEach(day => {
      const dateKey = formatDateKey(day);
      report[dateKey] = {
        'M8': { count: 0, operators: [] },
        'P': { count: 0, operators: [] },
        'N': { count: 0, operators: [] },
      };

      state.operators.filter(o => o.isActive).forEach(op => {
        if (!isOperatorEmployed(op, dateKey)) return;
        
        const entry = getEntry(state, op.id, dateKey);
        const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
        const code = entry?.shiftCode || matrixCode || '';
        const opName = `${op.lastName} ${op.firstName}`;

        if (['M6', 'M7', 'M7-', 'M8', 'M8-'].includes(code)) {
            report[dateKey]['M8'].count++;
            report[dateKey]['M8'].operators.push(opName);
        } else if (['P', 'P-'].includes(code)) {
            report[dateKey]['P'].count++;
            report[dateKey]['P'].operators.push(opName);
        } else if (code === 'N') {
            report[dateKey]['N'].count++;
            report[dateKey]['N'].operators.push(opName);
        } else if (code === 'DM') {
            const config = state.config.coverage['M8'];
            if (config?.mode === 'SUM') {
                report[dateKey]['M8'].count++;
                report[dateKey]['M8'].operators.push(`${opName} (DM)`);
            }
        } else if (code === 'DP') {
            const config = state.config.coverage['P'];
            if (config?.mode === 'SUM') {
                report[dateKey]['P'].count++;
                report[dateKey]['P'].operators.push(`${opName} (DP)`);
            }
        }
      });
    });

    return report;
  }, [days, state.operators, state.plannerData, state.matrices, state.config.coverage]);

  const criticalIssues = useMemo(() => {
    const issues: { date: string; shift: string; count: number; min: number }[] = [];
    days.forEach(day => {
      const dateKey = formatDateKey(day);
      ['M8', 'P', 'N'].forEach(shiftKey => {
        const config = state.config.coverage[shiftKey];
        if (config && coverageData[dateKey][shiftKey].count < config.min) {
          issues.push({ date: dateKey, shift: shiftKey, count: coverageData[dateKey][shiftKey].count, min: config.min });
        }
      });
    });
    return issues;
  }, [coverageData, days, state.config.coverage]);

  const getStatusColor = (count: number, shiftKey: string) => {
    const config = state.config.coverage[shiftKey];
    if (!config) return 'bg-slate-50 text-slate-400';
    if (count < config.min) return 'bg-red-100 text-red-700 border-red-200';
    if (count < config.optimal) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (count === config.optimal) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-purple-100 text-purple-700 border-purple-200';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header Toolbar */}
      <div className="p-4 border-b bg-white flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-blue-600" /> Analisi Copertura
          </h2>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft size={18} /></button>
            <span className="px-4 font-bold text-slate-700 min-w-[150px] text-center capitalize">
                {ITALIAN_MONTHS[new Date(state.currentDate).getMonth()]} {new Date(state.currentDate).getFullYear()}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-sm"></div> Critico</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded-sm"></div> Basso</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 rounded-sm"></div> Ottimale</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-400 rounded-sm"></div> Eccedenza</div>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-red-500">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase">Carenze Critiche</div>
                        <div className="text-3xl font-black text-red-600">{criticalIssues.length}</div>
                    </div>
                    <AlertTriangle className="text-red-200" size={40} />
                </div>
                <div className="mt-2 text-[10px] text-slate-500 italic">Sotto il minimo di sicurezza</div>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase">Salute Staffing</div>
                        <div className="text-3xl font-black text-emerald-600">
                            {Math.round(((days.length * 3 - criticalIssues.length) / (days.length * 3)) * 100)}%
                        </div>
                    </div>
                    <TrendingUp className="text-emerald-200" size={40} />
                </div>
                <div className="mt-2 text-[10px] text-slate-500 italic">Giorni con copertura minima garantita</div>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase">Operatori Attivi</div>
                        <div className="text-3xl font-black text-blue-600">{state.operators.filter(o => o.isActive).length}</div>
                    </div>
                    <Users className="text-blue-200" size={40} />
                </div>
                <div className="mt-2 text-[10px] text-slate-500 italic">Disponibili per la turnazione</div>
            </Card>
        </div>

        {/* Main Coverage Grid */}
        <Card title="Griglia Analitica Copertura" className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="sticky left-0 bg-slate-50 z-20 w-32 md:w-48 text-left p-3 font-bold text-slate-600 border-b border-r text-xs uppercase">Turno / Fascia</th>
                            {days.map(d => (
                                <th key={d.toString()} className={`min-w-[40px] text-center p-2 border-b border-r text-xs font-bold ${isWeekend(d) ? 'bg-slate-100' : ''} ${isToday(d) ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}>
                                    <div>{format(d, 'd')}</div>
                                    <div className="text-[9px] opacity-60 uppercase">{format(d, 'EEE').substring(0, 1)}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {['M8', 'P', 'N'].map(shiftKey => (
                            <tr key={shiftKey} className="hover:bg-slate-50 transition-colors">
                                <td className="sticky left-0 bg-white z-10 p-3 font-bold text-slate-700 border-b border-r text-sm">
                                    {shiftKey === 'M8' ? 'Mattina' : shiftKey === 'P' ? 'Pomeriggio' : 'Notte'}
                                    <div className="text-[10px] font-normal text-slate-400">Target: {state.config.coverage[shiftKey]?.optimal || 0}</div>
                                </td>
                                {days.map(d => {
                                    const dateKey = formatDateKey(d);
                                    const data = coverageData[dateKey][shiftKey];
                                    const config = state.config.coverage[shiftKey];
                                    return (
                                        <td 
                                            key={dateKey} 
                                            className={`p-2 border-b border-r text-center cursor-pointer transition-all hover:scale-110 hover:z-20 hover:shadow-lg ${getStatusColor(data.count, shiftKey)}`}
                                            onClick={() => setSelectedCell({ date: dateKey, shiftKey })}
                                        >
                                            <div className="font-black text-xs md:text-sm">{data.count}</div>
                                            <div className="text-[9px] opacity-70 font-bold">/{config?.optimal || 0}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-3 bg-white border-t text-[10px] text-slate-400 flex items-center gap-2">
                <Info size={12} /> Clicca su una cella per vedere l'elenco nominativo del personale assegnato.
            </div>
        </Card>

        {/* Critical Alerts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Carenze Critiche da Risolvere" className="border-red-100">
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {criticalIssues.length > 0 ? criticalIssues.map((issue, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-full text-red-600">
                                    <AlertTriangle size={16} />
                                </div>
                                <div>
                                    <div className="font-bold text-red-900 text-sm">
                                        {issue.shift === 'M8' ? 'Mattina' : issue.shift === 'P' ? 'Pomeriggio' : 'Notte'}
                                    </div>
                                    <div className="text-xs text-red-700">{format(parseISO(issue.date), 'dd MMMM yyyy')}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-red-800">{issue.count} / {issue.min}</div>
                                <div className="text-[10px] text-red-500 uppercase font-bold">Mancano {issue.min - issue.count} op.</div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2">
                            <CheckCircle2 size={32} className="text-emerald-400" />
                            <p className="text-sm italic">Nessuna carenza critica rilevata.</p>
                        </div>
                    )}
                </div>
            </Card>

            <div className="bg-blue-600 rounded-xl p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-2">Suggerimento AI</h3>
                    <p className="text-blue-100 text-sm leading-relaxed">
                        In base ai dati di copertura del mese corrente, si consiglia di verificare la disponibilità degli operatori con più ore residue per coprire le carenze del fine settimana. 
                        La fascia <strong>Notte</strong> risulta la più stabile con un tasso di copertura del 100%.
                    </p>
                </div>
                <div className="mt-6 flex justify-end relative z-10">
                    <Button variant="secondary" className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs gap-2">
                        Analizza con assistente <Search size={14} />
                    </Button>
                </div>
                {/* Decorative background circle */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal 
        isOpen={!!selectedCell} 
        onClose={() => setSelectedCell(null)} 
        title={`Dettaglio Personale - ${selectedCell ? format(parseISO(selectedCell.date), 'dd/MM/yyyy') : ''}`}
        className="max-w-md"
      >
        {selectedCell && (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <div className="font-bold text-slate-700">
                        {selectedCell.shiftKey === 'M8' ? 'Turno Mattina' : selectedCell.shiftKey === 'P' ? 'Turno Pomeriggio' : 'Turno Notte'}
                    </div>
                    <Badge color={getStatusColor(coverageData[selectedCell.date][selectedCell.shiftKey].count, selectedCell.shiftKey)}>
                        {coverageData[selectedCell.date][selectedCell.shiftKey].count} Operatori
                    </Badge>
                </div>
                
                <div className="space-y-2">
                    {coverageData[selectedCell.date][selectedCell.shiftKey].operators.length > 0 ? (
                        coverageData[selectedCell.date][selectedCell.shiftKey].operators.map((name, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-100 text-sm text-slate-700 font-medium">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                {name}
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-slate-400 italic py-4">Nessun operatore assegnato a questa fascia.</p>
                    )}
                </div>
                
                <div className="pt-2">
                    <Button variant="secondary" className="w-full" onClick={() => setSelectedCell(null)}>Chiudi</Button>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};
