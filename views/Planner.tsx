import React, { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, validateCell, getShiftByCode, getSuggestions, parseISO, isOperatorEmployed, getItalianHolidayName, startOfMonth, startOfWeek, endOfWeek, subWeeks, addWeeks, endOfMonth, isItalianHoliday } from '../utils';
import { format, isToday, isWeekend, addMonths, differenceInDays, addDays, isWithinInterval, isSameMonth, isSunday, isBefore, eachDayOfInterval, isSaturday, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Filter, Download, Zap, AlertTriangle, UserCheck, RefreshCw, Edit2, X, Info, Save, UserPlus, Check, ArrowRightLeft, Wand2, HelpCircle, Eye, RotateCcw, Copy, ClipboardPaste, CalendarClock, Clock, Layers, GitCompare, Layout, CalendarDays, Search, List, MousePointer2, Eraser, CalendarOff, BarChart3, UserCog, StickyNote, Printer, Plus, Trash2, Watch, Coins, ArrowUpCircle, ArrowRightCircle, FileSpreadsheet, Undo, Redo, ArrowRight, ChevronDown, ChevronUp, FileText, History, Menu, Settings2, XCircle, Share2, Send, Cloud, CloudOff, Loader2, CheckCircle, PartyPopper, Star, CheckCircle2, Users, FileClock, Calendar, Grid, Columns, Briefcase, MoveRight, CheckCheck, MessageSquare, Mail } from 'lucide-react';
import { Button, Modal, Select, Input, Badge } from '../components/UI';
import { PlannerEntry, ViewMode, ShiftType, SpecialEvent, CoverageConfig, DayNote, DayNoteType, Operator } from '../types';
import { OperatorDetailModal } from '../components/OperatorDetailModal';
import { PrintLayout } from '../components/PrintLayout';
import { TimesheetPrintLayout } from '../components/TimesheetPrintLayout';
import { PersonalCalendarPrintLayout } from '../components/PersonalCalendarPrintLayout';

type DisplayMode = 'PLANNER_STANDARD' | 'PLANNER_MINIMAL' | 'PLANNER_DETAILED' | 'MATRIX_ONLY' | 'MATRIX_DIFF';

type LastOperation = { type: 'UPDATE'; shiftCode: string; note?: string; variationReason?: string; customHours?: number; specialEvents?: SpecialEvent[]; } | { type: 'DELETE'; };

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ITALIAN_DAY_INITIALS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const NOTE_TYPES: Record<DayNoteType, { icon: React.ElementType, color: string, label: string, bg: string, border: string }> = {
    INFO: { icon: StickyNote, color: 'text-amber-600', label: 'Nota', bg: 'bg-amber-50', border: 'border-amber-200' },
    ALERT: { icon: AlertTriangle, color: 'text-red-600', label: 'Urgenza', bg: 'bg-red-50', border: 'border-red-200' },
    EVENT: { icon: Star, color: 'text-blue-600', label: 'Evento', bg: 'bg-blue-50', border: 'border-blue-200' },
    MEETING: { icon: Users, color: 'text-purple-600', label: 'Meet', bg: 'bg-purple-50', border: 'border-purple-200' },
    HOLIDAY: { icon: PartyPopper, color: 'text-pink-600', label: 'Festa', bg: 'bg-pink-50', border: 'border-pink-200' },
    CHECK: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Fatto', bg: 'bg-emerald-50', border: 'border-emerald-200' }
};

export const Planner = () => {
  const { state, dispatch, history, syncStatus, saveToCloud } = useApp();
  
  // States
  const [displayMode, setDisplayMode] = useState<DisplayMode>('PLANNER_STANDARD');
  const [viewSpan, setViewSpan] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [selectedCell, setSelectedCell] = useState<{ opId: string; date: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPrevDays, setShowPrevDays] = useState(false);
  const [groupByMatrix, setGroupByMatrix] = useState(true);
  const [highlightPast, setHighlightPast] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('planner_searchTerm') || '');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MODIFIED' | 'EXTRA'>(() => {
      const saved = localStorage.getItem('planner_filterStatus');
      return (['ALL', 'ACTIVE', 'INACTIVE', 'MODIFIED', 'EXTRA'].includes(saved || '')) ? saved as any : 'ACTIVE';
  });
  const [filterMatrix, setFilterMatrix] = useState<string>(() => localStorage.getItem('planner_filterMatrix') || 'ALL');
  
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printLayoutMode, setPrintLayoutMode] = useState<'VISUAL' | 'TIMESHEET' | 'PERSONAL'>('VISUAL');
  const [showPersonalExportModal, setShowPersonalExportModal] = useState(false);
  const [exportSelectionType, setExportSelectionType] = useState<'SINGLE' | 'MULTI' | 'ALL' | 'NONE'>('SINGLE');
  const [exportSelectedOpId, setExportSelectedOpId] = useState('');
  
  const [cellPopupPosition, setCellPopupPosition] = useState<{x: number, y: number, align: 'top' | 'bottom'} | null>(null);
  const [multiSelectPopupPosition, setMultiSelectPopupPosition] = useState<{x: number, y: number} | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredOpId, setHoveredOpId] = useState<string | null>(null);
  
  const [multiSelection, setMultiSelection] = useState<{ opId: string, start: string, end: string } | null>(null);
  const [clipboard, setClipboard] = useState<string[] | null>(null);
  const [detailsOpId, setDetailsOpId] = useState<string | null>(null);
  const [editingDayNote, setEditingDayNote] = useState<{ date: string; note: DayNote } | null>(null);
  
  const [draftShift, setDraftShift] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftVariationReason, setDraftVariationReason] = useState('');
  const [draftCustomHours, setDraftCustomHours] = useState<number | undefined>(undefined);
  const [draftSpecialEvents, setDraftSpecialEvents] = useState<SpecialEvent[]>([]);
  const [isSpecialMode, setIsSpecialMode] = useState(false);

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const isMatrixView = displayMode === 'MATRIX_ONLY' || displayMode === 'MATRIX_DIFF';

  // Persist filters
  useEffect(() => { localStorage.setItem('planner_searchTerm', searchTerm); }, [searchTerm]);
  useEffect(() => { localStorage.setItem('planner_filterStatus', filterStatus); }, [filterStatus]);
  useEffect(() => { localStorage.setItem('planner_filterMatrix', filterMatrix); }, [filterMatrix]);

  // Derived Data
  const days = useMemo(() => {
      const date = parseISO(state.currentDate);
      if (viewSpan === 'WEEK') {
          const start = startOfWeek(date, { weekStartsOn: 1 });
          const end = endOfWeek(date, { weekStartsOn: 1 });
          return eachDayOfInterval({ start, end });
      } else {
          const start = startOfMonth(date);
          const end = endOfMonth(start);
          const monthDays = eachDayOfInterval({ start, end });
          if (!showPrevDays) return monthDays;
          const firstDay = monthDays[0];
          const prevDays = [addDays(firstDay, -3), addDays(firstDay, -2), addDays(firstDay, -1)];
          return [...prevDays, ...monthDays];
      }
  }, [state.currentDate, showPrevDays, viewSpan]);
  
  const filteredOperators = useMemo(() => {
      return state.operators.filter(op => {
          if (filterStatus === 'ACTIVE' && !op.isActive) return false;
          if (filterStatus === 'INACTIVE' && op.isActive) return false;
          if (filterStatus === 'MODIFIED') {
              if (!op.isActive) return false;
              const hasMod = days.some(d => {
                  const dk = formatDateKey(d);
                  const e = getEntry(state, op.id, dk);
                  return e && (e.isManual || !!e.variationReason || (e.specialEvents && e.specialEvents.length > 0));
              });
              if (!hasMod) return false;
          }
          if (searchTerm) {
              const fullName = `${op.lastName} ${op.firstName}`.toLowerCase();
              if (!fullName.includes(searchTerm.toLowerCase())) return false;
          }
          if (filterMatrix !== 'ALL' && op.matrixId !== filterMatrix) return false; 
          return true;
      });
  }, [state.operators, filterStatus, filterMatrix, searchTerm, days, state.plannerData]);

  const groupedOperators = useMemo(() => {
      if (!groupByMatrix) return { 'all': filteredOperators };
      const groups: Record<string, typeof filteredOperators> = {};
      filteredOperators.forEach(op => {
          const key = op.matrixId || 'none';
          if (!groups[key]) groups[key] = [];
          groups[key].push(op);
      });
      return groups;
  }, [filteredOperators, groupByMatrix]);

  const sortedGroupKeys = useMemo(() => {
      if (!groupByMatrix) return ['all'];
      return Object.keys(groupedOperators).sort((a, b) => {
          if (a === 'none') return 1;
          if (b === 'none') return -1;
          return state.matrices.findIndex(m => m.id === a) - state.matrices.findIndex(m => m.id === b);
      });
  }, [groupedOperators, state.matrices, groupByMatrix]);

  const getContrastColor = (hexColor?: string) => {
      if (!hexColor) return 'text-slate-700';
      const r = parseInt(hexColor.substring(1, 3), 16), g = parseInt(hexColor.substring(3, 5), 16), b = parseInt(hexColor.substring(5, 7), 16);
      return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128 ? 'text-slate-900' : 'text-white';
  };

  const clearSelection = () => { 
      setSelectedCell(null); 
      setShowEditModal(false); 
      setMultiSelection(null); 
      setCellPopupPosition(null); 
      setMultiSelectPopupPosition(null); 
      setShowFilters(false);
  };
  
  const handlePrev = () => { const date = parseISO(state.currentDate); dispatch({ type: 'SET_DATE', payload: format(viewSpan === 'WEEK' ? subWeeks(date, 1) : addMonths(date, -1), 'yyyy-MM-dd') }); clearSelection(); };
  const handleNext = () => { const date = parseISO(state.currentDate); dispatch({ type: 'SET_DATE', payload: format(viewSpan === 'WEEK' ? addWeeks(date, 1) : addMonths(date, 1), 'yyyy-MM-dd') }); clearSelection(); };
  const handleToday = () => { dispatch({ type: 'SET_DATE', payload: format(new Date(), 'yyyy-MM-01') }); clearSelection(); };
  const getHeaderLabel = () => { const date = parseISO(state.currentDate); if (viewSpan === 'WEEK') { const s = startOfWeek(date, { weekStartsOn: 1 }), e = endOfWeek(date, { weekStartsOn: 1 }); return `${format(s, isSameMonth(s, e) ? 'd' : 'd MMM')} - ${format(e, 'd MMM yyyy')}`; } return `${ITALIAN_MONTHS[date.getMonth()]} ${date.getFullYear()}`; };

  const handleCellClick = (e: React.MouseEvent, opId: string, date: string, isEmployed: boolean) => {
    if (!isEmployed) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (isMatrixView) return;
    
    if (e.shiftKey && selectedCell && selectedCell.opId === opId) {
        const d1 = parseISO(selectedCell.date), d2 = parseISO(date);
        setMultiSelection({ opId, start: d1 < d2 ? selectedCell.date : date, end: d1 < d2 ? date : selectedCell.date });
        return;
    }
    
    setSelectedCell({ opId, date });
    const op = state.operators.find(o => o.id === opId), entry = getEntry(state, opId, date), mx = op ? calculateMatrixShift(op, date, state.matrices) : null;
    setDraftShift(entry?.shiftCode ?? mx ?? ''); setDraftNote(entry?.note ?? ''); setDraftVariationReason(entry?.variationReason ?? ''); setDraftCustomHours(entry?.customHours); setDraftSpecialEvents(entry?.specialEvents || []); setIsSpecialMode(!!entry?.specialEvents?.length);
    
    let y = rect.bottom + 5, align: 'top' | 'bottom' = 'bottom';
    if (y + 250 > window.innerHeight) { y = rect.top - 255; align = 'top'; }
    let x = rect.left + rect.width / 2;
    if (x + 150 > window.innerWidth) x = window.innerWidth - 160;
    if (x - 150 < 0) x = 160;
    setCellPopupPosition({ x, y, align });
  };

  const saveChanges = () => {
      if (!selectedCell) return;
      const updates: PlannerEntry[] = [];
      const removeList: { operatorId: string, date: string }[] = [];
      const dates = (multiSelection && multiSelection.opId === selectedCell.opId) ? eachDayOfInterval({ start: parseISO(multiSelection.start), end: parseISO(multiSelection.end) }).map(d => formatDateKey(d)) : [selectedCell.date];
      dates.forEach(d => {
          if (!draftShift && !draftNote && !isSpecialMode) { removeList.push({ operatorId: selectedCell.opId, date: d }); return; }
          const violation = validateCell(state, selectedCell.opId, d, draftShift);
          updates.push({ operatorId: selectedCell.opId, date: d, shiftCode: draftShift, note: draftNote, isManual: true, violation: violation || undefined, variationReason: draftVariationReason || undefined, customHours: draftCustomHours, specialEvents: draftSpecialEvents });
      });
      if (removeList.length > 0) removeList.forEach(item => dispatch({ type: 'REMOVE_CELL', payload: item }));
      if (updates.length > 0) dispatch({ type: 'BATCH_UPDATE', payload: updates });
      clearSelection();
  };

  const handleExportCSV = () => {
      const rows = [['Operatore', ...days.map(d => format(d, 'yyyy-MM-dd'))]];
      state.operators.filter(o => o.isActive).forEach(op => {
          const row = [`${op.lastName} ${op.firstName}`];
          days.forEach(d => {
              const dk = formatDateKey(d);
              const e = getEntry(state, op.id, dk);
              const m = calculateMatrixShift(op, dk, state.matrices);
              row.push(e?.shiftCode || m || '');
          });
          rows.push(row);
      });
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `export_turni_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const printRoot = document.getElementById('print-root');

  return (
    <div className="flex flex-col h-full bg-white w-full overflow-hidden" onClick={clearSelection}>
      
      {/* PORTALE DI STAMPA */}
      {showPrintPreview && printRoot && createPortal(
          <div className="bg-white w-full">
             {printLayoutMode === 'VISUAL' && <PrintLayout />}
             {printLayoutMode === 'TIMESHEET' && <TimesheetPrintLayout />}
             {printLayoutMode === 'PERSONAL' && <PersonalCalendarPrintLayout operatorId={exportSelectedOpId} />}
          </div>,
          printRoot
      )}

      {/* Anteprima di Stampa Modal */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md overflow-auto flex flex-col no-print animate-in fade-in duration-300">
           <div className="shrink-0 p-4 border-b border-slate-700 bg-slate-800 text-white flex justify-between items-center sticky top-0 z-50 shadow-2xl">
              <div className="flex items-center gap-3">
                  <Printer className="text-blue-400" />
                  <h2 className="font-bold text-lg">Anteprima di Stampa</h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-700 p-1 rounded-md">
                 <button onClick={() => setPrintLayoutMode('VISUAL')} className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${printLayoutMode === 'VISUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Planner Visivo</button>
                 <button onClick={() => setPrintLayoutMode('TIMESHEET')} className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${printLayoutMode === 'TIMESHEET' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Cartellino Ore</button>
                 <button onClick={() => setPrintLayoutMode('PERSONAL')} className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${printLayoutMode === 'PERSONAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Calendario Muro</button>
              </div>
              <div className="flex gap-3">
                 <Button variant="secondary" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white border-none">Stampa Ora</Button>
                 <Button variant="danger" onClick={() => setShowPrintPreview(false)}>Chiudi</Button>
              </div>
           </div>
           <div className="flex-1 p-10 bg-slate-200/50 flex justify-center overflow-auto">
              <div className="bg-white shadow-2xl transform scale-[0.65] md:scale-[0.85] origin-top mb-20 ring-1 ring-black/10">
                 {printLayoutMode === 'VISUAL' && <PrintLayout />}
                 {printLayoutMode === 'TIMESHEET' && <TimesheetPrintLayout />}
                 {printLayoutMode === 'PERSONAL' && <PersonalCalendarPrintLayout operatorId={exportSelectedOpId} />}
              </div>
           </div>
        </div>
      )}

      {/* Toolbar Toolbar Toolbar */}
      <div className="p-3 md:p-4 border-b border-slate-200 bg-white shadow-sm z-40 flex flex-wrap items-center justify-between no-print gap-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
              {/* Sync & History */}
              <div className="flex items-center gap-1 mr-2">
                 <button onClick={() => saveToCloud(true)} disabled={syncStatus === 'SYNCING'} className="p-2 hover:bg-slate-100 rounded transition-colors" title="Salva su Cloud">
                    {syncStatus === 'SYNCING' ? <Loader2 size={18} className="animate-spin text-blue-500" /> : <Cloud size={18} className="text-slate-400" />}
                 </button>
                 <div className="h-6 w-px bg-slate-200 mx-1"></div>
                 <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!history.canUndo} className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30"><Undo size={16}/></button>
                 <button onClick={() => dispatch({ type: 'REDO' })} disabled={!history.canRedo} className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30"><Redo size={16}/></button>
              </div>

              {/* View Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setViewSpan('MONTH')} className={`p-1.5 rounded transition-all ${viewSpan === 'MONTH' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}><CalendarDays size={16}/></button>
                  <button onClick={() => setViewSpan('WEEK')} className={`p-1.5 rounded transition-all ${viewSpan === 'WEEK' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}><Columns size={16}/></button>
              </div>

              {/* Month Nav */}
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  <button onClick={handlePrev} className="p-1 hover:bg-white rounded"><ChevronLeft size={16} /></button>
                  <span className="px-3 font-bold text-slate-700 capitalize min-w-[120px] md:min-w-[160px] text-center text-sm md:text-base">{getHeaderLabel()}</span>
                  <button onClick={handleNext} className="p-1 hover:bg-white rounded"><ChevronRight size={16} /></button>
              </div>
              <Button variant="secondary" onClick={handleToday} className="text-xs py-1.5 h-auto">Oggi</Button>

              <select className="text-sm font-bold bg-slate-50 border border-slate-200 p-1.5 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" value={displayMode} onChange={(e) => setDisplayMode(e.target.value as any)}>
                  <option value="PLANNER_STANDARD">Standard</option>
                  <option value="PLANNER_DETAILED">Dettagliato</option>
                  <option value="MATRIX_ONLY">Solo Matrice</option>
              </select>
          </div>

          <div className="flex items-center gap-2">
              <div className="relative">
                  <Button variant={highlightPast ? 'primary' : 'secondary'} className="p-2 h-9" onClick={() => setHighlightPast(!highlightPast)} title="Evidenzia Passato">
                      <History size={18} />
                  </Button>
              </div>

              {/* Filter Button */}
              <div className="relative">
                <Button variant="secondary" className={`p-2 h-9 flex items-center gap-2 ${searchTerm || filterStatus !== 'ACTIVE' ? 'border-blue-500 bg-blue-50' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                    <Filter size={18} />
                </Button>
                {showFilters && (
                    <div className="absolute top-full right-0 mt-2 p-4 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] w-64 space-y-4 animate-in zoom-in-95 duration-150">
                        <Input label="Cerca" placeholder="Nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="text-xs" />
                        <Select label="Stato" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="text-xs">
                            <option value="ACTIVE">Attivi</option>
                            <option value="INACTIVE">Inattivi</option>
                            <option value="ALL">Tutti</option>
                            <option value="MODIFIED">Solo Modificati</option>
                        </Select>
                        <Select label="Matrice" value={filterMatrix} onChange={e => setFilterMatrix(e.target.value)} className="text-xs">
                            <option value="ALL">Tutte</option>
                            {state.matrices.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </Select>
                        <Button variant="ghost" className="w-full text-xs" onClick={() => {setSearchTerm(''); setFilterStatus('ACTIVE'); setFilterMatrix('ALL');}}>Reset</Button>
                    </div>
                )}
              </div>

              <div className="h-6 w-px bg-slate-200 mx-1"></div>

              {/* Actions */}
              <Button variant="secondary" onClick={() => {}} title="Invia a Google Sheets" className="p-2 h-9 text-emerald-600 border-emerald-100 hover:bg-emerald-50"><Send size={18} /></Button>
              <Button variant="secondary" onClick={handleExportCSV} title="Scarica CSV" className="p-2 h-9"><FileSpreadsheet size={18} /></Button>
              <Button variant="secondary" onClick={() => setShowPersonalExportModal(true)} title="Esporta PDF Operatore" className="p-2 h-9"><Share2 size={18} /></Button>
              <Button variant="secondary" onClick={() => setShowPrintPreview(true)} title="Stampa Planner" className="p-2 h-9 bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100"><Printer size={18} /></Button>
          </div>
      </div>

      {/* Multi-Selection Toolbar (Floating) */}
      {multiSelection && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Selezione Multipla:</span>
              <div className="flex gap-2">
                  <button onClick={() => {setClipboard(eachDayOfInterval({start: parseISO(multiSelection.start), end: parseISO(multiSelection.end)}).map(d => {const e = getEntry(state, multiSelection.opId, formatDateKey(d)); return e?.shiftCode || '';})); setMultiSelection(null);}} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg text-sm font-bold"><Copy size={16}/> Copia</button>
                  <button onClick={() => {const dates = eachDayOfInterval({start: parseISO(multiSelection.start), end: parseISO(multiSelection.end)}); const updates: PlannerEntry[] = []; const op = state.operators.find(o => o.id === multiSelection.opId); if(op) { dates.forEach(d => { const dk = formatDateKey(d); const mx = calculateMatrixShift(op, dk, state.matrices); if(mx) updates.push({operatorId: op.id, date: dk, shiftCode: mx, isManual: true}); }); if(updates.length) dispatch({type: 'BATCH_UPDATE', payload: updates}); } setMultiSelection(null);}} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg text-sm font-bold"><CheckCheck size={16}/> Consolida</button>
                  <button onClick={() => setMultiSelection(null)} className="p-1.5 hover:bg-red-500 rounded-full transition-colors"><X size={16}/></button>
              </div>
          </div>
      )}

      {/* Grid Grid Grid */}
      <div className="flex-1 overflow-auto relative custom-scrollbar no-print" ref={gridScrollRef}>
          <div className="min-w-max">
                <div className="flex h-10 bg-slate-100 border-b border-slate-300 sticky top-0 z-30 shadow-sm">
                    <div className="w-48 bg-slate-100 border-r border-slate-300 flex items-center pl-4 font-bold text-slate-700 sticky left-0 z-40 shadow-sm">Operatore</div>
                    <div className="w-14 flex items-center justify-center font-bold text-xs text-slate-600 border-r bg-slate-50">Ore</div>
                    {days.map(d => {
                        const dateKey = formatDateKey(d);
                        const isRed = isItalianHoliday(d);
                        const isTodayVal = isToday(d);
                        return (
                          <div 
                                key={dateKey} 
                                onClick={() => handleOpenDayNote(dateKey)}
                                className={`flex-1 min-w-[44px] flex flex-col items-center justify-center border-r border-slate-300 text-[10px] cursor-pointer transition-colors ${isTodayVal ? 'bg-blue-600 text-white' : isRed ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-200'}`}
                           >
                            <span className="font-bold">{ITALIAN_DAY_INITIALS[d.getDay()]}</span>
                            <span className="text-sm font-bold">{format(d, 'd')}</span>
                            {state.dayNotes[dateKey] && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-400 rounded-full"></div>}
                          </div>
                        );
                    })}
                </div>
                {sortedGroupKeys.map(groupKey => (
                    <React.Fragment key={groupKey}>
                        {groupByMatrix && (
                            <div className="sticky left-0 z-20 bg-slate-50/95 backdrop-blur px-4 py-1 text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 border-b tracking-widest">
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: state.matrices.find(m => m.id === groupKey)?.color || '#ccc'}}></div>
                                {state.matrices.find(m => m.id === groupKey)?.name || 'Nessuna Matrice / Altro'}
                            </div>
                        )}
                        {groupedOperators[groupKey].map(op => (
                            <div key={op.id} className="flex border-b border-slate-300 hover:bg-blue-50/30 h-10 md:h-8 group/row">
                                <div onClick={() => setDetailsOpId(op.id)} className="w-48 border-r bg-white sticky left-0 z-20 flex items-center px-4 font-medium text-sm truncate uppercase cursor-pointer hover:text-blue-600 hover:underline">
                                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${op.isActive ? 'bg-green-500' : 'bg-red-400'}`}></div>
                                    {op.lastName} {op.firstName}
                                </div>
                                <div className="w-14 border-r bg-slate-50/50 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover/row:bg-blue-50">160</div>
                                {days.map(d => renderCell(op, d))}
                            </div>
                        ))}
                    </React.Fragment>
                ))}
          </div>
      </div>

      {/* --- MODALS --- */}
      <Modal isOpen={showPersonalExportModal} onClose={() => setShowPersonalExportModal(false)} title="Esporta Calendario Operatore" className="max-w-lg">
          <div className="space-y-6 p-2">
               <div className="space-y-4">
                   <h4 className="font-black text-slate-700 text-sm uppercase">Scegli Operatore</h4>
                   <Select value={exportSelectedOpId} onChange={(e) => setExportSelectedOpId(e.target.value)}>
                       <option value="">-- Seleziona --</option>
                       {state.operators.filter(o => o.isActive).map(o => <option key={o.id} value={o.id}>{o.lastName} {o.firstName}</option>)}
                   </Select>
               </div>
               <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button variant="ghost" onClick={() => setShowPersonalExportModal(false)}>Annulla</Button>
                    <Button variant="primary" onClick={() => { setPrintLayoutMode('PERSONAL'); setShowPrintPreview(true); setShowPersonalExportModal(false); }}>Genera Anteprima</Button>
               </div>
          </div>
      </Modal>

      {/* Modale Dettaglio Operatore */}
      {detailsOpId && <OperatorDetailModal isOpen={!!detailsOpId} onClose={() => setDetailsOpId(null)} operatorId={detailsOpId} />}

      {/* Modale Nota Giorno */}
      <Modal isOpen={!!editingDayNote} onClose={() => setEditingDayNote(null)} title="Nota Giornaliera">
          {editingDayNote && (
              <div className="space-y-4">
                  <textarea 
                    className="w-full border rounded-lg p-3 h-32 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                    value={editingDayNote.note.text} 
                    onChange={e => setEditingDayNote({...editingDayNote, note: {...editingDayNote.note, text: e.target.value}})}
                    placeholder="Scrivi una nota per questo giorno..."
                  />
                  <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditingDayNote(null)}>Annulla</Button>
                      <Button variant="primary" onClick={() => { dispatch({type: 'UPDATE_DAY_NOTE', payload: {date: editingDayNote.date, note: editingDayNote.note}}); setEditingDayNote(null); }}>Salva</Button>
                  </div>
              </div>
          )}
      </Modal>

      {/* Modale Modifica Rapida (Popup) */}
      {selectedCell && cellPopupPosition && !multiSelection && (
          <div className="fixed z-[60] bg-white rounded-xl shadow-2xl border-2 border-slate-300 p-4 w-[300px] flex flex-col gap-3 animate-in zoom-in-95 duration-150" style={{ left: cellPopupPosition.x, top: cellPopupPosition.y, transform: 'translateX(-50%)' }}>
               <div className="flex justify-between items-center border-b pb-2">
                   <span className="font-black text-slate-800 text-sm uppercase truncate w-40">{state.operators.find(o => o.id === selectedCell.opId)?.lastName}</span>
                   <Badge color="bg-blue-600 text-white font-black">{format(parseISO(selectedCell.date), 'dd/MM')}</Badge>
               </div>
               <div className="grid grid-cols-4 gap-1">
                   {state.shiftTypes.map(s => <button key={s.id} onClick={() => {setDraftShift(s.code); saveChanges();}} className={`h-8 rounded font-black text-[10px] border transition-transform active:scale-95 ${getContrastColor(s.color)}`} style={{backgroundColor: s.color}} title={s.name}>{s.code}</button>)}
                   <button onClick={() => {setDraftShift('OFF'); saveChanges();}} className="h-8 rounded bg-slate-100 border font-bold text-[10px] hover:bg-slate-200">OFF</button>
               </div>
               <Input placeholder="Note rapide..." value={draftNote} onChange={e => setDraftNote(e.target.value)} onBlur={saveChanges} className="text-xs" />
               <div className="flex gap-2">
                   <Button onClick={() => {setDraftShift(''); setDraftNote(''); saveChanges();}} variant="danger" className="text-[10px] py-1 flex-1">Ripristina</Button>
                   <Button onClick={() => {setShowEditModal(true); setCellPopupPosition(null);}} variant="secondary" className="text-[10px] py-1 flex-1">Dettagli...</Button>
               </div>
          </div>
      )}
    </div>
  );

  function handleOpenDayNote(dateKey: string) {
      const existing = state.dayNotes[dateKey];
      const note: DayNote = typeof existing === 'string' ? {text: existing, type: 'INFO'} : (existing || {text: '', type: 'INFO'});
      setEditingDayNote({date: dateKey, note});
  }

  function renderCell(op: any, day: Date) {
    const dk = formatDateKey(day), employed = isOperatorEmployed(op, dk), entry = getEntry(state, op.id, dk), mx = calculateMatrixShift(op, dk, state.matrices), code = isMatrixView ? (mx || '') : (entry?.shiftCode ?? mx ?? ''), st = getShiftByCode(code, state.shiftTypes);
    const isSelected = selectedCell?.opId === op.id && selectedCell?.date === dk;
    const isPast = isBefore(day, new Date(new Date().setHours(0,0,0,0)));
    
    let multiSelected = false;
    if(multiSelection && multiSelection.opId === op.id) {
        const cur = parseISO(dk), s = parseISO(multiSelection.start), e = parseISO(multiSelection.end);
        if(isWithinInterval(cur, {start: s, end: e})) multiSelected = true;
    }

    if (!employed) return <div key={dk} className="flex-1 min-w-[44px] border-r border-slate-300 bg-slate-100 opacity-30" style={{backgroundImage: 'repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 2px, transparent 0, transparent 50%)', backgroundSize: '4px 4px'}}></div>;
    
    return (
      <div 
        key={dk} 
        onClick={(e) => handleCellClick(e, op.id, dk, employed)} 
        style={{ backgroundColor: isSelected ? '#3b82f6' : multiSelected ? '#dbeafe' : (st?.color || undefined), opacity: highlightPast && isPast ? 0.4 : 1 }} 
        className={`flex-1 min-w-[44px] border-r border-slate-300 flex items-center justify-center text-xs font-black transition-all cursor-pointer relative group/cell ${isSelected ? 'text-white z-10 scale-110 shadow-lg ring-2 ring-white' : multiSelected ? 'text-blue-800 ring-1 ring-inset ring-blue-400' : getContrastColor(st?.color)} hover:z-10 hover:scale-105`}
      >
          <span className={code === 'R' ? 'opacity-20' : ''}>{code}</span>
          {entry?.isManual && code !== mx && <div className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-l-[6px] border-t-red-500 border-l-transparent" title="Modifica Manuale"></div>}
          {entry?.note && <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-yellow-400" title={entry.note}></div>}
          {entry?.specialEvents?.length ? <div className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-indigo-500"></div> : null}
      </div>
    );
  }
};