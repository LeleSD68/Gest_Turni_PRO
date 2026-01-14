
import React, { useState, useRef } from 'react';
import { useApp } from '../store';
import { Card, Input, Button, Badge, Modal, Select } from '../components/UI';
import { Trash2, Plus, Edit, X, Copy, RotateCcw, Calculator, AlertTriangle, ShieldAlert, GripVertical, Bot, Network, FileSpreadsheet, Briefcase } from 'lucide-react';
import { AppState, Operator, ShiftType, Matrix, Assignment } from '../types';

export const Settings = () => {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'RULES' | 'OPS' | 'SHIFTS' | 'MATRICES' | 'ASSIGNMENTS' | 'AI'>('RULES');

  // States for CRUD
  const [editingShift, setEditingShift] = useState<Partial<ShiftType> | null>(null);
  const [editingMatrix, setEditingMatrix] = useState<Partial<Matrix> | null>(null);
  const [editingOperator, setEditingOperator] = useState<Partial<Operator> | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Partial<Assignment> | null>(null);
  
  // Drag & Drop State for Operators
  const [draggingOpId, setDraggingOpId] = useState<string | null>(null);
  
  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'OPERATOR' | 'SHIFT' | 'MATRIX' | 'ASSIGNMENT', id: string } | null>(null);

  // AI Connection Test State
  const [aiTestResult, setAiTestResult] = useState<{status: 'idle' | 'success' | 'error', message: string}>({ status: 'idle', message: '' });

  const getContrastColor = (hexColor?: string) => {
      if (!hexColor) return 'text-slate-700';
      // Convert hex to RGB
      const r = parseInt(hexColor.substring(1, 3), 16);
      const g = parseInt(hexColor.substring(3, 5), 16);
      const b = parseInt(hexColor.substring(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? 'text-slate-900' : 'text-white';
  };

  const calculateMatrixStats = (sequence: string[]) => {
      if (!sequence || sequence.length === 0) return null;
      
      const totalCycleHours = sequence.reduce((acc, code) => {
          const shift = state.shiftTypes.find(s => s.code === code);
          return acc + (shift?.hours || 0);
      }, 0);

      const avgPerDay = totalCycleHours / sequence.length;
      
      // Standardizing month as 30.44 days (365.25 / 12)
      const daysInMonth = 30.44;

      return {
          hours6Days: avgPerDay * 6,
          hours1Month: avgPerDay * daysInMonth,
          hours3Months: avgPerDay * (daysInMonth * 3),
          hours1Year: avgPerDay * 365.25,
          avgPerWeek: avgPerDay * 7
      };
  };

  const updateCoverage = (key: string, field: 'min' | 'optimal' | 'mode', value: any) => {
      const currentCoverage = state.config.coverage || {};
      const currentSetting = currentCoverage[key] || { min: 0, optimal: 0, mode: 'VISUAL' };

      const newCoverage = {
          ...currentCoverage,
          [key]: {
              ...currentSetting,
              [field]: value
          }
      };

      dispatch({ type: 'UPDATE_CONFIG', payload: { coverage: newCoverage } });
  };

  const updateAIConfig = (field: string, value: any) => {
      const currentAi = state.config.ai || { enabled: false, provider: 'OLLAMA', baseUrl: 'http://localhost:11434', model: 'llama3' };
      dispatch({ 
          type: 'UPDATE_CONFIG', 
          payload: { 
              ai: { ...currentAi, [field]: value } 
          } 
      });
  };

  const updateGoogleConfig = (value: string) => {
      dispatch({
          type: 'UPDATE_CONFIG',
          payload: { googleScriptUrl: value }
      });
  }

  const testAIConnection = async () => {
      setAiTestResult({ status: 'idle', message: 'Connessione in corso...' });
      const url = state.config.ai.baseUrl.replace(/\/$/, ''); // remove trailing slash
      
      try {
          // Try fetching tags to verify connection
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec timeout
          
          const response = await fetch(`${url}/api/tags`, { 
              signal: controller.signal,
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
          });
          clearTimeout(timeoutId);

          if (response.ok) {
              setAiTestResult({ status: 'success', message: 'Connessione Riuscita! Ollama è raggiungibile.' });
          } else {
              setAiTestResult({ status: 'error', message: `Errore HTTP: ${response.status}` });
          }
      } catch (e: any) {
          setAiTestResult({ status: 'error', message: `Errore di rete: ${e.message}. Verifica CORS o Tunnel.` });
      }
  };

  const saveShift = () => {
      if (!editingShift || !editingShift.code) return;
      if (editingShift.id) {
          dispatch({ type: 'UPDATE_SHIFT', payload: editingShift as ShiftType });
      } else {
          dispatch({ type: 'ADD_SHIFT', payload: { ...editingShift, id: crypto.randomUUID() } as ShiftType });
      }
      setEditingShift(null);
  };

  const saveMatrix = () => {
      if (!editingMatrix || !editingMatrix.name) return;
      if (editingMatrix.id) {
          dispatch({ type: 'UPDATE_MATRIX', payload: editingMatrix as Matrix });
      } else {
          dispatch({ type: 'ADD_MATRIX', payload: { ...editingMatrix, id: crypto.randomUUID(), sequence: editingMatrix.sequence || [] } as Matrix });
      }
      setEditingMatrix(null);
  };

  const duplicateMatrix = (matrix: Matrix) => {
      const newMatrix = {
          ...matrix,
          id: crypto.randomUUID(),
          name: `${matrix.name} (Copia)`
      };
      dispatch({ type: 'ADD_MATRIX', payload: newMatrix });
  };

  const saveAssignment = () => {
      // Modifica: Permetti il salvataggio anche se name è vuoto, basta il codice
      if (!editingAssignment || !editingAssignment.code) return;
      
      const payload = {
          ...editingAssignment,
          name: editingAssignment.name || '' // Assicura che sia una stringa vuota se undefined
      };

      if (editingAssignment.id) {
          dispatch({ type: 'UPDATE_ASSIGNMENT_DEF', payload: payload as Assignment });
      } else {
          dispatch({ type: 'ADD_ASSIGNMENT_DEF', payload: { ...payload, id: crypto.randomUUID() } as Assignment });
      }
      setEditingAssignment(null);
  };

  const saveOperator = () => {
      if (!editingOperator || !editingOperator.firstName || !editingOperator.lastName) return;

      let updatedHistory = editingOperator.matrixHistory || [];
      const newMatrixId = editingOperator.matrixId;
      const newStartDate = editingOperator.matrixStartDate;

      if (newMatrixId && newStartDate) {
           if (!editingOperator.id) {
               updatedHistory = [{ 
                   id: crypto.randomUUID(), 
                   matrixId: newMatrixId, 
                   startDate: newStartDate 
               }];
           } else {
               if (updatedHistory.length === 0) {
                   updatedHistory = [{
                       id: crypto.randomUUID(),
                       matrixId: newMatrixId,
                       startDate: newStartDate
                   }];
               }
           }
      }

      if (editingOperator.id) {
          dispatch({ type: 'UPDATE_OPERATOR', payload: { ...editingOperator, matrixHistory: updatedHistory } as Operator });
      } else {
          // New Operator - add default contract
          const newId = crypto.randomUUID();
          const defaultContracts = [{ id: crypto.randomUUID(), start: '2025-01-01' }];
          // Calculate max order for new item
          const maxOrder = state.operators.reduce((max, op) => Math.max(max, op.order || 0), 0);
          
          dispatch({ 
              type: 'ADD_OPERATOR', 
              payload: { 
                  ...editingOperator, 
                  id: newId, 
                  isActive: editingOperator.isActive ?? true, 
                  notes: editingOperator.notes || '',
                  contracts: defaultContracts,
                  matrixHistory: updatedHistory,
                  order: maxOrder + 1
              } as Operator 
          });
      }
      setEditingOperator(null);
  };

  const toggleShiftInMatrix = (code: string) => {
      if (!editingMatrix) return;
      const seq = editingMatrix.sequence || [];
      setEditingMatrix({ ...editingMatrix, sequence: [...seq, code] });
  };

  const handleDelete = () => {
      if (!deleteTarget) return;
      
      switch (deleteTarget.type) {
          case 'OPERATOR':
              dispatch({ type: 'DELETE_OPERATOR', payload: deleteTarget.id });
              break;
          case 'SHIFT':
              dispatch({ type: 'DELETE_SHIFT', payload: deleteTarget.id });
              break;
          case 'MATRIX':
              dispatch({ type: 'DELETE_MATRIX', payload: deleteTarget.id });
              break;
          case 'ASSIGNMENT':
              dispatch({ type: 'DELETE_ASSIGNMENT_DEF', payload: deleteTarget.id });
              break;
      }
      setDeleteTarget(null);
  };

  // --- Drag & Drop Handlers for Operators ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggingOpId(id);
      e.dataTransfer.effectAllowed = 'move';
      // Set data for firefox compatibility if needed, though state is enough usually
      e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggingOpId || draggingOpId === targetId) return;

      const sourceIndex = state.operators.findIndex(o => o.id === draggingOpId);
      const targetIndex = state.operators.findIndex(o => o.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return;

      // Reorder logic
      const newOperators = [...state.operators];
      // Sort first to ensure current view order matches array logic if needed, 
      // but here we rely on state.operators order usually being the render order.
      // Better to sort by 'order' prop first to be safe.
      newOperators.sort((a, b) => (a.order || 0) - (b.order || 0));

      const sourceOp = newOperators.find(o => o.id === draggingOpId);
      const targetOp = newOperators.find(o => o.id === targetId);
      
      if (!sourceOp || !targetOp) return;

      // Remove source
      const listWithoutSource = newOperators.filter(o => o.id !== draggingOpId);
      // Find new index of target
      const newTargetIndex = listWithoutSource.findIndex(o => o.id === targetId);
      
      // Insert source at target
      // If moving down, target index is fine. If moving up, we insert before.
      // But drag over logic usually implies replacing or inserting before/after.
      // Simplified: Just splice at index.
      
      listWithoutSource.splice(newTargetIndex, 0, sourceOp);

      // Re-assign order based on new array index
      const updatedOperators = listWithoutSource.map((op, index) => ({
          ...op,
          order: index + 1
      }));

      dispatch({ type: 'REORDER_OPERATORS', payload: updatedOperators });
      setDraggingOpId(null);
  };

  // Ensure operators are sorted for display
  const sortedOperators = [...state.operators].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 pb-0">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Centro di Configurazione</h1>
          <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
              {[
                  { id: 'RULES', label: 'Regole' },
                  { id: 'OPS', label: 'Operatori' },
                  { id: 'SHIFTS', label: 'Turni' },
                  { id: 'MATRICES', label: 'Matrici' },
                  { id: 'ASSIGNMENTS', label: 'Incarichi' },
                  { id: 'AI', label: 'Integrazioni' },
              ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'RULES' && tab.id === 'RULES' || activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                      {tab.label}
                  </button>
              ))}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Rules Config */}
        {activeTab === 'RULES' && (
            <div className="space-y-6">
                <Card title="Regole di Validazione">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Ore di Riposo Minime" 
                            type="number" 
                            value={state.config.minRestHours} 
                            onChange={(e) => dispatch({ type: 'UPDATE_CONFIG', payload: { minRestHours: parseInt(e.target.value) } })} 
                        />
                        <Input 
                            label="Max Giorni Consecutivi" 
                            type="number" 
                            value={state.config.maxConsecutiveDays}
                            onChange={(e) => dispatch({ type: 'UPDATE_CONFIG', payload: { maxConsecutiveDays: parseInt(e.target.value) } })} 
                        />
                    </div>
                </Card>

                <Card title="Obiettivi di Copertura (Staffing)">
                     <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 text-xs text-slate-600 flex gap-2">
                         <ShieldAlert size={16} className="shrink-0 text-slate-400" />
                         <div>
                            Imposta il numero minimo e ottimale di operatori per fascia oraria.
                            Scegli come conteggiare i turni di supporto (es. DM per la Mattina, DP per il Pomeriggio).
                         </div>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Mattina */}
                        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                           <div className="font-bold text-emerald-800 mb-3 border-b border-emerald-200 pb-2">Mattina (Gruppo M)</div>
                           <div className="space-y-3">
                              <Input 
                                 label="Minimo (Critico)" 
                                 type="number" 
                                 className="border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200"
                                 value={state.config.coverage['M8']?.min || 0}
                                 onChange={(e) => updateCoverage('M8', 'min', parseInt(e.target.value))}
                              />
                              <Input 
                                 label="Ottimale" 
                                 type="number" 
                                 className="border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200"
                                 value={state.config.coverage['M8']?.optimal || 0}
                                 onChange={(e) => updateCoverage('M8', 'optimal', parseInt(e.target.value))}
                              />
                              <Select
                                  label="Modalità Conteggio DM (Aiuto)"
                                  value={state.config.coverage['M8']?.mode || 'VISUAL'}
                                  onChange={(e) => updateCoverage('M8', 'mode', e.target.value)}
                                  className="border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200 text-xs"
                              >
                                  <option value="VISUAL">Separa (Base + Visualizza Aiuti)</option>
                                  <option value="SUM">Somma (Base + Aiuti validi)</option>
                                  <option value="EXCLUDE">Escludi (Gli aiuti non contano)</option>
                              </Select>
                           </div>
                        </div>

                        {/* Pomeriggio */}
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                           <div className="font-bold text-amber-800 mb-3 border-b border-amber-200 pb-2">Pomeriggio (Gruppo P)</div>
                           <div className="space-y-3">
                              <Input 
                                 label="Minimo (Critico)" 
                                 type="number" 
                                 className="border-amber-200 focus:border-amber-400 focus:ring-amber-200"
                                 value={state.config.coverage['P']?.min || 0}
                                 onChange={(e) => updateCoverage('P', 'min', parseInt(e.target.value))}
                              />
                              <Input 
                                 label="Ottimale" 
                                 type="number" 
                                 className="border-amber-200 focus:border-amber-400 focus:ring-amber-200"
                                 value={state.config.coverage['P']?.optimal || 0}
                                 onChange={(e) => updateCoverage('P', 'optimal', parseInt(e.target.value))}
                              />
                              <Select
                                  label="Modalità Conteggio DP (Aiuto)"
                                  value={state.config.coverage['P']?.mode || 'VISUAL'}
                                  onChange={(e) => updateCoverage('P', 'mode', e.target.value)}
                                  className="border-amber-200 focus:border-amber-400 focus:ring-amber-200 text-xs"
                              >
                                  <option value="VISUAL">Separa (Base + Visualizza Aiuti)</option>
                                  <option value="SUM">Somma (Base + Aiuti validi)</option>
                                  <option value="EXCLUDE">Escludi (Gli aiuti non contano)</option>
                              </Select>
                           </div>
                        </div>

                        {/* Notte */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                           <div className="font-bold text-blue-800 mb-3 border-b border-blue-200 pb-2">Notte (N)</div>
                           <div className="space-y-3">
                              <Input 
                                 label="Minimo (Critico)" 
                                 type="number" 
                                 className="border-blue-200 focus:border-blue-400 focus:ring-blue-200"
                                 value={state.config.coverage['N']?.min || 0}
                                 onChange={(e) => updateCoverage('N', 'min', parseInt(e.target.value))}
                              />
                              <Input 
                                 label="Ottimale" 
                                 type="number" 
                                 className="border-blue-200 focus:border-blue-400 focus:ring-blue-200"
                                 value={state.config.coverage['N']?.optimal || 0}
                                 onChange={(e) => updateCoverage('N', 'optimal', parseInt(e.target.value))}
                              />
                           </div>
                           <div className="mt-3 text-[10px] text-blue-600 font-medium italic">
                               * Assicurati che il minimo sia impostato a 1 per segnalare l'assenza di copertura notturna.
                           </div>
                        </div>
                     </div>
                </Card>
            </div>
        )}

        {/* Assignments Management */}
        {activeTab === 'ASSIGNMENTS' && (
            <Card title="Gestione Incarichi (Postazioni)">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {state.assignments.map(assignment => (
                        <div key={assignment.id} className="border rounded-lg p-3 flex justify-between items-center bg-white shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-md flex items-center justify-center font-bold shadow-sm`} style={{ backgroundColor: assignment.color }}>
                                    <span className={getContrastColor(assignment.color)}>{assignment.code}</span>
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">{assignment.name}</div>
                                    <div className="text-xs text-slate-500 font-mono">Codice: {assignment.code}</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingAssignment(assignment)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit size={14} /></button>
                                <button onClick={() => setDeleteTarget({ type: 'ASSIGNMENT', id: assignment.id })} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={() => setEditingAssignment({ code: '', name: '', color: '#0ea5e9' })}
                        className="border-2 border-dashed border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                        <Plus size={24} />
                        <span className="text-xs font-medium mt-1">Nuovo Incarico</span>
                    </button>
                </div>
                <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mt-4 flex gap-2">
                    <Briefcase size={16} className="shrink-0" />
                    <span>
                        Gli incarichi vengono visualizzati nella scheda dedicata "Incarichi". I colori scelti saranno usati per evidenziare la casella del turno.
                        Usa codici brevi (es. "3°U", "AMB") per una migliore leggibilità.
                    </span>
                </div>
            </Card>
        )}

        {/* AI & Integration Config Tab */}
        {activeTab === 'AI' && (
            <div className="space-y-6">
                <Card title="Google Sheets Integration (Automazione)">
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 flex items-start gap-3 mb-4">
                        <FileSpreadsheet className="shrink-0 text-emerald-600" size={24} />
                        <div className="text-sm text-emerald-900">
                            <p className="font-bold mb-1">Collega il tuo Foglio Google "Master"</p>
                            <p className="mb-2">Per aggiornare automaticamente i turni su Google Sheets senza copia-incolla, devi inserire qui l'URL della Web App di Google Apps Script.</p>
                            <ol className="list-decimal pl-4 space-y-1 text-xs mt-2">
                                <li>Apri il tuo Foglio Google Master.</li>
                                <li>Vai su <strong>Estensioni</strong> &gt; <strong>Apps Script</strong>.</li>
                                <li>Incolla lo script fornito (chiedi all'assistente se non ce l'hai).</li>
                                <li>Clicca sul tasto blu <strong>Distribuisci</strong> &gt; <strong>Nuova distribuzione</strong>.</li>
                                <li>Seleziona tipo: <strong>Applicazione web</strong>.</li>
                                <li>Chi ha accesso: <strong>Chiunque</strong> (necessario per l'invio dati).</li>
                                <li>Copia l'URL generato e incollalo qui sotto.</li>
                            </ol>
                        </div>
                    </div>

                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Input 
                                label="Link Google Script (Codice Condivisione)" 
                                placeholder="https://script.google.com/macros/s/..." 
                                value={state.config.googleScriptUrl || ''}
                                onChange={(e) => updateGoogleConfig(e.target.value)}
                            />
                        </div>
                        <div className="mb-2">
                            {state.config.googleScriptUrl ? (
                                <Badge color="bg-green-100 text-green-700">Collegato</Badge>
                            ) : (
                                <Badge color="bg-slate-100 text-slate-500">Non Configurato</Badge>
                            )}
                        </div>
                    </div>
                </Card>

                <Card title="Integrazione Intelligenza Artificiale Locale (Ollama)">
                    <div className="flex flex-col gap-4">
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3">
                            <Bot className="shrink-0 text-indigo-600" size={24} />
                            <div className="text-sm text-indigo-900">
                                <p className="font-bold mb-1">Configura l'assistente AI locale</p>
                                <p className="mb-2">ShiftMaster può connettersi alla tua istanza locale di Ollama per analizzare i turni e suggerire ottimizzazioni, senza inviare dati al cloud.</p>
                                <p><strong>Nota per uso Cloud (Netlify):</strong> Se l'app è su internet, devi usare un tunnel (es. Ngrok) per esporre Ollama.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                             <input 
                                 type="checkbox" 
                                 id="aiEnabled"
                                 checked={state.config.ai?.enabled || false}
                                 onChange={(e) => updateAIConfig('enabled', e.target.checked)}
                                 className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                             />
                             <label htmlFor="aiEnabled" className="font-bold text-slate-700">Abilita Funzionalità AI</label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Select 
                                label="Provider" 
                                value={state.config.ai?.provider || 'OLLAMA'} 
                                onChange={(e) => updateAIConfig('provider', e.target.value)}
                            >
                                <option value="OLLAMA">Ollama (Locale / Tunnel)</option>
                                <option value="OTHER" disabled>OpenAI / Gemini (Coming Soon)</option>
                            </Select>

                            <Input 
                                label="URL Base API" 
                                placeholder="http://localhost:11434" 
                                value={state.config.ai?.baseUrl || ''} 
                                onChange={(e) => updateAIConfig('baseUrl', e.target.value)}
                            />

                            <Input 
                                label="Modello" 
                                placeholder="llama3" 
                                value={state.config.ai?.model || 'llama3'} 
                                onChange={(e) => updateAIConfig('model', e.target.value)}
                            />
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-bold text-sm text-slate-700 mb-2">Test Connessione</h4>
                            <div className="flex items-center gap-3">
                                <Button variant="secondary" onClick={testAIConnection} className="flex items-center gap-2">
                                    <Network size={16} /> Verifica Connessione
                                </Button>
                                {aiTestResult.status !== 'idle' && (
                                    <span className={`text-sm font-medium ${aiTestResult.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                        {aiTestResult.message}
                                    </span>
                                )}
                            </div>
                            {aiTestResult.status === 'error' && (
                                <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                    Suggerimento: Se sei su Netlify, assicurati di usare l'URL HTTPS di Ngrok e non 'localhost'.
                                    <br/>Esempio: <code>https://xxxx-xx-xx-xx-xx.ngrok-free.app</code>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        )}

        {/* Operators */}
        {activeTab === 'OPS' && (
            <Card title="Gestione Operatori">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
                            <tr>
                                <th className="px-4 py-2 w-10"></th> {/* Handle */}
                                <th className="px-4 py-2">Nome</th>
                                <th className="px-4 py-2">Stato</th>
                                <th className="px-4 py-2">Matrice Corrente</th>
                                <th className="px-4 py-2 text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedOperators.map(op => (
                                <tr 
                                    key={op.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, op.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, op.id)}
                                    className={`hover:bg-slate-50 transition-colors ${draggingOpId === op.id ? 'opacity-50 bg-blue-50' : ''}`}
                                >
                                    <td className="px-4 py-2 text-slate-400 cursor-grab active:cursor-grabbing">
                                        <GripVertical size={16} />
                                    </td>
                                    <td className="px-4 py-2 font-medium">{op.lastName} {op.firstName}</td>
                                    <td className="px-4 py-2">
                                        <Badge color={op.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                            {op.isActive ? 'Attivo' : 'Inattivo'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2">{state.matrices.find(m => m.id === op.matrixId)?.name || '-'}</td>
                                    <td className="px-4 py-2 text-right flex justify-end gap-2">
                                        <button 
                                            className="text-blue-600 hover:text-blue-800 p-1"
                                            onClick={() => setEditingOperator(op)}
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button 
                                            className="text-red-600 hover:text-red-800 p-1"
                                            onClick={() => setDeleteTarget({ type: 'OPERATOR', id: op.id })}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4 flex justify-between items-center">
                        <div className="text-xs text-slate-400 italic">
                            Trascina le righe usando l'icona a sinistra per riordinare gli operatori nel planner.
                        </div>
                        <Button variant="secondary" className="px-2 py-1 text-sm" onClick={() => setEditingOperator({ firstName: '', lastName: '', isActive: true, notes: '' })}>
                            <Plus size={16} className="mr-1 inline" /> Aggiungi Operatore
                        </Button>
                    </div>
                </div>
            </Card>
        )}

        {/* Shifts Management */}
        {activeTab === 'SHIFTS' && (
            <Card title="Tipi di Turno">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {state.shiftTypes.map(shift => (
                        <div key={shift.id} className="border rounded-lg p-3 flex justify-between items-center bg-white shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-md flex items-center justify-center font-bold ${getContrastColor(shift.color)}`} style={{ backgroundColor: shift.color }}>
                                    {shift.code}
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">{shift.name}</div>
                                    <div className="text-xs text-slate-500">{shift.hours}h {shift.isNight ? '• Notte' : ''}</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingShift(shift)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit size={14} /></button>
                                <button onClick={() => setDeleteTarget({ type: 'SHIFT', id: shift.id })} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={() => setEditingShift({ code: '', name: '', color: '#cbd5e1', hours: 8, isNight: false, isWeekend: false })}
                        className="border-2 border-dashed border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                        <Plus size={24} />
                        <span className="text-xs font-medium mt-1">Nuovo Turno</span>
                    </button>
                </div>
            </Card>
        )}

        {/* Matrix Management */}
        {activeTab === 'MATRICES' && (
            <Card title="Matrici di Rotazione">
                 <div className="space-y-4">
                    {state.matrices.map(matrix => {
                        const stats = calculateMatrixStats(matrix.sequence);
                        return (
                            <div key={matrix.id} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            {matrix.name}
                                            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Ciclo: {matrix.sequence.length} gg</span>
                                        </h3>
                                        <div className="flex gap-2 mt-1">
                                            <div className="w-4 h-4 rounded-full border border-slate-300" style={{backgroundColor: matrix.color || '#ffffff'}}></div>
                                            <span className="text-xs text-slate-400">Colore Matrice</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => duplicateMatrix(matrix)} className="text-slate-500 text-xs font-medium hover:text-blue-600 hover:underline flex items-center gap-1">
                                            <Copy size={12} /> Duplica
                                        </button>
                                        <button onClick={() => setEditingMatrix(matrix)} className="text-blue-600 text-xs font-medium hover:underline flex items-center gap-1">
                                            <Edit size={12} /> Modifica
                                        </button>
                                        <button onClick={() => setDeleteTarget({ type: 'MATRIX', id: matrix.id })} className="text-red-600 text-xs font-medium hover:underline flex items-center gap-1">
                                            <Trash2 size={12} /> Elimina
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-1 mb-4">
                                    {matrix.sequence.map((code, idx) => {
                                        const shift = state.shiftTypes.find(s => s.code === code);
                                        return (
                                            <div key={idx} className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded border border-slate-200 ${getContrastColor(shift?.color)}`} style={{ backgroundColor: shift?.color || '#fff' }}>
                                                {code}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Matrix Stats */}
                                {stats && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <Calculator size={12} /> Proiezione Ore
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                            <div>
                                                <span className="block text-slate-400">6 Giorni</span>
                                                <span className="font-semibold text-slate-700 text-sm">{stats.hours6Days.toFixed(1)}h</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400">1 Mese (30.4gg)</span>
                                                <span className="font-semibold text-slate-700 text-sm">{stats.hours1Month.toFixed(1)}h</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400">3 Mesi</span>
                                                <span className="font-semibold text-slate-700 text-sm">{stats.hours3Months.toFixed(0)}h</span>
                                                <span className="text-[10px] text-slate-400 block">Media: {(stats.hours3Months / 3).toFixed(1)}h/m</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400">12 Mesi</span>
                                                <span className="font-semibold text-slate-700 text-sm">{stats.hours1Year.toFixed(0)}h</span>
                                                <span className="text-[10px] text-slate-400 block">Media: {(stats.hours1Year / 12).toFixed(1)}h/m</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <Button variant="secondary" onClick={() => setEditingMatrix({ name: '', sequence: [] })}>
                        <Plus size={16} className="mr-2 inline" /> Nuova Matrice
                    </Button>
                 </div>
            </Card>
        )}
      </div>

      {/* Modal Edit Operator */}
      <Modal isOpen={!!editingOperator} onClose={() => setEditingOperator(null)} title={editingOperator?.id ? "Modifica Operatore" : "Nuovo Operatore"}>
          {editingOperator && (
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Nome" value={editingOperator.firstName} onChange={e => setEditingOperator({...editingOperator, firstName: e.target.value})} />
                      <Input label="Cognome" value={editingOperator.lastName} onChange={e => setEditingOperator({...editingOperator, lastName: e.target.value})} />
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <input 
                          type="checkbox" 
                          id="opActive" 
                          checked={editingOperator.isActive ?? true} 
                          onChange={e => setEditingOperator({...editingOperator, isActive: e.target.checked})}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="opActive" className="text-sm font-medium text-slate-700">Operatore Attivo</label>
                  </div>

                  <div className="bg-blue-50 p-3 rounded text-xs text-blue-800">
                      Per gestire i periodi di contratto o lo <strong>Storico Matrici</strong> completo, usa la scheda operatore cliccando sul nome nel Planner.
                  </div>

                  <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Impostazione Matrice Corrente</h4>
                      <div className="text-xs text-slate-400 mb-2 italic">
                          Nota: La modifica qui aggiungerà una nuova voce allo storico.
                      </div>
                      <Select 
                          label="Matrice Assegnata" 
                          value={editingOperator.matrixId || ''} 
                          onChange={e => setEditingOperator({...editingOperator, matrixId: e.target.value || undefined})}
                      >
                          <option value="">Nessuna Matrice</option>
                          {state.matrices.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                      </Select>
                      
                      {editingOperator.matrixId && (
                          <Input 
                              type="date" 
                              label="Data Inizio Rotazione" 
                              value={editingOperator.matrixStartDate || ''} 
                              onChange={e => setEditingOperator({...editingOperator, matrixStartDate: e.target.value})} 
                          />
                      )}
                  </div>

                  <Input label="Note" value={editingOperator.notes} onChange={e => setEditingOperator({...editingOperator, notes: e.target.value})} />

                  <div className="flex justify-end gap-2 pt-4">
                      <Button variant="ghost" onClick={() => setEditingOperator(null)}>Annulla</Button>
                      <Button variant="primary" onClick={saveOperator}>Salva</Button>
                  </div>
              </div>
          )}
      </Modal>

      {/* Modal Edit Shift */}
      <Modal isOpen={!!editingShift} onClose={() => setEditingShift(null)} title={editingShift?.id ? "Modifica Turno" : "Nuovo Turno"}>
          {editingShift && (
              <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                      <Input label="Codice (Es. M)" value={editingShift.code} onChange={e => setEditingShift({...editingShift, code: e.target.value.toUpperCase()})} maxLength={3} />
                      <Input label="Colore (Hex)" type="color" value={editingShift.color} onChange={e => setEditingShift({...editingShift, color: e.target.value})} className="h-10 p-1" />
                  </div>
                  <Input label="Nome Completo" value={editingShift.name} onChange={e => setEditingShift({...editingShift, name: e.target.value})} />
                  <Input label="Ore" type="number" value={editingShift.hours} onChange={e => setEditingShift({...editingShift, hours: parseFloat(e.target.value)})} />
                  <div className="flex gap-4 pt-2">
                      <label className="flex items-center text-sm gap-2">
                          <input type="checkbox" checked={editingShift.isNight} onChange={e => setEditingShift({...editingShift, isNight: e.target.checked})} />
                          Turno Notturno
                      </label>
                      <label className="flex items-center text-sm gap-2">
                          <input type="checkbox" checked={editingShift.isWeekend} onChange={e => setEditingShift({...editingShift, isWeekend: e.target.checked})} />
                          Turno Weekend
                      </label>
                      <label className="flex items-center text-sm gap-2">
                          <input type="checkbox" checked={editingShift.inheritsHours} onChange={e => setEditingShift({...editingShift, inheritsHours: e.target.checked})} />
                          Eredita Ore
                      </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                      <Button variant="ghost" onClick={() => setEditingShift(null)}>Annulla</Button>
                      <Button variant="primary" onClick={saveShift}>Salva</Button>
                  </div>
              </div>
          )}
      </Modal>

      {/* Modal Edit Matrix */}
      <Modal isOpen={!!editingMatrix} onClose={() => setEditingMatrix(null)} title={editingMatrix?.id ? "Modifica Matrice" : "Nuova Matrice"}>
          {editingMatrix && (
              <div className="space-y-4">
                  <Input label="Nome Matrice" value={editingMatrix.name} onChange={e => setEditingMatrix({...editingMatrix, name: e.target.value})} />
                  
                  <div className="flex gap-4 items-center">
                       <div className="flex-1">
                           <Input label="Colore Matrice" type="color" value={editingMatrix.color || '#e0f2fe'} onChange={e => setEditingMatrix({...editingMatrix, color: e.target.value})} className="h-10 p-1" />
                       </div>
                       <div className="text-xs text-slate-500 pt-4">
                           Il colore sarà usato come sfondo per gli operatori.
                       </div>
                  </div>

                  <div>
                      <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-medium text-slate-500 uppercase">Sequenza</label>
                          <button 
                            onClick={() => setEditingMatrix({ ...editingMatrix, sequence: [] })}
                            className="text-xs text-red-500 flex items-center gap-1 hover:underline"
                          >
                              <RotateCcw size={10} /> Svuota
                          </button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border rounded bg-slate-50 mb-3 items-center">
                          {editingMatrix.sequence?.map((code, idx) => {
                              const shift = state.shiftTypes.find(s => s.code === code);
                              return (
                                  <div key={idx} className="relative group cursor-pointer" onClick={() => {
                                      const newSeq = [...(editingMatrix.sequence || [])];
                                      newSeq.splice(idx, 1);
                                      setEditingMatrix({...editingMatrix, sequence: newSeq});
                                  }}>
                                      <div className={`w-9 h-9 flex items-center justify-center font-bold text-xs rounded shadow-sm border border-slate-200 ${getContrastColor(shift?.color)}`} style={{ backgroundColor: shift?.color || '#fff' }}>
                                          {code}
                                      </div>
                                      <div className="absolute -top-1 -right-1 hidden group-hover:flex bg-red-500 text-white w-4 h-4 rounded-full items-center justify-center text-[10px] shadow-sm z-10">
                                          <X size={10} />
                                      </div>
                                  </div>
                              );
                          })}
                          {(!editingMatrix.sequence || editingMatrix.sequence.length === 0) && <span className="text-xs text-slate-400 italic p-1 mx-auto">Nessun turno. Clicca sui pulsanti sotto per aggiungerli.</span>}
                      </div>
                      
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {state.shiftTypes.map(s => (
                              <button 
                                key={s.id}
                                onClick={() => toggleShiftInMatrix(s.code)}
                                className={`p-2 text-xs font-bold rounded border hover:opacity-90 active:scale-95 transition-transform shadow-sm ${getContrastColor(s.color)}`}
                                style={{ backgroundColor: s.color }}
                                title={s.name}
                              >
                                  {s.code}
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                      <Button variant="ghost" onClick={() => setEditingMatrix(null)}>Annulla</Button>
                      <Button variant="primary" onClick={saveMatrix}>Salva</Button>
                  </div>
              </div>
          )}
      </Modal>

      {/* Modal Edit Assignment */}
      <Modal isOpen={!!editingAssignment} onClose={() => setEditingAssignment(null)} title={editingAssignment?.id ? "Modifica Incarico" : "Nuovo Incarico"}>
          {editingAssignment && (
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Codice (Breve)" value={editingAssignment.code} onChange={e => setEditingAssignment({...editingAssignment, code: e.target.value})} maxLength={15} placeholder="Es. 3°U" />
                      <Input label="Colore" type="color" value={editingAssignment.color} onChange={e => setEditingAssignment({...editingAssignment, color: e.target.value})} className="h-10 p-1" />
                  </div>
                  <Input label="Nome Completo" value={editingAssignment.name} onChange={e => setEditingAssignment({...editingAssignment, name: e.target.value})} placeholder="Es. 3° Unità" />
                  
                  <div className="flex justify-end gap-2 pt-4">
                      <Button variant="ghost" onClick={() => setEditingAssignment(null)}>Annulla</Button>
                      <Button variant="primary" onClick={saveAssignment}>Salva</Button>
                  </div>
              </div>
          )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Conferma Eliminazione">
          <div className="space-y-4">
              <div className="flex items-center gap-3 bg-red-50 p-4 rounded text-red-800">
                  <AlertTriangle size={24} />
                  <div>
                      <p className="font-bold">Sei sicuro di voler procedere?</p>
                      <p className="text-sm">Questa azione è irreversibile.</p>
                  </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Annulla</Button>
                  <Button variant="danger" onClick={handleDelete}>Elimina Definitivamente</Button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
