import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Modal, Input, Button, Select, Badge, Card } from './UI';
import { Operator, PlannerEntry } from '../types';
import { getEntry, calculateMatrixShift, formatDateKey, parseISO, isOperatorEmployed } from '../utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { UserCog, BarChart3, CalendarClock, Save, History, Calculator, Plus, Trash2, CalendarRange, ArrowRight, AlertTriangle, FileText, ChevronLeft, ChevronRight, Grid } from 'lucide-react';
import { format, eachDayOfInterval, isWeekend, isSunday, isSameMonth, addDays, getYear } from 'date-fns';

interface OperatorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  operatorId: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const OperatorDetailModal: React.FC<OperatorDetailModalProps> = ({ isOpen, onClose, operatorId }) => {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'STATS' | 'PROFILE' | 'MATRIX' | 'HISTORY_DETAILED'>('STATS');
  
  // Local state for editing
  const op = state.operators.find(o => o.id === operatorId);
  const [editForm, setEditForm] = useState<Partial<Operator>>({});
  
  // State for adding new matrix assignment
  const [newMatrixId, setNewMatrixId] = useState('');
  const [newMatrixStart, setNewMatrixStart] = useState('');

  // State for History Year View
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Initialize edit form when opening
  React.useEffect(() => {
    if (op) {
        setEditForm({ ...op });
    }
  }, [op, isOpen]);

  if (!isOpen || !op) return null;

  // --- Statistics Calculation (General) ---
  const stats = useMemo(() => {
      const currentYear = new Date().getFullYear();
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      const days = eachDayOfInterval({ start, end });
      
      let totalHours = 0;
      let totalNights = 0;
      let totalWeekends = 0;
      let totalSundays = 0;
      const shiftCounts: Record<string, number> = {};
      const monthlyHours: { name: string, hours: number }[] = Array.from({ length: 12 }, (_, i) => ({
          name: format(new Date(currentYear, i, 1), 'MMM'),
          hours: 0
      }));

      days.forEach(day => {
          const dateKey = formatDateKey(day);
          
          if (!isOperatorEmployed(op, dateKey)) return;

          const entry = getEntry(state, operatorId, dateKey);
          let code = entry?.shiftCode;
          let hours = entry?.customHours;
          
          if (!code) {
              const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
              if (matrixCode) {
                  code = matrixCode;
              }
          }

          if (code) {
              const shiftType = state.shiftTypes.find(s => s.code === code);
              if (shiftType && shiftType.hours > 0) {
                 shiftCounts[code] = (shiftCounts[code] || 0) + 1;
                 
                 if (hours === undefined) {
                     if (shiftType.inheritsHours) {
                         const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
                         const matrixShift = state.shiftTypes.find(s => s.code === matrixCode);
                         hours = matrixShift?.hours ?? 0;
                     } else {
                         hours = shiftType.hours;
                     }
                 }
                 
                 const effectiveHours = hours;
                 totalHours += effectiveHours;
                 monthlyHours[day.getMonth()].hours += effectiveHours;

                 if (shiftType.isNight) totalNights++;
                 if (isWeekend(day)) totalWeekends++;
                 if (isSunday(day)) totalSundays++;
              }
          }
      });

      const pieData = Object.entries(shiftCounts).map(([name, value]) => ({ name, value }));

      return { totalHours, totalNights, totalWeekends, totalSundays, pieData, monthlyHours };
  }, [state, operatorId, op]);

  // --- Detailed Monthly History Calculation ---
  const detailedHistory = useMemo(() => {
      const start = new Date(selectedYear, 0, 1);
      const end = new Date(selectedYear, 11, 31);
      const days = eachDayOfInterval({ start, end });

      const monthlyData: Record<number, {
          monthIndex: number,
          monthName: string,
          workedHours: number, // Base shift hours
          items: Record<string, number>, // Aggregated counts for breakdown (e.g. "Straordinario": 5h, "104": 8h)
          notes: string[] // List of unique notes
      }> = {};

      // Initialize
      for(let i=0; i<12; i++) {
          monthlyData[i] = { monthIndex: i, monthName: ITALIAN_MONTHS[i], workedHours: 0, items: {}, notes: [] };
      }

      days.forEach(day => {
          const dateKey = formatDateKey(day);
          const mIndex = day.getMonth();
          
          if (!isOperatorEmployed(op, dateKey)) return;

          const entry = getEntry(state, operatorId, dateKey);
          
          // 1. Determine Main Shift
          let code = entry?.shiftCode;
          let mainHours = entry?.customHours;
          let matrixCode = calculateMatrixShift(op, dateKey, state.matrices);

          if (!code && matrixCode) {
              code = matrixCode;
          }

          const shiftType = state.shiftTypes.find(s => s.code === code);

          // Resolve Hours logic
          if (shiftType) {
              if (mainHours === undefined) {
                  if (shiftType.inheritsHours) {
                      const ms = state.shiftTypes.find(s => s.code === matrixCode);
                      mainHours = ms?.hours ?? 0;
                  } else {
                      mainHours = shiftType.hours;
                  }
              }
              
              // Add to Worked Hours if it's a working shift
              if (shiftType.hours > 0) {
                  monthlyData[mIndex].workedHours += mainHours;
              } else {
                  // It's an absence code (Ferie, 104, Malattia defined as Shift)
                  // If it inherits hours (like Ferie often do for payroll), add to items
                  // If it has 0 hours but is a code like '104', track it as 1 day or inherited hours
                  
                  // Convention: If hours are 0 but inherits, we treat the inherited amount as the 'value' of the absence
                  let value = 0;
                  if (shiftType.inheritsHours) {
                       const ms = state.shiftTypes.find(s => s.code === matrixCode);
                       value = ms?.hours ?? 0;
                  } else {
                      // Fallback generic day value if needed, or 0
                      value = 0; 
                  }
                  
                  if (code !== 'R' && code !== 'OFF' && code !== '') {
                      const label = shiftType.name;
                      monthlyData[mIndex].items[label] = (monthlyData[mIndex].items[label] || 0) + (value > 0 ? value : 1); // Track hours if possible, else count occurrences? 
                      // Let's standarize on Hours for graph/table if > 0, else append 'gg' in UI
                  }
              }
          }

          // 2. Process Special Events (Extras, Straordinari, etc.)
          if (entry?.specialEvents) {
              entry.specialEvents.forEach(ev => {
                  const type = ev.type || 'Extra';
                  monthlyData[mIndex].items[type] = (monthlyData[mIndex].items[type] || 0) + ev.hours;
              });
          }

          // 3. Collect Notes
          if (entry?.note) {
              const dayPrefix = format(day, 'dd/MM');
              monthlyData[mIndex].notes.push(`[${dayPrefix}] ${entry.note}`);
          }
      });

      return Object.values(monthlyData);
  }, [state, operatorId, op, selectedYear]);


  // --- Handlers ---
  const handleSave = () => {
      if (!editForm.id) return;
      dispatch({ type: 'UPDATE_OPERATOR', payload: editForm as Operator });
      dispatch({
          type: 'ADD_LOG',
          payload: {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              operatorId: op.id,
              actionType: 'UPDATE',
              reason: 'Aggiornamento scheda anagrafica',
              user: 'User'
          }
      });
      alert('Dati salvati con successo');
  };

  const addContract = () => {
      const newContract = { id: crypto.randomUUID(), start: '2025-01-01' };
      setEditForm(prev => ({ ...prev, contracts: [...(prev.contracts || []), newContract] }));
  };

  const updateContract = (id: string, field: 'start' | 'end', value: string) => {
      setEditForm(prev => ({
          ...prev,
          contracts: prev.contracts?.map(c => c.id === id ? { ...c, [field]: value } : c)
      }));
  };

  const removeContract = (id: string) => {
      setEditForm(prev => ({
          ...prev,
          contracts: prev.contracts?.filter(c => c.id !== id)
      }));
  };

  const updateMatrixHistory = (id: string, field: 'startDate' | 'endDate', value: string) => {
    setEditForm(prev => ({
        ...prev,
        matrixHistory: prev.matrixHistory?.map(h => 
            h.id === id ? { ...h, [field]: value || undefined } : h
        )
    }));
  };

  const handleAddNewMatrix = () => {
      if (!newMatrixId || !newMatrixStart) {
          alert("Seleziona una matrice e una data di inizio.");
          return;
      }

      const currentHistory = editForm.matrixHistory || [];
      const newHistory = [...currentHistory];
      newHistory.sort((a, b) => a.startDate.localeCompare(b.startDate));
      const newDateObj = parseISO(newMatrixStart);
      
      for (let i = 0; i < newHistory.length; i++) {
          const assign = newHistory[i];
          const assignStart = parseISO(assign.startDate);
          if (assignStart < newDateObj) {
               if (!assign.endDate || parseISO(assign.endDate) >= newDateObj) {
                   const dayBefore = addDays(newDateObj, -1);
                   newHistory[i] = { ...assign, endDate: formatDateKey(dayBefore) };
               }
          }
      }

      const filteredHistory = newHistory.filter(a => a.startDate < newMatrixStart);
      filteredHistory.push({
          id: crypto.randomUUID(),
          matrixId: newMatrixId,
          startDate: newMatrixStart,
          endDate: undefined
      });

      setEditForm({ 
          ...editForm, 
          matrixHistory: filteredHistory,
          matrixId: newMatrixId, 
          matrixStartDate: newMatrixStart
      });

      setNewMatrixId('');
      setNewMatrixStart('');
  };

  const handleRemoveMatrixAssignment = (assignmentId: string) => {
      if(!confirm("Sei sicuro di voler rimuovere questo periodo dallo storico?")) return;
      setEditForm(prev => ({
          ...prev,
          matrixHistory: prev.matrixHistory?.filter(h => h.id !== assignmentId)
      }));
  };

  const sortedHistory = useMemo(() => {
      return [...(editForm.matrixHistory || [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [editForm.matrixHistory]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Scheda Operatore: ${op.lastName} ${op.firstName}`} className="max-w-5xl">
        {/* Force height to viewport to ensure scrolling works regardless of content length */}
        <div className="flex flex-col h-[85vh]">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-4 shrink-0 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('STATS')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'STATS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <BarChart3 size={16} /> Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('HISTORY_DETAILED')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'HISTORY_DETAILED' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <FileText size={16} /> Riepilogo & Storico
                </button>
                <button 
                    onClick={() => setActiveTab('PROFILE')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'PROFILE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <UserCog size={16} /> Anagrafica
                </button>
                <button 
                    onClick={() => setActiveTab('MATRIX')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'MATRIX' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    <CalendarClock size={16} /> Gestione Matrici
                </button>
            </div>

            {/* Content - Scrollable Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-6">
                
                {/* --- STATS TAB --- */}
                {activeTab === 'STATS' && (
                    <div className="space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <div className="text-xs text-blue-500 font-bold uppercase mb-1">Ore Totali (Anno)</div>
                                <div className="text-2xl font-black text-blue-700">{stats.totalHours.toFixed(0)}h</div>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                <div className="text-xs text-indigo-500 font-bold uppercase mb-1">Notti</div>
                                <div className="text-2xl font-black text-indigo-700">{stats.totalNights}</div>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                                <div className="text-xs text-amber-500 font-bold uppercase mb-1">Domeniche</div>
                                <div className="text-2xl font-black text-amber-700">{stats.totalSundays}</div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                                <div className="text-xs text-emerald-500 font-bold uppercase mb-1">Turni Totali</div>
                                <div className="text-2xl font-black text-emerald-700">{stats.pieData.reduce((acc, curr) => acc + curr.value, 0)}</div>
                            </div>
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
                             <div className="bg-white border rounded-lg p-3 shadow-sm flex flex-col">
                                 <h4 className="text-sm font-bold text-slate-700 mb-2 text-center">Distribuzione Tipologia Turni</h4>
                                 <div className="flex-1 min-h-0">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={stats.pieData} 
                                                cx="50%" cy="50%" 
                                                innerRadius={40} 
                                                outerRadius={70} 
                                                fill="#8884d8" 
                                                paddingAngle={2} 
                                                dataKey="value"
                                                label={({name, value}) => `${name}: ${value}`}
                                            >
                                                {stats.pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={state.shiftTypes.find(s => s.code === entry.name)?.color || COLORS[index % COLORS.length]} stroke="#fff" />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                     </ResponsiveContainer>
                                 </div>
                             </div>

                             <div className="bg-white border rounded-lg p-3 shadow-sm flex flex-col">
                                 <h4 className="text-sm font-bold text-slate-700 mb-2 text-center">Ore Mensili (Anno Corrente)</h4>
                                 <div className="flex-1 min-h-0">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.monthlyHours}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{fontSize: 10}} />
                                            <YAxis tick={{fontSize: 10}} />
                                            <Tooltip />
                                            <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                     </ResponsiveContainer>
                                 </div>
                             </div>
                        </div>
                    </div>
                )}

                {/* --- DETAILED HISTORY TAB --- */}
                {activeTab === 'HISTORY_DETAILED' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <FileText size={20} className="text-blue-600" />
                                Resoconto Mensile
                            </h3>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-300"><ChevronLeft size={16}/></button>
                                <span className="font-bold text-lg w-16 text-center">{selectedYear}</span>
                                <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-300"><ChevronRight size={16}/></button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {detailedHistory.map((data) => {
                                const hasActivity = data.workedHours > 0 || Object.keys(data.items).length > 0 || data.notes.length > 0;
                                if (!hasActivity) return null; // Hide empty months

                                return (
                                    <div key={data.monthIndex} className="border rounded-lg overflow-hidden shadow-sm bg-white">
                                        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                            <div className="font-bold text-slate-800 uppercase text-sm tracking-wide">
                                                {data.monthName}
                                            </div>
                                            <div className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                                                Ore Turno: {data.workedHours.toFixed(1)}h
                                            </div>
                                        </div>
                                        <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            
                                            {/* Voci Extra / Assenze - LAYOUT A GRIGLIA */}
                                            <div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                                    <Grid size={12} /> Dettaglio Voci
                                                </div>
                                                {Object.keys(data.items).length > 0 ? (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {Object.entries(data.items).map(([label, value], idx) => (
                                                            <div key={idx} className="bg-slate-50 border border-slate-200 p-2 rounded flex flex-col justify-between items-center text-center shadow-sm h-16">
                                                                <span className="text-[10px] text-slate-500 uppercase font-semibold leading-tight line-clamp-2 w-full" title={label}>{label}</span>
                                                                <span className="font-bold text-slate-800 text-sm mt-1">
                                                                    {value}h
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded border border-dashed border-slate-200 text-center">
                                                        - Nessuna voce extra -
                                                    </div>
                                                )}
                                            </div>

                                            {/* Note del Mese */}
                                            <div className="border-t lg:border-t-0 lg:border-l lg:pl-4 border-slate-100 pt-2 lg:pt-0">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Note Personali</div>
                                                {data.notes.length > 0 ? (
                                                    <ul className="text-xs text-slate-600 space-y-1 list-disc pl-3">
                                                        {data.notes.map((note, idx) => (
                                                            <li key={idx} className="italic">{note}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="text-xs text-slate-400 italic">- Nessuna nota -</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {detailedHistory.every(d => d.workedHours === 0 && Object.keys(d.items).length === 0) && (
                                <div className="text-center py-8 text-slate-400">
                                    Nessun dato registrato per l'anno {selectedYear}.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- PROFILE TAB --- */}
                {activeTab === 'PROFILE' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Nome" value={editForm.firstName || ''} onChange={(e) => setEditForm({...editForm, firstName: e.target.value})} />
                            <Input label="Cognome" value={editForm.lastName || ''} onChange={(e) => setEditForm({...editForm, lastName: e.target.value})} />
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input 
                                    type="checkbox" 
                                    checked={editForm.isActive ?? true}
                                    onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                Operatore Attivo
                            </label>
                            <p className="text-xs text-slate-500 mt-1 pl-6">Se disattivato, l'operatore sarà nascosto nel planner.</p>
                        </div>

                        {/* Contract Management */}
                        <div className="border rounded-md p-3 bg-white">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <CalendarRange size={14} /> Contratti di Lavoro
                                </label>
                                <Button variant="secondary" className="px-2 py-0.5 text-xs h-auto" onClick={addContract}>
                                    <Plus size={12} className="mr-1 inline" /> Aggiungi Periodo
                                </Button>
                            </div>
                            
                            <div className="space-y-2">
                                {editForm.contracts && editForm.contracts.length > 0 ? (
                                    editForm.contracts.map((contract, index) => (
                                        <div key={contract.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                                            <div className="flex-1">
                                                <div className="text-[10px] text-slate-400 uppercase">Inizio Assunzione</div>
                                                <input 
                                                    type="date" 
                                                    className="w-full text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                                                    value={contract.start}
                                                    onChange={(e) => updateContract(contract.id, 'start', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] text-slate-400 uppercase">Fine Rapporto</div>
                                                <input 
                                                    type="date" 
                                                    className="w-full text-sm bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                                                    value={contract.end || ''}
                                                    onChange={(e) => updateContract(contract.id, 'end', e.target.value)}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => removeContract(contract.id)}
                                                className="text-slate-400 hover:text-red-500 p-1"
                                                title="Rimuovi periodo"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-2 text-xs text-slate-400 italic bg-slate-50 rounded">
                                        Nessun contratto definito (Usa "Aggiungi Periodo")
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-medium text-slate-500 uppercase">Note Personali</label>
                            <textarea 
                                className="w-full border border-slate-300 rounded-md p-2 text-sm h-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={editForm.notes || ''}
                                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                                placeholder="Inserisci note, limitazioni o preferenze..."
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <Button variant="primary" onClick={handleSave}>
                                <Save size={16} className="mr-2 inline" /> Salva Modifiche
                            </Button>
                        </div>
                    </div>
                )}

                {/* --- MATRIX TAB (HISTORY) --- */}
                {activeTab === 'MATRIX' && (
                    <div className="space-y-6">
                        {/* New Matrix Section */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                             <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <Plus size={16} className="text-blue-500" />
                                Assegna Nuova Matrice
                             </h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <Select 
                                    label="Seleziona Matrice"
                                    value={newMatrixId}
                                    onChange={(e) => setNewMatrixId(e.target.value)}
                                    className="w-full text-sm"
                                >
                                    <option value="">-- Seleziona --</option>
                                    {state.matrices.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.sequence.length} turni)</option>
                                    ))}
                                </Select>
                                <Input 
                                    label="Data Inizio"
                                    type="date"
                                    value={newMatrixStart}
                                    onChange={(e) => setNewMatrixStart(e.target.value)}
                                    className="w-full text-sm"
                                />
                             </div>
                             
                             <div className="mt-3 flex justify-end">
                                 <Button 
                                    variant="primary" 
                                    onClick={handleAddNewMatrix} 
                                    disabled={!newMatrixId || !newMatrixStart}
                                    className="text-xs"
                                 >
                                    Inserisci e Sovrascrivi Precedente
                                 </Button>
                             </div>
                             
                             <div className="mt-2 text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-100 flex items-start gap-2">
                                 <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5"/>
                                 <span>
                                     Inserendo una nuova matrice, il periodo della matrice precedente verrà automaticamente chiuso al giorno prima della nuova data di inizio.
                                 </span>
                             </div>
                        </div>

                        {/* History Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <History size={16} /> Storico Assegnazioni
                                </h4>
                            </div>
                            
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-medium text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-2">Matrice</th>
                                        <th className="px-4 py-2">Periodo (Modificabile)</th>
                                        <th className="px-4 py-2">Stato</th>
                                        <th className="px-4 py-2 text-right">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedHistory.length > 0 ? (
                                        sortedHistory.map((assign, index) => {
                                            const matrixName = state.matrices.find(m => m.id === assign.matrixId)?.name || 'Sconosciuta';
                                            const matrixColor = state.matrices.find(m => m.id === assign.matrixId)?.color || '#ccc';
                                            const isCurrent = !assign.endDate || (assign.endDate >= format(new Date(), 'yyyy-MM-dd'));
                                            
                                            return (
                                                <tr key={assign.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: matrixColor}}></div>
                                                            <span className="font-medium">{matrixName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="date"
                                                                className="w-24 text-xs bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                                                                value={assign.startDate}
                                                                onChange={(e) => updateMatrixHistory(assign.id, 'startDate', e.target.value)}
                                                            />
                                                            <ArrowRight size={12} className="text-slate-400 shrink-0" />
                                                            <input 
                                                                type="date"
                                                                className="w-24 text-xs bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                                                                value={assign.endDate || ''}
                                                                onChange={(e) => updateMatrixHistory(assign.id, 'endDate', e.target.value)}
                                                                placeholder="Indefinito"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {index === 0 && isCurrent ? (
                                                            <Badge color="bg-green-100 text-green-700">Attiva</Badge>
                                                        ) : (
                                                            <Badge color="bg-slate-100 text-slate-500">Passata</Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button 
                                                            onClick={() => handleRemoveMatrixAssignment(assign.id)}
                                                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                                                            title="Elimina voce dallo storico"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">
                                                Nessuna matrice assegnata nello storico.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button variant="primary" onClick={handleSave}>
                                <Save size={16} className="mr-2 inline" /> Salva Storico
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </Modal>
  );
};