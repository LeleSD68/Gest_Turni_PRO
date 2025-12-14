import React, { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, validateCell, getShiftByCode, getSuggestions, parseISO, isOperatorEmployed, getItalianHolidayName } from '../utils';
import { format, isToday, isWeekend, addMonths, differenceInDays, addDays, isWithinInterval, isSameMonth, isSunday, isBefore } from 'date-fns';
import { ChevronLeft, ChevronRight, Filter, Download, Zap, AlertTriangle, UserCheck, RefreshCw, Edit2, X, Info, Save, UserPlus, Check, ArrowRightLeft, Wand2, HelpCircle, Eye, RotateCcw, Copy, ClipboardPaste, CalendarClock, Clock, Layers, GitCompare, Layout, CalendarDays, Search, List, MousePointer2, Eraser, CalendarOff, BarChart3, UserCog, StickyNote, Printer, Plus, Trash2, Watch, Coins, ArrowUpCircle, ArrowRightCircle, FileSpreadsheet, Undo, Redo, ArrowRight, ChevronDown, ChevronUp, FileText, History, Menu, Settings2, XCircle, Share2, Send, Cloud, CloudOff, Loader2, CheckCircle } from 'lucide-react';
import { Button, Modal, Select, Input, Badge } from '../components/UI';
import { PlannerEntry, ViewMode, ShiftType, SpecialEvent, CoverageConfig } from '../types';
import { OperatorDetailModal } from '../components/OperatorDetailModal';
import { PrintLayout } from '../components/PrintLayout';
import { TimesheetPrintLayout } from '../components/TimesheetPrintLayout';

// Unified Display Mode Type
type DisplayMode = 'PLANNER_STANDARD' | 'PLANNER_MINIMAL' | 'PLANNER_DETAILED' | 'MATRIX_ONLY' | 'MATRIX_DIFF';

type LastOperation = {
    type: 'UPDATE';
    shiftCode: string;
    note?: string;
    variationReason?: string;
    customHours?: number;
    specialEvents?: SpecialEvent[];
} | {
    type: 'DELETE';
};

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export const Planner = () => {
  const { state, dispatch, history, syncStatus } = useApp();
  
  // State management
  const [displayMode, setDisplayMode] = useState<DisplayMode>('PLANNER_STANDARD');
  const [selectedCell, setSelectedCell] = useState<{ opId: string; date: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showPrevDays, setShowPrevDays] = useState(false);
  const [groupByMatrix, setGroupByMatrix] = useState(true);
  const [highlightPast, setHighlightPast] = useState(false); // Toggle visualizzazione passato
  
  // Mobile States
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(false);
  
  // Crosshair Highlight State
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  
  // Filters - Initialized from localStorage
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('planner_searchTerm') || '');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MODIFIED' | 'EXTRA'>(() => {
      const saved = localStorage.getItem('planner_filterStatus');
      return (['ALL', 'ACTIVE', 'INACTIVE', 'MODIFIED', 'EXTRA'].includes(saved || '')) ? saved as any : 'ACTIVE';
  });
  const [filterMatrix, setFilterMatrix] = useState<string>(() => localStorage.getItem('planner_filterMatrix') || 'ALL');
  
  // Persist filters to localStorage
  useEffect(() => { localStorage.setItem('planner_searchTerm', searchTerm); }, [searchTerm]);
  useEffect(() => { localStorage.setItem('planner_filterStatus', filterStatus); }, [filterStatus]);
  useEffect(() => { localStorage.setItem('planner_filterMatrix', filterMatrix); }, [filterMatrix]);

  // Coverage Detail State
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);

  // Print Preview State
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printLayoutMode, setPrintLayoutMode] = useState<'VISUAL' | 'TIMESHEET'>('VISUAL');

  // Helper to check if we are in a Matrix-based view logic
  const isMatrixView = displayMode === 'MATRIX_ONLY' || displayMode === 'MATRIX_DIFF';
  
  // Tooltip Position State
  const [tooltipPos, setTooltipPos] = useState<{x: number, y: number, isBottom: boolean} | null>(null);

  const [pendingSwap, setPendingSwap] = useState<{ source: { opId: string; date: string }, target: { opId: string; date: string } } | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  // Matrix Assignment State
  const [matrixAssignment, setMatrixAssignment] = useState<{ opId: string; date: string } | null>(null);
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>('');

  // Operator Detail Modal State
  const [detailsOpId, setDetailsOpId] = useState<string | null>(null);
  
  // Quick Note Modal State (Operator)
  const [noteOpId, setNoteOpId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Day Note Modal State (Calendar Day)
  const [editingDayNote, setEditingDayNote] = useState<{ date: string; text: string } | null>(null);

  // Multi-selection & Clipboard State
  const [multiSelection, setMultiSelection] = useState<{ opId: string, start: string, end: string } | null>(null);
  const [clipboard, setClipboard] = useState<string[] | null>(null);

  // Drag and Drop State
  const [draggingCell, setDraggingCell] = useState<{ opId: string; date: string } | null>(null);
  // Swap Source State (for manual button mode if needed)
  const [swapSource, setSwapSource] = useState<{ opId: string; date: string } | null>(null);
  
  // Last Operation State (For Right Click Repeat)
  const [lastOperation, setLastOperation] = useState<LastOperation | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Edit Modal Draft State
  const [draftShift, setDraftShift] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftVariationReason, setDraftVariationReason] = useState('');
  const [draftCustomHours, setDraftCustomHours] = useState<number | undefined>(undefined);
  
  // Special Events Draft State
  const [draftSpecialEvents, setDraftSpecialEvents] = useState<SpecialEvent[]>([]);
  // Mini-form for adding new special event
  const [newSpecialType, setNewSpecialType] = useState('Straordinario');
  const [newSpecialStart, setNewSpecialStart] = useState('');
  const [newSpecialEnd, setNewSpecialEnd] = useState('');
  const [newSpecialHours, setNewSpecialHours] = useState<number | ''>(''); // Allow manual override
  const [newSpecialMode, setNewSpecialMode] = useState<'ADDITIVE' | 'SUBSTITUTIVE'>('ADDITIVE');
  const [isSpecialMode, setIsSpecialMode] = useState(false);

  // --- Derived Data ---
  const currentMonthDays = useMemo(() => getMonthDays(state.currentDate), [state.currentDate]);
  
  const days = useMemo(() => {
      if (!showPrevDays) return currentMonthDays;
      const firstDay = currentMonthDays[0];
      const prevDays = [
          addDays(firstDay, -3),
          addDays(firstDay, -2),
          addDays(firstDay, -1),
      ];
      return [...prevDays, ...currentMonthDays];
  }, [currentMonthDays, showPrevDays]);
  
  // Filtered Operators
  const filteredOperators = useMemo(() => {
      return state.operators.filter(op => {
          // 1. Status Filter
          if (filterStatus === 'ACTIVE' && !op.isActive) return false;
          if (filterStatus === 'INACTIVE' && op.isActive) return false;
          
          if (filterStatus === 'MODIFIED') {
              if (!op.isActive) return false; // Show only active modified by default
              const hasModification = days.some(d => {
                  const dateKey = formatDateKey(d);
                  const entry = getEntry(state, op.id, dateKey);
                  // Consider modified if manual, has variation reason, or special events
                  return entry && (entry.isManual || !!entry.variationReason || (entry.specialEvents && entry.specialEvents.length > 0));
              });
              if (!hasModification) return false;
          }

          if (filterStatus === 'EXTRA') {
              if (!op.isActive) return false;
              const hasExtra = days.some(d => {
                  const dateKey = formatDateKey(d);
                  const entry = getEntry(state, op.id, dateKey);
                  return entry?.specialEvents && entry.specialEvents.length > 0;
              });
              if (!hasExtra) return false;
          }
          
          // 2. Matrix Filter
          if (filterMatrix !== 'ALL' && op.matrixId !== filterMatrix) return false; 

          // 3. Search Term
          if (searchTerm) {
              const fullName = `${op.lastName} ${op.firstName}`.toLowerCase();
              if (!fullName.includes(searchTerm.toLowerCase())) return false;
          }

          return true;
      });
  }, [state.operators, filterStatus, filterMatrix, searchTerm, days, state.plannerData]);

  // Group Operators by Matrix
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
          
          // MODIFICA: Ordina in base alla posizione nell'array state.matrices (ordine di inserimento)
          const indexA = state.matrices.findIndex(m => m.id === a);
          const indexB = state.matrices.findIndex(m => m.id === b);
          
          if (indexA === -1 && indexB !== -1) return 1;
          if (indexA !== -1 && indexB === -1) return -1;
          
          return indexA - indexB;
      });
  }, [groupedOperators, state.matrices, groupByMatrix]);


  // Calculate coverage based on the current view mode
  const dailyCoverage = useMemo(() => {
      const map: Record<string, Record<string, number>> = {};
      
      days.forEach(day => {
          const dateKey = formatDateKey(day);
          map[dateKey] = {};
          
          state.operators.filter(o => o.isActive).forEach(op => {
              if (!isOperatorEmployed(op, dateKey)) return;

              const entry = getEntry(state, op.id, dateKey);
              const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
              let code = '';

              if (isMatrixView) {
                  code = matrixShift || '';
              } else {
                  if (entry) {
                      code = entry.shiftCode;
                  } else if (matrixShift) {
                      code = matrixShift; 
                  }
              }

              if (code) {
                  map[dateKey][code] = (map[dateKey][code] || 0) + 1;
              }
          });
      });
      return map;
  }, [days, state.operators, state.plannerData, state.matrices, displayMode]);

  // --- Helper for Aggregation ---
  const getGroupedCoverage = (dateKey: string, configKey: string) => {
      const counts = dailyCoverage[dateKey] || {};
      let mainCount = 0;
      let supportCount = 0;
      let supportLabel = '';

      if (configKey === 'M8') {
          mainCount = (counts['M6'] || 0) + (counts['M7'] || 0) + (counts['M7-'] || 0) + (counts['M8'] || 0) + (counts['M8-'] || 0);
          supportCount = counts['DM'] || 0;
          supportLabel = 'DM';
      } else if (configKey === 'P') {
          mainCount = (counts['P'] || 0) + (counts['P-'] || 0);
          supportCount = counts['DP'] || 0;
          supportLabel = 'DP';
      } else {
          mainCount = counts[configKey] || 0;
      }
      return { mainCount, supportCount, supportLabel };
  };

  const calculateDuration = (start: string, end: string) => {
      if (!start || !end) return 0;
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      let diff = (h2 + m2/60) - (h1 + m1/60);
      if (diff < 0) diff += 24; // Handle overnight
      return parseFloat(diff.toFixed(2));
  };

  // --- Effects ---
  useEffect(() => {
    if (editMode && selectedCell) {
        const entry = getEntry(state, selectedCell.opId, selectedCell.date);
        const matrixShift = calculateMatrixShift(state.operators.find(o => o.id === selectedCell.opId)!, selectedCell.date, state.matrices);
        
        const shiftCode = entry?.shiftCode ?? matrixShift ?? '';
        const defaultShift = state.shiftTypes.find(s => s.code === shiftCode);
        
        setDraftShift(shiftCode);
        setDraftNote(entry?.note ?? '');
        setDraftVariationReason(entry?.variationReason ?? '');
        setDraftCustomHours(entry?.customHours ?? defaultShift?.hours);
        setDraftSpecialEvents(entry?.specialEvents || []);
        setIsSpecialMode((entry?.specialEvents && entry.specialEvents.length > 0) || false);
        setNewSpecialHours(''); // Reset form
        setNewSpecialStart('');
        setNewSpecialEnd('');
        setNewSpecialMode('ADDITIVE');
        setShowSuggest(false); // Reset suggestion view
    }
  }, [editMode, selectedCell, state]);

  // Auto-calculate hours when times change
  useEffect(() => {
      if (newSpecialStart && newSpecialEnd) {
          const dur = calculateDuration(newSpecialStart, newSpecialEnd);
          setNewSpecialHours(dur);
      }
  }, [newSpecialStart, newSpecialEnd]);

  // --- Helper Functions ---
  const getActiveShift = (opId: string, date: string) => {
    const op = state.operators.find(o => o.id === opId);
    if (!op) return '';
    const entry = getEntry(state, opId, date);
    if (entry) return entry.shiftCode;
    return calculateMatrixShift(op, date, state.matrices) || '';
  };

  const getContrastColor = (hexColor?: string) => {
      if (!hexColor) return 'text-slate-700';
      const r = parseInt(hexColor.substring(1, 3), 16);
      const g = parseInt(hexColor.substring(3, 5), 16);
      const b = parseInt(hexColor.substring(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? 'text-slate-900' : 'text-white';
  };

  // --- Sync with Google Sheets via Web App ---
  const handleExportForGoogleSheets = async () => {
        if (!state.config.googleScriptUrl) {
            alert("Errore: Non hai configurato l'URL dello script Google.\nVai in Configurazione > Integrazioni e segui le istruzioni.");
            return;
        }

        const days = currentMonthDays;
        const d = parseISO(state.currentDate);
        const capMonthYear = `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

        // Prepare Data for Google Sheets (2D Array)
        const rows: any[][] = [];

        // Map for Day Headers: L, M, M, G, V, S, D
        const getDayLetter = (d: Date) => {
            const dayIdx = d.getDay(); 
            const map = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
            return map[dayIdx];
        };

        // Header Row 1: Month Year
        const header1 = [capMonthYear, '', ...days.map(d => format(d, 'd'))];
        rows.push(header1);

        // Header Row 2: Letters
        const header2 = ['Operatore', 'Ore Totali', ...days.map(d => getDayLetter(d))];
        rows.push(header2);

        // Data Rows
        filteredOperators.forEach(op => {
            const name = `${op.lastName} ${op.firstName}`.toUpperCase();
            
            // Calculate Total Hours for the month row
            const totalHours = days.reduce((acc, d) => {
                const dateKey = formatDateKey(d);
                if (!isOperatorEmployed(op, dateKey)) return acc;
                const entry = getEntry(state, op.id, dateKey);
                const shiftCode = entry?.shiftCode || calculateMatrixShift(op, dateKey, state.matrices) || '';
                const shift = getShiftByCode(shiftCode, state.shiftTypes);
                
                let hours = entry?.customHours;
                if (hours === undefined && shift?.inheritsHours) {
                    const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
                    const matrixShift = getShiftByCode(matrixCode || '', state.shiftTypes);
                    if (matrixShift) hours = matrixShift.hours;
                }
                hours = hours ?? shift?.hours ?? 0;
                
                const special = entry?.specialEvents?.reduce((s, ev) => (ev.mode === 'ADDITIVE' || !ev.mode) ? s + ev.hours : s, 0) ?? 0;
                return acc + hours + special;
            }, 0);

            // Shift Codes
            const shiftCells = days.map(d => {
                const dateKey = formatDateKey(d);
                if (!isOperatorEmployed(op, dateKey)) return '';
                const entry = getEntry(state, op.id, dateKey);
                const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
                return entry?.shiftCode || matrixShift || '';
            });

            const hoursStr = totalHours.toFixed(1).replace('.', ',');
            rows.push([name, hoursStr, ...shiftCells]);
        });

        // Send Data to Google Apps Script
        const btn = document.getElementById('export-btn');
        if (btn) btn.innerHTML = 'Invio in corso...';

        try {
            // Using no-cors might be needed if script isn't handling OPTIONS correctly, 
            // but text/plain usually avoids preflight.
            await fetch(state.config.googleScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', 
                },
                body: JSON.stringify({ values: rows })
            });
            alert('Dati inviati a Google Sheets con successo! Il foglio si aggiornerà in pochi secondi.');
        } catch (error) {
            console.error('Error sending data:', error);
            // Even if fetch fails due to CORS opaque response, it often succeeds on the server side with GAS.
            // But let's warn the user.
            alert('Comando inviato. Se non vedi aggiornamenti entro 10 secondi, controlla la configurazione dello script su Google.');
        } finally {
            if (btn) btn.innerHTML = 'Condividi';
        }
  };

  // --- Handlers ---
  const clearSelection = () => {
    setSelectedCell(null);
    setEditMode(false);
    setTooltipPos(null);
    setMultiSelection(null);
  };

  const handlePrevMonth = () => {
    dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), -1), 'yyyy-MM-dd') });
    clearSelection();
  };

  const handleNextMonth = () => {
    dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), 1), 'yyyy-MM-dd') });
    clearSelection();
  };

  const handleToday = () => {
    dispatch({ type: 'SET_DATE', payload: format(new Date(), 'yyyy-MM-01') });
    clearSelection();
  };

  const handleExportCSV = () => {
      const headerRow = ['Cognome Nome', 'Totale Ore', ...currentMonthDays.map(d => format(d, 'dd/MM'))].join(',');
      const rows = filteredOperators.map(op => {
          const totalHours = currentMonthDays.reduce((acc, d) => {
              const dateKey = formatDateKey(d);
              if (!isOperatorEmployed(op, dateKey)) return acc;
              const entry = getEntry(state, op.id, dateKey);
              const shiftCode = entry?.shiftCode || calculateMatrixShift(op, dateKey, state.matrices) || '';
              const shift = getShiftByCode(shiftCode, state.shiftTypes);
              const baseHours = entry?.customHours ?? shift?.hours ?? 0;
              const specialHours = entry?.specialEvents?.reduce((s, ev) => (ev.mode === 'ADDITIVE' || !ev.mode) ? s + ev.hours : s, 0) ?? 0;
              return acc + baseHours + specialHours;
          }, 0);

          const dayCells = currentMonthDays.map(d => {
              const dateKey = formatDateKey(d);
              if (!isOperatorEmployed(op, dateKey)) return 'X'; 
              const entry = getEntry(state, op.id, dateKey);
              const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
              let code = entry?.shiftCode || matrixShift || '';
              if (entry?.specialEvents && entry.specialEvents.length > 0) code += '*';
              return code;
          });

          return [`"${op.lastName} ${op.firstName}"`, totalHours, ...dayCells].join(',');
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headerRow, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `turni_${format(parseISO(state.currentDate), 'MM_yyyy')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleCellClick = (e: React.MouseEvent, opId: string, date: string, isEmployed: boolean) => {
    if (!isEmployed) return;

    if (isMatrixView) {
        setMatrixAssignment({ opId, date });
        const op = state.operators.find(o => o.id === opId);
        setSelectedMatrixId(op?.matrixId || '');
        return;
    }

    if (e.shiftKey && selectedCell && selectedCell.opId === opId) {
        const d1 = parseISO(selectedCell.date);
        const d2 = parseISO(date);
        const start = d1 < d2 ? selectedCell.date : date;
        const end = d1 < d2 ? date : selectedCell.date;
        setMultiSelection({ opId, start, end });
        setTooltipPos(null);
        return;
    }

    if (swapSource) {
        if (swapSource.opId === opId && swapSource.date === date) {
            setSwapSource(null); 
        } else {
            setPendingSwap({ source: swapSource, target: { opId, date } });
            setSwapSource(null);
        }
        return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    let left = rect.left + rect.width / 2;
    
    // Check if on mobile to adjust tooltip position
    const isMobile = window.innerWidth < 768;
    const isNearBottom = rect.bottom > window.innerHeight - 250;
    
    // On mobile, center tooltip or adjust to avoid offscreen
    if (isMobile) {
        left = window.innerWidth / 2; // Center on screen for mobile
    }

    let top = isNearBottom ? rect.top - 8 : rect.bottom + 8;

    setTooltipPos({ x: left, y: top, isBottom: isNearBottom });
    setSelectedCell({ opId, date });
    setMultiSelection(null);
    setEditMode(false);
  };

  const handleRightClick = (e: React.MouseEvent, opId: string, date: string, isEmployed: boolean) => {
      e.preventDefault();
      
      if (!isEmployed) return;
      if (isMatrixView) return; 
      
      if (!lastOperation) return;

      if (lastOperation.type === 'DELETE') {
          dispatch({ type: 'REMOVE_CELL', payload: { operatorId: opId, date } });
      } else {
          // --- SUNDAY VACATION RULE ---
          let codeToApply = lastOperation.shiftCode;
          if (codeToApply && codeToApply.startsWith('F') && isSunday(parseISO(date))) {
              codeToApply = 'R';
          }
          
          let hoursToApply = lastOperation.customHours;
          const sType = state.shiftTypes.find(s => s.code === codeToApply);
          
          // Re-calculate hours if the shift type inherits (e.g., F, MAL)
          if (sType?.inheritsHours) {
              const operator = state.operators.find(o => o.id === opId);
              if (operator) {
                  const matrixCode = calculateMatrixShift(operator, date, state.matrices);
                  const matrixShift = state.shiftTypes.find(s => s.code === matrixCode);
                  if (matrixShift) {
                      hoursToApply = matrixShift.hours;
                  }
              }
          }

          const violation = validateCell(state, opId, date, codeToApply);
          
          const newEntry: PlannerEntry = {
              operatorId: opId,
              date: date,
              shiftCode: codeToApply,
              note: lastOperation.note,
              isManual: true,
              violation: violation || undefined,
              variationReason: lastOperation.variationReason,
              customHours: hoursToApply,
              specialEvents: lastOperation.specialEvents
          };
          
          dispatch({ type: 'UPDATE_CELL', payload: newEntry });
      }
      clearSelection();
  };

  const handleCellDoubleClick = () => {
    if (!isMatrixView) {
        setEditMode(true);
    }
  };

  const handleConfirmMatrixAssignment = () => {
      if (!matrixAssignment || !selectedMatrixId) return;
      const op = state.operators.find(o => o.id === matrixAssignment.opId);
      if (!op) return;

      const newHistory = [...(op.matrixHistory || [])];
      const newStart = matrixAssignment.date;
      newHistory.sort((a, b) => a.startDate.localeCompare(b.startDate));
      const newDateObj = parseISO(newStart);

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
      const filteredHistory = newHistory.filter(a => a.startDate < newStart);

      filteredHistory.push({
          id: crypto.randomUUID(),
          matrixId: selectedMatrixId,
          startDate: newStart,
          endDate: undefined
      });

      const updatedOp = {
          ...op,
          matrixHistory: filteredHistory,
          matrixId: selectedMatrixId, 
          matrixStartDate: newStart 
      };

      dispatch({ type: 'UPDATE_OPERATOR', payload: updatedOp });
      
      dispatch({
          type: 'ADD_LOG',
          payload: {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              operatorId: op.id,
              actionType: 'UPDATE',
              reason: `Assegnata matrice ${state.matrices.find(m => m.id === selectedMatrixId)?.name} dal ${matrixAssignment.date}`,
              user: 'CurrentUser'
          }
      });

      setMatrixAssignment(null);
  };

  const handleCopySelection = () => {
      if (!multiSelection) return;
      
      const { opId, start, end } = multiSelection;
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      const diff = differenceInDays(endDate, startDate);
      
      const copiedShifts: string[] = [];
      
      for (let i = 0; i <= diff; i++) {
          const currentDate = addDays(startDate, i);
          const dateKey = formatDateKey(currentDate);
          copiedShifts.push(getActiveShift(opId, dateKey));
      }
      
      setClipboard(copiedShifts);
      clearSelection();
  };

  const handlePasteSelection = () => {
      if (!clipboard || !selectedCell) return;
      
      const targetStartDate = parseISO(selectedCell.date);
      const updates: PlannerEntry[] = [];
      
      clipboard.forEach((code, index) => {
          const targetDate = addDays(targetStartDate, index);
          const dateKey = formatDateKey(targetDate);
          
          const op = state.operators.find(o => o.id === selectedCell.opId);
          if (op && !isOperatorEmployed(op, dateKey)) return;

          // Re-calculate hours if inheritance
          let customHours = undefined;
          const sType = state.shiftTypes.find(s => s.code === code);
          if (sType?.inheritsHours && op) {
              const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
              const matrixShift = state.shiftTypes.find(s => s.code === matrixCode);
              if (matrixShift) {
                  customHours = matrixShift.hours;
              }
          }

          updates.push({
              operatorId: selectedCell.opId,
              date: dateKey,
              shiftCode: code,
              isManual: true,
              note: 'Incollato',
              customHours: customHours
          });
      });
      
      if (updates.length > 0) {
          dispatch({ type: 'BATCH_UPDATE', payload: updates });
      }
      clearSelection();
  };

  const handleDraftShiftSelection = (s: ShiftType) => {
    setDraftShift(s.code);
    setDraftVariationReason('');
    
    // Auto-open suggestions if it's an absence (hours = 0)
    if (s.hours === 0) {
        setShowSuggest(true);
    }
    
    let targetHours = s.hours;

    if (s.inheritsHours && selectedCell) {
        const op = state.operators.find(o => o.id === selectedCell.opId);
        if (op) {
            const matrixCode = calculateMatrixShift(op, selectedCell.date, state.matrices);
            if (matrixCode) {
                const matrixShift = state.shiftTypes.find(ms => ms.code === matrixCode);
                if (matrixShift) {
                    targetHours = matrixShift.hours;
                }
            }
        }
    }
    setDraftCustomHours(targetHours);
  };

  const handleAddSpecialEvent = () => {
      if (newSpecialHours === '' && (!newSpecialStart || !newSpecialEnd)) return;
      
      const hours = typeof newSpecialHours === 'number' ? newSpecialHours : 0;
      
      const newEvent: SpecialEvent = {
          id: crypto.randomUUID(),
          type: newSpecialType,
          startTime: newSpecialStart,
          endTime: newSpecialEnd,
          hours: hours,
          mode: newSpecialMode
      };

      setDraftSpecialEvents([...draftSpecialEvents, newEvent]);
      setNewSpecialStart('');
      setNewSpecialEnd('');
      setNewSpecialHours('');
      setNewSpecialMode('ADDITIVE');
  };

  const handleRemoveSpecialEvent = (id: string) => {
      setDraftSpecialEvents(draftSpecialEvents.filter(ev => ev.id !== id));
  };

  const handleToggleGettone = () => {
      const hasGettone = draftSpecialEvents.some(ev => ev.type === 'Gettone');
      if (hasGettone) {
          setDraftSpecialEvents(draftSpecialEvents.filter(ev => ev.type !== 'Gettone'));
      } else {
          const newEvent: SpecialEvent = {
              id: crypto.randomUUID(),
              type: 'Gettone',
              startTime: '', 
              endTime: '',
              hours: 0, 
              mode: 'ADDITIVE'
          };
          setDraftSpecialEvents([...draftSpecialEvents, newEvent]);
      }
  };

  const handleBulkApply = (shiftCode: string) => {
      if (!multiSelection) return;
      const { opId, start, end } = multiSelection;
      const op = state.operators.find(o => o.id === opId);
      
      if (shiftCode) {
         setLastOperation({
             type: 'UPDATE',
             shiftCode: shiftCode,
             note: 'Assegnazione Multipla'
         });
      } else {
         setLastOperation({ type: 'DELETE' });
      }

      const startDate = parseISO(start);
      const endDate = parseISO(end);
      const diff = differenceInDays(endDate, startDate);
      const updates: PlannerEntry[] = [];
      
      const isVacation = shiftCode && shiftCode.startsWith('F');
      const shiftType = state.shiftTypes.find(s => s.code === shiftCode);

      if (!shiftCode) {
          for (let i = 0; i <= diff; i++) {
            const currentDate = addDays(startDate, i);
            const dateKey = formatDateKey(currentDate);
            if (op && isOperatorEmployed(op, dateKey)) {
                dispatch({ type: 'REMOVE_CELL', payload: { operatorId: opId, date: dateKey } });
            }
          }
      } else {
          for (let i = 0; i <= diff; i++) {
              const currentDate = addDays(startDate, i);
              const dateKey = formatDateKey(currentDate);
              
              if (op && isOperatorEmployed(op, dateKey)) {
                  let codeToApply = shiftCode;
                  if (isVacation && isSunday(currentDate)) {
                      codeToApply = 'R';
                  }

                  let customHours = shiftType?.hours;
                  
                  // Dynamic Hours Calculation for Bulk Apply (Inheritance)
                  if (shiftType?.inheritsHours) {
                      const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
                      const matrixShift = state.shiftTypes.find(s => s.code === matrixCode);
                      if (matrixShift) {
                          customHours = matrixShift.hours;
                      }
                  }

                  const violation = validateCell(state, opId, dateKey, codeToApply);
                  updates.push({
                      operatorId: opId,
                      date: dateKey,
                      shiftCode: codeToApply,
                      isManual: true,
                      note: 'Assegnazione Multipla',
                      violation: violation || undefined,
                      customHours: customHours
                  });
              }
          }
          if (updates.length > 0) {
              dispatch({ type: 'BATCH_UPDATE', payload: updates });
          }
      }

      setShowBulkModal(false);
      clearSelection();
  };

  const handleDragStart = (e: React.DragEvent, opId: string, date: string, isEmployed: boolean) => {
      if (isMatrixView || !isEmployed) return; 
      const data = JSON.stringify({ opId, date });
      e.dataTransfer.setData('application/json', data);
      e.dataTransfer.effectAllowed = 'move';
      setDraggingCell({ opId, date });
      clearSelection();
  };

  const handleDragOver = (e: React.DragEvent) => {
      if (isMatrixView) return;
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetOpId: string, targetDate: string, isEmployed: boolean) => {
      if (isMatrixView || !isEmployed) return;
      e.preventDefault();
      const dataStr = e.dataTransfer.getData('application/json');
      setDraggingCell(null);
      if (!dataStr) return;
      try {
          const source = JSON.parse(dataStr);
          if (source.opId === targetOpId && source.date === targetDate) return;
          setPendingSwap({ source: source, target: { opId: targetOpId, date: targetDate } });
      } catch (err) {
          console.error("Drag drop parse error", err);
      }
  };

  const handleDragEnd = () => setDraggingCell(null);
  const handleApplyMatricesClick = () => setShowMatrixModal(true);

  const executeApplyMatrices = () => {
      const newEntries: PlannerEntry[] = [];
      let count = 0;
      const tempPlannerData = { ...state.plannerData };
      const tempState = { ...state, plannerData: tempPlannerData };

      state.operators.forEach(op => {
          if (!op.isActive) return;
          days.forEach(day => {
              const dateKey = formatDateKey(day);
              if (!isOperatorEmployed(op, dateKey)) return;

              if (getEntry(state, op.id, dateKey)) return;
              const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
              if (matrixCode) {
                  const violation = validateCell(tempState, op.id, dateKey, matrixCode);
                  const newEntry: PlannerEntry = {
                      operatorId: op.id,
                      date: dateKey,
                      shiftCode: matrixCode,
                      isManual: false,
                      note: '',
                      violation: violation || undefined
                  };
                  newEntries.push(newEntry);
                  tempPlannerData[`${op.id}_${dateKey}`] = newEntry;
                  count++;
              }
          });
      });

      if (newEntries.length > 0) {
          dispatch({ type: 'BATCH_UPDATE', payload: newEntries });
          setShowMatrixModal(false);
      } else {
          setShowMatrixModal(false);
      }
  };

  const executeSwap = () => {
    if (!pendingSwap) return;
    const { source, target } = pendingSwap;
    const shiftA = getActiveShift(source.opId, source.date);
    const shiftB = getActiveShift(target.opId, target.date);
    const opA = state.operators.find(o => o.id === source.opId);
    const opB = state.operators.find(o => o.id === target.opId);
    
    const updateA: PlannerEntry = { operatorId: source.opId, date: source.date, shiftCode: shiftB, isManual: true, note: `Scambio con ${opB?.lastName || 'Collega'}` };
    const updateB: PlannerEntry = { operatorId: target.opId, date: target.date, shiftCode: shiftA, isManual: true, note: `Scambio con ${opA?.lastName || 'Collega'}` };

    dispatch({ type: 'BATCH_UPDATE', payload: [updateA, updateB] });
    setPendingSwap(null);
  };

  // New function for overwrite/copy
  const executeOverwrite = () => {
    if (!pendingSwap) return;
    const { source, target } = pendingSwap;
    const sourceShift = getActiveShift(source.opId, source.date);
    const targetOp = state.operators.find(o => o.id === target.opId);
    const sourceOp = state.operators.find(o => o.id === source.opId);
    
    // Determine if applying SUNDAY VACATION RULE during Copy
    let codeToApply = sourceShift;
    if (codeToApply && codeToApply.startsWith('F') && isSunday(parseISO(target.date))) {
          codeToApply = 'R';
    }

    // Determine Hours (Inheritance logic on overwrite)
    let customHours = undefined;
    const sType = state.shiftTypes.find(s => s.code === codeToApply);
    if (sType?.inheritsHours && targetOp) {
        const matrixCode = calculateMatrixShift(targetOp, target.date, state.matrices);
        const matrixShift = state.shiftTypes.find(s => s.code === matrixCode);
        if (matrixShift) {
             customHours = matrixShift.hours;
        }
    }

    const violation = validateCell(state, target.opId, target.date, codeToApply);

    const updateB: PlannerEntry = { 
        operatorId: target.opId, 
        date: target.date, 
        shiftCode: codeToApply, 
        isManual: true, 
        violation: violation || undefined, 
        note: `Applicato da ${sourceOp?.lastName || 'Collega'}`,
        customHours: customHours
    };

    dispatch({ type: 'UPDATE_CELL', payload: updateB });
    setPendingSwap(null);
  };

  const handleResetCell = () => {
      if (!selectedCell) return;
      dispatch({ type: 'REMOVE_CELL', payload: { operatorId: selectedCell.opId, date: selectedCell.date } });
      setLastOperation({ type: 'DELETE' });
      clearSelection();
  };

  const saveChanges = () => {
      if (!selectedCell) return;
      
      let finalSpecialEvents = [...draftSpecialEvents];

      if (isSpecialMode && (newSpecialHours !== '' || (newSpecialStart && newSpecialEnd))) {
          const hours = typeof newSpecialHours === 'number' ? newSpecialHours : 0;
          const pendingEvent: SpecialEvent = {
              id: crypto.randomUUID(),
              type: newSpecialType,
              startTime: newSpecialStart,
              endTime: newSpecialEnd,
              hours: hours,
              mode: newSpecialMode
          };
          finalSpecialEvents.push(pendingEvent);
          setNewSpecialStart('');
          setNewSpecialEnd('');
          setNewSpecialHours('');
      }

      let codeToApply = draftShift;
      if (codeToApply && codeToApply.startsWith('F') && isSunday(parseISO(selectedCell.date))) {
          codeToApply = 'R';
      }

      const violation = validateCell(state, selectedCell.opId, selectedCell.date, codeToApply);
      const newEntry: PlannerEntry = {
          operatorId: selectedCell.opId,
          date: selectedCell.date,
          shiftCode: codeToApply,
          note: draftNote,
          isManual: true,
          violation: violation || undefined,
          variationReason: draftVariationReason || undefined,
          customHours: draftCustomHours,
          specialEvents: finalSpecialEvents
      };
      
      if (draftShift) {
          setLastOperation({
              type: 'UPDATE',
              shiftCode: draftShift, 
              note: draftNote,
              variationReason: draftVariationReason,
              customHours: draftCustomHours,
              specialEvents: finalSpecialEvents
          });
      } else {
          setLastOperation({ type: 'DELETE' });
      }

      dispatch({ type: 'UPDATE_CELL', payload: newEntry });
      clearSelection();
  };

  const handleAssignTo = (targetOpId: string) => {
      if (!selectedCell) return;
      
      let codeToApply = draftShift;
      if (codeToApply && codeToApply.startsWith('F') && isSunday(parseISO(selectedCell.date))) {
          codeToApply = 'R';
      }

      const violation = validateCell(state, targetOpId, selectedCell.date, codeToApply);
      const newEntry: PlannerEntry = {
          operatorId: targetOpId,
          date: selectedCell.date,
          shiftCode: codeToApply,
          note: draftNote || 'Assegnato da suggerimento',
          isManual: true,
          violation: violation || undefined,
          customHours: draftCustomHours
      };
      
      dispatch({ type: 'UPDATE_CELL', payload: newEntry });
      dispatch({
          type: 'ADD_LOG',
          payload: {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              operatorId: targetOpId,
              actionType: 'UPDATE',
              newValue: draftShift,
              reason: `Assegnato da ${state.operators.find(o => o.id === selectedCell.opId)?.lastName}`,
              user: 'CurrentUser'
          }
      });
      clearSelection();
  }

  const handleOpenNote = (e: React.MouseEvent, op: any) => {
    e.stopPropagation();
    setNoteOpId(op.id);
    setTempNote(op.notes || '');
  };

  const handleSaveNote = () => {
    if (!noteOpId) return;
    const op = state.operators.find(o => o.id === noteOpId);
    if (op) {
        dispatch({ type: 'UPDATE_OPERATOR', payload: { ...op, notes: tempNote } });
    }
    setNoteOpId(null);
  };

  const formatMonth = (dateStr: string) => {
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return "Data non valida";
      return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatDayName = (d: Date) => {
      const days = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
      return days[d.getDay()] || '';
  };

  const handleOpenDayNote = (date: string) => {
      const currentNote = state.dayNotes[date] || '';
      setEditingDayNote({ date, text: currentNote });
  };

  const handleSaveDayNote = () => {
      if (!editingDayNote) return;
      dispatch({ type: 'UPDATE_DAY_NOTE', payload: { date: editingDayNote.date, note: editingDayNote.text } });
      setEditingDayNote(null);
  };

  // --- Render Cell ---
  const renderCell = (op: any, day: Date) => {
    const dateKey = formatDateKey(day);
    const isEmployed = isOperatorEmployed(op, dateKey);
    const entry = getEntry(state, op.id, dateKey);
    const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
    const isCurrentMonth = isSameMonth(day, parseISO(state.currentDate));
    const holidayName = getItalianHolidayName(day); // Check holiday here for cell styling if needed
    const isHol = !!holidayName; // boolean check

    // Check if the day is in the past (strictly before today)
    const isPast = isBefore(day, new Date(new Date().setHours(0,0,0,0)));

    let displayCode = '';
    let isGhost = false;
    let isMatrixOverride = false;
    let manualOverrideCode = '';

    // Check if this cell is in the currently hovered column
    const isColHovered = dateKey === hoveredDate;

    if (!isEmployed) {
        return (
             <div 
                key={dateKey}
                className={`flex-1 min-w-[44px] md:min-w-0 border-r border-b border-slate-200 h-10 md:h-8 bg-slate-100 relative group`}
                style={{ 
                    backgroundImage: 'repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 2px, transparent 0, transparent 50%)',
                    backgroundSize: '6px 6px',
                    opacity: 0.6,
                    cursor: 'not-allowed'
                }}
                onContextMenu={(e) => e.preventDefault()}
             >
             </div>
        );
    }

    if (displayMode === 'MATRIX_ONLY' || displayMode === 'MATRIX_DIFF') {
        displayCode = matrixShift || '';
        if (displayMode === 'MATRIX_DIFF') {
             const normalizedMatrix = matrixShift || '';
             const normalizedEntry = entry?.shiftCode || '';
             if (entry && normalizedEntry !== normalizedMatrix) {
                 isMatrixOverride = true;
                 manualOverrideCode = normalizedEntry || 'OFF';
             }
        }
    } else {
        displayCode = entry ? entry.shiftCode : (matrixShift || '');
        if (!entry && matrixShift) {
            isGhost = true;
        }
    }

    const codeForColor = (isMatrixView) ? (matrixShift || '') : displayCode;
    const shiftType = getShiftByCode(codeForColor, state.shiftTypes);
    const violation = entry?.violation;
    const isSelected = selectedCell?.opId === op.id && selectedCell?.date === dateKey;
    const isPendingTarget = pendingSwap?.target.opId === op.id && pendingSwap?.target.date === dateKey;
    const isDragging = draggingCell?.opId === op.id && draggingCell?.date === dateKey;

    let isMultiSelected = false;
    if (multiSelection && multiSelection.opId === op.id) {
        const current = parseISO(dateKey);
        const start = parseISO(multiSelection.start);
        const end = parseISO(multiSelection.end);
        if (isWithinInterval(current, { start, end })) {
            isMultiSelected = true;
        }
    }

    let coverageStatus: 'CRITICAL' | 'LOW' | 'ADEQUATE' | 'SURPLUS' | null = null;
    if (!isMatrixView && displayCode && isCurrentMonth) {
         let checkKey = displayCode;
         if (['M6','M7','M7-','M8','M8-'].includes(displayCode)) checkKey = 'M8';
         if (['P','P-'].includes(displayCode)) checkKey = 'P';

         const { mainCount, supportCount } = getGroupedCoverage(dateKey, checkKey);
         const config = state.config.coverage[checkKey]; 
         
         if (config) {
            const mode = config.mode || 'VISUAL';
            let effectiveCount = mainCount;
            if (mode === 'SUM') effectiveCount = mainCount + supportCount;
            
            if (effectiveCount < config.min) coverageStatus = 'CRITICAL';
            else if (effectiveCount < config.optimal) coverageStatus = 'LOW';
            else if (effectiveCount > config.optimal) coverageStatus = 'SURPLUS';
            else coverageStatus = 'ADEQUATE';
         }
    }

    const isSwap = entry?.note?.toLowerCase().includes('scambio') ?? false;
    const isVariation = entry?.customHours !== undefined && entry.customHours !== shiftType?.hours;
    const hasNote = !!entry?.note;
    // Renamed local variable to avoid conflict or confusion
    const isEntryManual = entry?.isManual && !isSwap && !isVariation;
    const hasSpecialEvents = entry?.specialEvents && entry.specialEvents.length > 0;
    
    const specialTooltipText = hasSpecialEvents 
        ? entry?.specialEvents?.map(e => `${e.type}: ${e.hours !== 0 ? e.hours + 'h' : 'Forfait'}`).join('\n') 
        : 'Voci Speciali';

    // --- VISUAL CONNECTORS LOGIC ---
    // Check if this cell should visually connect to the next one
    const nextDateKey = formatDateKey(addDays(day, 1));
    const nextEntry = getEntry(state, op.id, nextDateKey);
    const isConnectedRight = !isMatrixView && entry?.isManual && nextEntry?.isManual && entry.shiftCode === nextEntry.shiftCode && entry.shiftCode !== 'OFF' && entry.shiftCode !== '';

    return (
      <div 
        key={dateKey}
        draggable={!isMatrixView && isEmployed}
        onDragStart={(e) => handleDragStart(e, op.id, dateKey, isEmployed)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, op.id, dateKey, isEmployed)}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.stopPropagation(); handleCellClick(e, op.id, dateKey, isEmployed); }}
        onContextMenu={(e) => handleRightClick(e, op.id, dateKey, isEmployed)}
        onDoubleClick={(e) => { e.stopPropagation(); handleCellDoubleClick(); }}
        onMouseEnter={() => setHoveredDate(dateKey)}
        style={{ 
            backgroundColor: violation ? '#fee2e2' : (shiftType ? shiftType.color : undefined),
            opacity: isGhost ? 0.5 : 1,
            // If connected right, we want the border to "disappear" or match the background
            borderColor: isConnectedRight && shiftType ? shiftType.color : undefined
        }}
        className={`
          flex-1 min-w-[44px] md:min-w-0 border-r border-b border-slate-200 text-xs md:text-sm flex items-center justify-center relative transition-all h-10 md:h-8
          ${!isCurrentMonth ? 'bg-slate-100/50 text-slate-400' : isToday(day) ? 'bg-slate-50' : ''}
          ${isHol ? 'bg-slate-200/40' : ''}
          ${isPast && highlightPast ? 'opacity-30 grayscale bg-slate-100' : ''}
          ${isSelected ? 'ring-4 ring-violet-600 ring-offset-2 ring-offset-white z-50 shadow-2xl scale-105 opacity-100 grayscale-0' : ''}
          ${isMultiSelected ? 'ring-inset ring-2 ring-indigo-400 bg-indigo-50/50' : ''}
          ${isPendingTarget ? 'ring-2 ring-dashed ring-blue-500 z-20' : ''}
          ${isDragging ? 'opacity-40 scale-90 ring-2 ring-slate-400' : ''}
          ${violation ? 'text-red-600 font-bold border border-red-500' : (shiftType ? getContrastColor(shiftType.color) : 'text-slate-700')}
          ${isMatrixOverride ? 'ring-2 ring-dashed ring-red-500 z-10' : ''}
          ${isEmployed ? 'cursor-pointer hover:opacity-90 active:cursor-grabbing' : 'cursor-not-allowed opacity-50 bg-slate-200'}
        `}
      >
        {/* CROSSHAIR HIGHLIGHT OVERLAY */}
        {isColHovered && (
             <div className="absolute inset-0 bg-blue-500/10 pointer-events-none z-10" />
        )}

        <div className="absolute top-0 right-0 pointer-events-auto">
          {isSwap && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-cyan-500 border-l-transparent" title="Scambio" />}
          {isVariation && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-fuchsia-500 border-l-transparent" title="Variazione" />}
          {isEntryManual && !violation && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-amber-500 border-l-transparent" title="Manuale" />}
          {hasNote && !isSwap && !isEntryManual && !isVariation && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-yellow-500 border-l-transparent" title="Nota" />}
          {hasSpecialEvents && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-indigo-600 border-l-transparent" title={specialTooltipText} />}
        </div>

        <span className={`${isMatrixOverride ? 'opacity-40 line-through decoration-slate-600' : ''} truncate font-medium relative z-20`}>
            {displayCode}
        </span>
        
        {isMatrixOverride && (
            <div className="absolute -bottom-1 -right-1 bg-red-100 text-red-700 border border-red-200 text-[8px] font-bold px-1 rounded shadow-sm z-20">
                 {manualOverrideCode}
            </div>
        )}
        {isGhost && <div className="absolute inset-0 bg-white/30 pointer-events-none" />}
        
        {displayMode !== 'PLANNER_MINIMAL' && !isMatrixView && coverageStatus && coverageStatus !== 'ADEQUATE' && isCurrentMonth && (
            <div 
                className={`absolute top-0 left-0 border-l-[6px] border-t-[6px] border-r-transparent border-b-transparent z-10 
                    ${coverageStatus === 'CRITICAL' ? 'border-l-red-600 border-t-red-600' : ''}
                    ${coverageStatus === 'LOW' ? 'border-l-amber-500 border-t-amber-500' : ''}
                    ${coverageStatus === 'SURPLUS' ? 'border-l-purple-400 border-t-purple-400' : ''}
                `}
                title={`Copertura: ${coverageStatus === 'CRITICAL' ? 'Critica (< Min)' : coverageStatus === 'LOW' ? 'Bassa (< Ottimale)' : 'Surplus (> Ottimale)'}`}
            />
        )}
        
        {displayMode === 'PLANNER_DETAILED' && coverageStatus === 'ADEQUATE' && isCurrentMonth && (
             <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-br-sm bg-emerald-400 z-10" title="Copertura Ottimale" />
        )}

        {/* Evidenziazione Variazioni */}
        {displayMode === 'MATRIX_DIFF' && (entry?.variationReason || (entry?.customHours !== undefined && entry.customHours !== shiftType?.hours)) && (
             <div className="absolute inset-0 border-2 border-dashed border-fuchsia-500 z-20 pointer-events-none" title="Variazione Orario/Causale"></div>
        )}

        {displayMode === 'PLANNER_DETAILED' && shiftType && !isMatrixOverride && (
            <div className={`absolute bottom-0.5 left-1 text-[10px] font-bold font-mono leading-none opacity-90 z-20 ${getContrastColor(shiftType.color)}`}>
                {entry?.customHours ?? shiftType.hours}h
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white w-full overflow-hidden" onClick={clearSelection}>
      {/* ... (Print Preview Overlay Code remains same) ... */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto flex flex-col animate-in fade-in duration-200">
           {/* ... (Existing Print Preview Content) ... */}
           <div className="shrink-0 p-4 border-b bg-slate-50 flex justify-between items-center no-print sticky top-0 shadow-sm z-50">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                 <Printer className="text-blue-600"/> Anteprima di Stampa
              </h2>
              
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-md">
                 <button 
                    onClick={() => setPrintLayoutMode('VISUAL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${printLayoutMode === 'VISUAL' ? 'bg-white text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}
                 >
                    <Layout size={14} className="inline mr-1" />
                    Planner Visivo
                 </button>
                 <button 
                    onClick={() => setPrintLayoutMode('TIMESHEET')}
                    className={`px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${printLayoutMode === 'TIMESHEET' ? 'bg-white text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}
                 >
                    <FileText size={14} className="inline mr-1" />
                    Cartellino Ore
                 </button>
              </div>

              <div className="flex items-center gap-3">
                 <div className="text-xs text-slate-500 flex items-center mr-2 bg-yellow-50 px-2 py-1 rounded border border-yellow-200 hidden md:flex">
                    <Info size={14} className="mr-1 text-yellow-600"/>
                    <span>Se la stampa non parte, usa <strong>Ctrl+P</strong></span>
                 </div>
                 <Button variant="secondary" onClick={() => window.print()} className="gap-2">
                    <Printer size={16} /> Stampa
                 </Button>
                 <Button variant="danger" onClick={() => setShowPrintPreview(false)}>
                    Chiudi
                 </Button>
              </div>
           </div>
           
           <div className="flex-1 p-4 md:p-8 overflow-auto bg-slate-100 flex justify-center">
              <div className="bg-white shadow-xl p-8 max-w-[1400px] w-full min-h-screen print-area">
                 {printLayoutMode === 'VISUAL' ? <PrintLayout /> : <TimesheetPrintLayout />}
              </div>
           </div>
        </div>
      )}

      {!showPrintPreview && (
          <div className="print-only hidden print-area">
             {printLayoutMode === 'VISUAL' ? <PrintLayout /> : <TimesheetPrintLayout />}
          </div>
      )}

      {/* Mobile Toolbar Toggle Header */}
      <div className="md:hidden flex items-center justify-between p-2 border-b bg-slate-50 sticky top-0 z-50">
          <div className="flex items-center gap-2 font-bold text-slate-700">
             <CalendarDays size={18} className="text-blue-600" />
             <span>Planner</span>
          </div>
          <button 
            onClick={() => setIsMobileToolbarOpen(!isMobileToolbarOpen)}
            className={`p-2 rounded-lg transition-colors ${isMobileToolbarOpen ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-600 border'}`}
          >
             {isMobileToolbarOpen ? <XCircle size={20} /> : <Settings2 size={20} />}
          </button>
      </div>

      {/* Toolbar */}
      <div 
        className={`
            p-2 md:p-4 border-b border-slate-200 bg-white shadow-sm z-40 gap-2 no-print
            ${isMobileToolbarOpen ? 'flex flex-wrap items-center justify-between' : 'hidden md:flex flex-wrap items-center justify-between'}
        `} 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
            {/* Sync Indicator */}
            <div className="hidden lg:flex items-center mr-2 px-2 py-1 bg-slate-50 rounded border border-slate-200" title="Stato Cloud">
                {syncStatus === 'SYNCING' && <><Loader2 size={16} className="animate-spin text-blue-500 mr-2" /><span className="text-xs text-blue-600 font-medium">Salvataggio...</span></>}
                {syncStatus === 'SAVED' && <><CheckCircle size={16} className="text-emerald-500 mr-2" /><span className="text-xs text-emerald-600 font-medium">Salvato</span></>}
                {syncStatus === 'ERROR' && <><CloudOff size={16} className="text-red-500 mr-2" /><span className="text-xs text-red-600 font-medium">Offline</span></>}
                {syncStatus === 'IDLE' && <><Cloud size={16} className="text-slate-400 mr-2" /><span className="text-xs text-slate-500">Pronto</span></>}
            </div>

            {/* Navigation & UNDO/REDO */}
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 shrink-0">
                    <button 
                        onClick={() => dispatch({ type: 'UNDO' })} 
                        disabled={!history.canUndo}
                        className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent text-slate-600"
                        title="Annulla (Ctrl+Z)"
                    >
                        <Undo size={16} />
                    </button>
                    <button 
                        onClick={() => dispatch({ type: 'REDO' })} 
                        disabled={!history.canRedo}
                        className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent text-slate-600"
                        title="Ripristina (Ctrl+Y)"
                    >
                        <Redo size={16} />
                    </button>
                </div>

                <div className="flex items-center bg-slate-100 rounded-lg p-1 shrink-0">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={16} /></button>
                    <span className="px-2 md:px-3 font-semibold text-slate-700 text-sm md:text-base text-center capitalize min-w-[100px] md:min-w-[140px]">{formatMonth(state.currentDate)}</span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={16} /></button>
                </div>
            
                <Button variant="secondary" className="text-xs md:text-sm py-1 px-2 md:px-3" onClick={handleToday} title="Vai ad Oggi">
                    Oggi
                </Button>

                <div className="flex items-center gap-2 border-l pl-2 md:pl-4 ml-2 shrink-0">
                    <Layout size={16} className="text-slate-400" />
                    <select 
                        className="text-xs md:text-sm border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer"
                        value={displayMode}
                        onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
                    >
                        <option value="PLANNER_STANDARD">Standard</option>
                        <option value="PLANNER_MINIMAL">Minimal</option>
                        <option value="PLANNER_DETAILED">Dettagliato</option>
                        <option disabled>──────────</option>
                        <option value="MATRIX_ONLY">Solo Matrice</option>
                        <option value="MATRIX_DIFF">Variazioni</option>
                    </select>
                </div>

                <div className="hidden xl:flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 select-none">
                    <MousePointer2 size={12} />
                    <span>Tasto Dx: {lastOperation ? (lastOperation.type === 'UPDATE' ? lastOperation.shiftCode : 'Del') : '-'}</span>
                </div>
            </div>
        </div>

        <div className="flex gap-2 shrink-0 mt-2 md:mt-0">
            {/* ... Right side buttons ... */}
            <div className="relative shrink-0 border-l pl-2 ml-2 flex items-center gap-2">
                <Button 
                    variant={highlightPast ? 'primary' : 'secondary'} 
                    className="text-xs md:text-sm py-1 px-2 md:px-3 flex items-center gap-2" 
                    onClick={() => setHighlightPast(!highlightPast)}
                    title={highlightPast ? "Uniforma visualizzazione giorni passati" : "Distingui visivamente giorni passati"}
                >
                    <History size={16} /> <span className="hidden md:inline">Storico</span>
                </Button>

                <Button variant="secondary" className="text-xs md:text-sm py-1 px-2 md:px-3 flex items-center gap-2" onClick={() => setShowFilters(!showFilters)}>
                    <Filter size={16} /> <span className="hidden md:inline">Filtri</span>
                </Button>
                
                {showFilters && (
                    <div className="absolute top-full right-0 mt-2 p-4 bg-white border rounded-lg shadow-xl z-[100] w-64 space-y-3 animate-in fade-in zoom-in-95">
                        <Input 
                            label="Cerca Operatore" 
                            placeholder="Nome..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="text-sm"
                        />
                        <Select 
                            label="Stato / Filtro"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="text-sm"
                        >
                            <option value="ACTIVE">Attivi</option>
                            <option value="INACTIVE">Inattivi</option>
                            <option value="ALL">Tutti</option>
                            <option disabled>──────────</option>
                            <option value="MODIFIED">Con Modifiche</option>
                            <option value="EXTRA">Con Extra</option>
                        </Select>
                        <Select
                            label="Matrice Assegnata"
                            value={filterMatrix}
                            onChange={(e) => setFilterMatrix(e.target.value)}
                            className="text-sm"
                        >
                            <option value="ALL">Tutte le Matrici</option>
                            {state.matrices.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </Select>
                        <div className="pt-2 border-t flex justify-end">
                            <Button variant="ghost" className="text-xs py-1" onClick={() => { setSearchTerm(''); setFilterStatus('ACTIVE'); setFilterMatrix('ALL'); }}>Reset</Button>
                        </div>
                    </div>
                )}
            </div>

           {multiSelection && (
               <>
                <Button variant="primary" onClick={handleCopySelection} title="Copia"><Copy size={16} /></Button>
                <Button variant="secondary" onClick={() => setShowBulkModal(true)} title="Assegna"><Layers size={16} /></Button>
               </>
           )}
           {clipboard && selectedCell && (
               <Button variant="primary" onClick={handlePasteSelection} title="Incolla"><ClipboardPaste size={16} /></Button>
           )}
           <Button 
               id="export-btn"
               variant="secondary" 
               onClick={handleExportForGoogleSheets} 
               title="Invia al Foglio Master di Google"
               className="flex items-center gap-2"
           >
               <Send size={16} /> <span className="hidden lg:inline">Condividi</span>
           </Button>
           <Button variant="secondary" onClick={handleExportCSV} title="CSV"><FileSpreadsheet size={16} /></Button>
           <Button variant="secondary" onClick={handleApplyMatricesClick} title="Matrici"><Wand2 size={16} /></Button>
           <Button variant="secondary" onClick={() => setShowPrintPreview(true)} title="Stampa"><Printer size={16} /></Button>
        </div>
      </div>

      {/* Grid Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 flex flex-col overflow-hidden bg-white relative no-print touch-pan-x touch-pan-y"
        onMouseLeave={() => setHoveredDate(null)}
      >
          {/* RESTRUCTURED GRID FOR SCROLLING: The Header and Body must scroll together horizontally */}
          <div className="flex-1 overflow-auto relative">
             <div className="min-w-max">
                {/* Header inside scrollable area */}
                <div className="flex shrink-0 h-10 bg-slate-100 border-b border-slate-300 shadow-sm z-30 sticky top-0">
                    <div className="w-32 md:w-48 shrink-0 bg-slate-100 border-r border-slate-300 flex items-center pl-2 md:pl-4 font-bold text-slate-700 text-xs md:text-sm sticky left-0 z-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        Operatore
                    </div>
                    <div className="w-[40px] md:w-[60px] shrink-0 flex items-center justify-center font-bold text-[10px] md:text-xs text-slate-600 border-r bg-slate-50 z-30 relative group">
                        <span>Ore</span>
                        {!isMatrixView && (
                            <button
                                onClick={() => setShowPrevDays(!showPrevDays)}
                                className={`
                                    absolute -right-3 top-1/2 -translate-y-1/2 
                                    w-5 h-5 rounded-full bg-white border border-slate-300 shadow-sm
                                    flex items-center justify-center 
                                    text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50
                                    transition-all z-50
                                    opacity-0 group-hover:opacity-100
                                    ${showPrevDays ? 'bg-blue-50 text-blue-600 border-blue-300 opacity-100' : ''}
                                `}
                                title={showPrevDays ? "Nascondi giorni precedenti" : "Mostra fine mese precedente"}
                            >
                               {showPrevDays ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                            </button>
                        )}
                    </div>
                    {days.map(d => {
                        const dateKey = formatDateKey(d);
                        const hasNote = !!state.dayNotes[dateKey];
                        const isHovered = dateKey === hoveredDate;
                        const holidayName = getItalianHolidayName(d);
                        const isHol = !!holidayName;
                        const isPast = isBefore(d, new Date(new Date().setHours(0,0,0,0)));

                        return (
                          <div key={d.toString()} className={`flex-1 min-w-[44px] md:min-w-0 flex flex-col items-center justify-center border-r border-slate-200 text-[10px] md:text-xs overflow-hidden relative cursor-pointer transition-colors group ${isWeekend(d) ? 'bg-slate-200 text-slate-800' : 'text-slate-600'} ${isToday(d) ? 'bg-blue-100 font-bold text-blue-700' : ''} ${!isSameMonth(d, parseISO(state.currentDate)) ? 'opacity-60 bg-slate-100' : ''} ${isHovered ? 'bg-blue-200/50' : 'hover:bg-blue-50'} ${isPast && highlightPast ? 'opacity-40 bg-slate-200 grayscale' : ''}`}
                               onClick={() => handleOpenDayNote(dateKey)}
                               onMouseEnter={() => setHoveredDate(dateKey)}
                               title={hasNote ? `Nota: ${state.dayNotes[dateKey]}` : (isHol ? `Festività: ${holidayName}` : "Clicca per aggiungere una nota")}
                          >
                            <span className={isHol ? 'text-red-600 font-bold' : ''}>{formatDayName(d)}</span>
                            <span className={`text-xs md:text-sm font-semibold ${isHol ? 'text-red-600' : ''}`}>{format(d, 'd')}</span>
                            {hasNote && (
                                <div className="absolute top-0.5 right-0.5 text-amber-500">
                                    <StickyNote size={10} className="fill-amber-500" />
                                </div>
                            )}
                          </div>
                        );
                    })}
                </div>

                {/* Coverage Summary Row */}
                <div className={`flex shrink-0 bg-slate-100 border-b border-slate-300 shadow-sm z-20 transition-all duration-300 ${showCoverageDetails ? 'h-20' : 'h-8'}`}>
                    <div className="w-32 md:w-48 shrink-0 bg-slate-100 border-r border-slate-300 p-2 text-[10px] md:text-xs font-bold flex items-center justify-between cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors group sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                        onClick={() => setShowCoverageDetails(!showCoverageDetails)}
                        title={showCoverageDetails ? "Comprimi dettagli" : "Espandi dettagli copertura"}
                    >
                        <div className="flex items-center gap-2">
                            <span>Copertura</span>
                            {showCoverageDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                    </div>
                     <div className="w-[40px] md:w-[60px] shrink-0 bg-slate-50 border-r relative flex items-center justify-center">
                         {showCoverageDetails && !isMatrixView && (
                             <div className="text-[8px] font-bold text-slate-400 flex flex-col gap-1 w-full px-1">
                                 <div className="flex justify-between w-full"><span>M</span><span>#</span></div>
                                 <div className="flex justify-between w-full"><span>P</span><span>#</span></div>
                                 <div className="flex justify-between w-full"><span>N</span><span>#</span></div>
                             </div>
                         )}
                     </div>
                     {days.map(d => {
                         const dateKey = formatDateKey(d);

                         let status = 'ADEQUATE'; 
                         Object.keys(state.config.coverage).forEach(type => {
                             const { mainCount, supportCount } = getGroupedCoverage(dateKey, type);
                             const conf = state.config.coverage[type] as { min: number, optimal: number, mode?: 'SUM'|'EXCLUDE'|'VISUAL' } | undefined;
                             if (conf) {
                                const mode = conf.mode || 'VISUAL';
                                let effectiveCount = mainCount;
                                if (mode === 'SUM') effectiveCount = mainCount + supportCount;
                                
                                if (effectiveCount < conf.min) status = 'CRITICAL';
                                else if (effectiveCount < conf.optimal && status !== 'CRITICAL') status = 'WARNING';
                                else if (effectiveCount > conf.optimal && status !== 'CRITICAL' && status !== 'WARNING') status = 'SURPLUS';
                             }
                         });

                         return (
                            <div key={d.toString()} className="flex-1 min-w-[44px] md:min-w-0 flex items-center justify-center border-r border-slate-200 group relative">
                                {isSameMonth(d, parseISO(state.currentDate)) && (
                                    <>
                                        {/* EXPANDED VIEW: SHOW NUMBERS */}
                                        {showCoverageDetails ? (
                                            <div className="flex flex-col gap-0.5 w-full py-1 h-full justify-center">
                                                {['M8', 'P', 'N'].map(k => {
                                                    const { mainCount, supportCount, supportLabel } = getGroupedCoverage(dateKey, k);
                                                    const total = mainCount + supportCount; 
                                                    const conf = state.config.coverage[k];
                                                    let color = 'text-slate-500';
                                                    
                                                    if (conf) {
                                                        const mode = conf.mode || 'VISUAL';
                                                        let effective = mainCount;
                                                        if (mode === 'SUM') effective = total;

                                                        if (effective < conf.min) color = 'text-red-600 font-bold';
                                                        else if (effective < conf.optimal) color = 'text-amber-600';
                                                        else color = 'text-emerald-600';
                                                    }

                                                    return (
                                                        <div key={k} className="relative flex items-center justify-center h-1/3 w-full border-b border-slate-100 last:border-0">
                                                            {/* Label: Ghostly, left */}
                                                            <span className="absolute left-0.5 text-[8px] font-mono font-bold text-slate-300">{k.charAt(0)}</span>
                                                            
                                                            {/* Content Wrapper to center both numbers together */}
                                                            <div className="flex items-baseline justify-center w-full pl-2 gap-1">
                                                                {/* Main Count */}
                                                                <span className={`text-[11px] font-bold ${color}`}>{mainCount}</span>
                                                                
                                                                {/* Support Count: Text Only (NO BADGE), High Visibility */}
                                                                {supportCount > 0 && (
                                                                    <span className="text-[9px] font-black text-fuchsia-600 flex items-center" title={`${supportCount} ${supportLabel}`}>
                                                                        +{supportCount}<span className="text-[7px] uppercase ml-px">{supportLabel}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                        /* COLLAPSED VIEW: SHOW DOT */
                                            <>
                                                {status === 'CRITICAL' && <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>}
                                                {status === 'WARNING' && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                                                {status === 'ADEQUATE' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>}
                                                {status === 'SURPLUS' && <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>}
                                            </>
                                        )}
                                    </>
                                )}
                                 
                                 {/* Hover Tooltip (Only visible when collapsed or for extra info) */}
                                 {!showCoverageDetails && (
                                     <div className="hidden group-hover:block absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap z-50">
                                         <div className="font-bold border-b border-slate-600 mb-1 pb-1">Copertura {format(d, 'dd/MM')}</div>
                                         {Object.entries(state.config.coverage).map(([code, conf]: [string, any]) => {
                                             const { mainCount, supportCount, supportLabel } = getGroupedCoverage(dateKey, code);
                                             let label = code;
                                             if (code === 'M8') label = 'M (Mattina)';
                                             if (code === 'P') label = 'P (Pomeriggio)';
                                             
                                             const mode = conf.mode || 'VISUAL';

                                             return (
                                                 <div key={code} className="flex justify-between gap-3">
                                                     <span>{label}: 
                                                        {mode === 'SUM' ? (
                                                            <span className="font-bold ml-1 text-sm">{mainCount + supportCount}</span>
                                                        ) : mode === 'EXCLUDE' ? (
                                                            <span className="font-bold ml-1 text-sm">{mainCount}</span>
                                                        ) : (
                                                            <>
                                                                <span className="font-bold ml-1 text-sm">{mainCount}</span>
                                                                {supportCount > 0 && <span className="ml-1"><span className="text-sm">+{supportCount}</span><span className="text-[10px] uppercase">{supportLabel}</span></span>}
                                                            </>
                                                        )}
                                                     </span>
                                                     <span className="text-slate-400">Op: {conf.optimal}</span>
                                                 </div>
                                             );
                                         })}
                                    </div>
                                 )}
                            </div>
                         )
                     })}
                </div>

                {/* Rows Content */}
                <div>
                  {sortedGroupKeys.map(groupKey => {
                      const groupOps = groupedOperators[groupKey];
                      const matrix = state.matrices.find(m => m.id === groupKey);
                      const groupName = matrix ? matrix.name : (groupKey === 'none' ? 'Nessuna Matrice' : 'Tutti');
                      const groupColor = matrix?.color || '#f1f5f9';

                      return (
                        <Fragment key={groupKey}>
                            {groupByMatrix && groupKey !== 'all' && (
                                <div className="sticky left-0 z-10 bg-slate-50 border-y border-slate-200 font-bold text-[10px] md:text-xs text-slate-500 px-2 md:px-4 py-1 uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-2 h-2 md:w-3 md:h-3 rounded-full border border-slate-300" style={{backgroundColor: groupColor}}></div>
                                    {groupName}
                                </div>
                            )}
                            {groupOps.map(op => {
                                // Calculate Totals per operator
                                const totalMainHours = currentMonthDays.reduce((acc, d) => {
                                    const dateKey = formatDateKey(d);
                                    if (!isOperatorEmployed(op, dateKey)) return acc;
                                    const entry = getEntry(state, op.id, dateKey);
                                    const shiftCode = entry?.shiftCode || calculateMatrixShift(op, dateKey, state.matrices) || '';
                                    const shift = getShiftByCode(shiftCode, state.shiftTypes);
                                    
                                    // ROBUST CALCULATION: Check inheritance if customHours is missing
                                    let hours = entry?.customHours;
                                    if (hours === undefined && shift?.inheritsHours) {
                                        // Try to get matrix hours on fly if undefined
                                        const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
                                        const matrixShift = getShiftByCode(matrixCode || '', state.shiftTypes);
                                        if (matrixShift) hours = matrixShift.hours;
                                    }
                                    
                                    hours = hours ?? shift?.hours ?? 0;
                                    return acc + hours;
                                }, 0);

                                const totalSpecialHours = currentMonthDays.reduce((acc, d) => {
                                    const dateKey = formatDateKey(d);
                                    const entry = getEntry(state, op.id, dateKey);
                                    // ONLY count ADDITIVE events for the +X badge
                                    const dailySpecial = entry?.specialEvents?.reduce((sum, ev) => {
                                        return (ev.mode === 'ADDITIVE' || !ev.mode) ? sum + ev.hours : sum;
                                    }, 0) ?? 0;
                                    return acc + dailySpecial;
                                }, 0);

                                return (
                                    <div key={op.id} className="flex border-b border-slate-200 hover:bg-blue-50/50 transition-colors duration-0 h-10 md:h-8 group">
                                      <div 
                                        className="w-32 md:w-48 shrink-0 bg-white border-r border-slate-200 flex flex-col justify-center pl-2 md:pl-4 py-1 z-10 border-l-4 truncate cursor-pointer group-hover:bg-blue-50 transition-colors sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                        style={{ borderLeftColor: groupByMatrix && matrix ? matrix.color : 'transparent' }}
                                        onClick={() => setDetailsOpId(op.id)}
                                      >
                                        <div className="flex items-center justify-between pr-2">
                                            <span className="font-medium text-slate-800 text-xs md:text-sm truncate group-hover:text-blue-600 group-hover:underline decoration-blue-400 underline-offset-2">
                                              {op.lastName} {op.firstName.charAt(0)}.
                                            </span>
                                            <button 
                                              onClick={(e) => handleOpenNote(e, op)}
                                              className={`p-1 rounded hover:bg-slate-200 transition-colors ${op.notes ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}
                                              title="Note / Richieste"
                                            >
                                              <StickyNote size={14} className={op.notes ? "fill-amber-100" : ""} />
                                            </button>
                                        </div>
                                        {(!groupByMatrix) && (
                                            <span className="text-[9px] md:text-[10px] text-slate-500 truncate">{state.matrices.find(m => m.id === op.matrixId)?.name || '-'}</span>
                                        )}
                                      </div>
                                      <div className="w-[40px] md:w-[60px] shrink-0 flex flex-col items-center justify-center text-[10px] md:text-xs font-bold text-slate-500 bg-slate-50 border-r leading-tight group-hover:bg-blue-50 transition-colors">
                                        <span>{totalMainHours}</span>
                                        {totalSpecialHours !== 0 && (
                                            <span className="text-[9px] text-indigo-600 font-bold border-t border-slate-200 w-full text-center mt-0.5 pt-0.5">
                                               {totalSpecialHours > 0 ? '+' : ''}{totalSpecialHours}
                                            </span>
                                        )}
                                      </div>
                                      {days.map(d => renderCell(op, d))}
                                    </div>
                                );
                            })}
                        </Fragment>
                      );
                  })}
                </div>
             </div>
          </div>
      </div>

      {/* ... (Tooltip, Modals, etc. remain unchanged below) ... */}
      {/* Tooltip Details Popover */}
      {selectedCell && !editMode && tooltipPos && (() => {
          const entry = getEntry(state, selectedCell.opId, selectedCell.date);
          const matrixShift = calculateMatrixShift(state.operators.find(o => o.id === selectedCell.opId)!, selectedCell.date, state.matrices);
          const activeCode = entry?.shiftCode || matrixShift || '';
          const shift = getShiftByCode(activeCode, state.shiftTypes);
          const op = state.operators.find(o => o.id === selectedCell.opId);
          const originalMatrixCode = calculateMatrixShift(state.operators.find(o => o.id === selectedCell.opId)!, selectedCell.date, state.matrices);
          const hasChangedFromMatrix = originalMatrixCode && originalMatrixCode !== activeCode;
          const specialEvents = entry?.specialEvents || [];
          
          // Calculate summary of special hours
          const totalSpecialHours = specialEvents.reduce((acc, curr) => {
              // Usually we just sum them for display, but distinction is nice
              return acc + curr.hours;
          }, 0);

          return (
            <div 
                className="fixed z-50 bg-slate-800 text-white rounded-lg shadow-2xl w-64 p-4 transform -translate-x-1/2 transition-all duration-200 ease-out animate-in fade-in zoom-in-95 backdrop-blur-sm bg-opacity-95 no-print"
                style={{ 
                    top: tooltipPos.y, 
                    left: tooltipPos.x,
                    transform: tooltipPos.isBottom ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-3 border-b border-slate-600 pb-2">
                    <div>
                        <div className="font-bold text-sm">{op?.lastName} {op?.firstName}</div>
                        <div className="text-xs text-slate-400">{format(parseISO(selectedCell.date), 'EEEE, d MMM yyyy')}</div>
                    </div>
                    {entry?.isManual && <span className="bg-amber-500 text-slate-900 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Manuale</span>}
                </div>

                <div className="space-y-2 text-sm">
                    {/* Main Shift Info */}
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Turno Base:</span>
                        {activeCode ? (
                            <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-700">{activeCode} - {shift?.name || 'Sconosciuto'}</span>
                        ) : (
                            <span className="text-slate-500 italic">Vuoto</span>
                        )}
                    </div>
                    
                    {shift && (
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Ore Previste:</span>
                            <span>{shift.hours}h {shift.isNight ? '(Notte)' : ''}</span>
                        </div>
                    )}

                    {/* Standard Variations (Manual Override of main hours) */}
                    {(entry?.variationReason || (entry?.customHours !== undefined && entry.customHours !== shift?.hours)) && (
                        <div className="mt-2 pt-2 border-t border-slate-700">
                             <div className="text-[10px] uppercase text-amber-500 font-bold mb-1">Variazione Orario</div>
                             <div className="flex justify-between items-center bg-amber-950/30 p-1.5 rounded border border-amber-500/30">
                                 <span className="text-amber-400 text-xs font-bold">{entry?.variationReason || 'Manuale'}</span>
                                 <span className="font-mono font-bold text-amber-200">{entry?.customHours}h</span>
                             </div>
                        </div>
                    )}
                    
                    {/* Special Events Section - Redesigned for Clarity */}
                    {specialEvents.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-600">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] uppercase text-indigo-300 font-bold">Voci Speciali & Extra</span>
                                {specialEvents.length > 1 && (
                                    <span className="text-[10px] font-bold text-indigo-200 bg-indigo-900/50 px-1 rounded">
                                        Tot: {totalSpecialHours > 0 ? '+' : ''}{totalSpecialHours}h
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {specialEvents.map((ev, i) => (
                                    <div key={ev.id || i} className="flex justify-between items-center bg-slate-200 p-1.5 rounded border border-slate-300 text-slate-800 shadow-sm">
                                        <div className="flex flex-col leading-tight">
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-xs text-slate-900">{ev.type || 'Voce Speciale'}</span>
                                                {ev.mode === 'SUBSTITUTIVE' && <span className="text-[9px] text-slate-500">(Sost.)</span>}
                                            </div>
                                            {(ev.startTime || ev.endTime) ? (
                                                <span className="text-[10px] text-slate-600 font-mono mt-0.5">
                                                    {ev.startTime || '--:--'} - {ev.endTime || '--:--'}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="shrink-0 ml-2">
                                            <Badge color={ev.hours > 0 ? (ev.mode === 'SUBSTITUTIVE' ? 'bg-slate-500 text-white' : 'bg-indigo-600 text-white') : ev.hours < 0 ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}>
                                                {ev.hours !== 0 ? `${ev.hours > 0 && ev.mode !== 'SUBSTITUTIVE' ? '+' : ''}${ev.hours}h` : 'Forfait'}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Matrix Diff Info */}
                    {hasChangedFromMatrix && (
                        <div className="mt-2 pt-2 border-t border-slate-700">
                             <div className="flex justify-between items-center text-[10px] text-slate-500">
                                 <span>Originale da Matrice:</span>
                                 <span className="font-mono font-bold text-slate-400">{originalMatrixCode}</span>
                             </div>
                        </div>
                    )}

                    {entry?.note && (
                        <div className="bg-slate-700/50 p-2 rounded text-xs italic border-l-2 border-amber-500 mt-2">
                           "{entry.note}"
                        </div>
                    )}
                    
                    {entry?.violation && (
                        <div className="flex items-start gap-2 text-red-300 text-xs font-bold mt-2 bg-red-900/20 p-2 rounded border border-red-900/50">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>{entry.violation}</span>
                        </div>
                    )}
                </div>

                <div className="mt-4 flex gap-2 justify-end">
                    <button onClick={clearSelection} className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors">Chiudi</button>
                    {!isMatrixView && (
                        <button 
                            onClick={() => setEditMode(true)} 
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded shadow-sm flex items-center gap-1.5 transition-colors"
                        >
                            <Edit2 size={12} /> Modifica
                        </button>
                    )}
                </div>
                
                <div 
                    className={`absolute left-1/2 -ml-2 w-4 h-4 bg-slate-800 transform rotate-45 ${tooltipPos.isBottom ? '-bottom-2' : '-top-2'}`}
                />
            </div>
          );
      })()}

      {/* Operator Details Modal */}
      {detailsOpId && (
          <OperatorDetailModal 
            isOpen={!!detailsOpId} 
            onClose={() => setDetailsOpId(null)} 
            operatorId={detailsOpId} 
          />
      )}

      {/* Quick Note Modal */}
      <Modal isOpen={!!noteOpId} onClose={() => setNoteOpId(null)} title="Annotazioni Operatore">
          <div className="space-y-4">
              <div className="bg-amber-50 p-3 rounded border border-amber-200 text-xs text-amber-800 flex gap-2">
                  <StickyNote size={16} className="shrink-0" />
                  <span>
                      Inserisci qui richieste specifiche, note di servizio o promemoria per questo operatore (es. "Richiesto riposo il 15/10").
                  </span>
              </div>
              <textarea 
                  className="w-full h-32 p-3 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Scrivi qui..."
                  value={tempNote}
                  onChange={(e) => setTempNote(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setNoteOpId(null)}>Annulla</Button>
                  <Button variant="primary" onClick={handleSaveNote}>Salva Nota</Button>
              </div>
          </div>
      </Modal>

      {/* Day Note Modal */}
      <Modal isOpen={!!editingDayNote} onClose={() => setEditingDayNote(null)} title="Nota del Giorno">
          {editingDayNote && (
              <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                      <div className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg font-bold text-xl">
                          {format(parseISO(editingDayNote.date), 'd')}
                      </div>
                      <div>
                          <div className="text-xs text-slate-500 uppercase font-bold">{format(parseISO(editingDayNote.date), 'MMMM yyyy')}</div>
                          <div className="font-semibold text-slate-800">{format(parseISO(editingDayNote.date), 'EEEE')}</div>
                      </div>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Promemoria / Nota</label>
                      <textarea 
                          className="w-full h-32 p-3 border border-amber-300 bg-amber-50 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-800 placeholder-amber-800/40"
                          placeholder="Scrivi un promemoria per questa giornata (es. Festa Patronale, Riunione...)"
                          value={editingDayNote.text}
                          onChange={(e) => setEditingDayNote({ ...editingDayNote, text: e.target.value })}
                      />
                  </div>

                  <div className="flex justify-between pt-2">
                      <Button 
                        variant="ghost" 
                        className="text-red-500 hover:bg-red-50 hover:text-red-700"
                        onClick={() => { setEditingDayNote({ ...editingDayNote, text: '' }); setTimeout(handleSaveDayNote, 0); }}
                      >
                          <Trash2 size={16} className="mr-2 inline" /> Elimina Nota
                      </Button>
                      <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => setEditingDayNote(null)}>Annulla</Button>
                          <Button variant="primary" onClick={handleSaveDayNote}>Salva</Button>
                      </div>
                  </div>
              </div>
          )}
      </Modal>

      {/* Edit Modal (Shift) */}
      <Modal isOpen={!!selectedCell && editMode && !isMatrixView} onClose={() => { setEditMode(false); setSelectedCell(null); }} title="Modifica Assegnazione Turno" className="max-w-4xl">
        {selectedCell && (() => {
           const op = state.operators.find(o => o.id === selectedCell.opId);
           const entry = getEntry(state, selectedCell.opId, selectedCell.date);
           const defaultShift = state.shiftTypes.find(s => s.code === draftShift);
           const currentHours = entry?.customHours ?? defaultShift?.hours ?? 0;
           
           const suggestions = getSuggestions(state, selectedCell.date, draftShift);
           
           // Group shifts for UI
           const workingShifts = state.shiftTypes.filter(s => s.hours > 0 && s.code !== 'OFF');
           const absenceShifts = state.shiftTypes.filter(s => s.hours === 0 && s.code !== 'OFF');

           // Check for specific Gettone
           const hasGettone = draftSpecialEvents.some(ev => ev.type === 'Gettone');

           return (
             <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
               <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center text-sm text-slate-500 bg-slate-50 p-3 rounded-md border border-slate-100">
                        <div>
                            <span className="block text-xs uppercase font-bold text-slate-400">Operatore</span>
                            <span className="font-semibold text-slate-800 text-base">{op?.lastName} {op?.firstName}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-xs uppercase font-bold text-slate-400">Data</span>
                            <span className="font-semibold text-slate-800">{format(parseISO(selectedCell.date), 'EEE, d MMM')}</span>
                        </div>
                   </div>
                   
                   {/* Display Operator Note if exists */}
                   {op?.notes && (
                       <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded flex items-start gap-2">
                           <StickyNote size={14} className="shrink-0 mt-0.5" />
                           <span className="italic">{op.notes}</span>
                       </div>
                   )}
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Working Shifts */}
                   <div>
                        <div className="flex justify-between items-end mb-2">
                             <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                 <Clock size={12} /> Turni Operativi
                             </label>
                             <a href="#" className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={(e) => { e.preventDefault(); alert('Usa la scheda "Configurazione > Turni" per creare nuovi codici.'); }}>
                                <Edit2 size={10} /> Gestisci
                             </a>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                            {workingShifts.map(s => (
                               <button 
                                 key={s.code}
                                 onClick={() => handleDraftShiftSelection(s)}
                                 className={`p-1 text-xs font-bold rounded-md border transition-all flex flex-col items-center justify-center gap-0.5 h-10
                                    ${s.code === draftShift 
                                        ? 'ring-2 ring-blue-500 ring-offset-2 border-transparent shadow-md transform scale-105 z-10' 
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'} ${getContrastColor(s.color)}`}
                                 style={{backgroundColor: s.code === draftShift ? s.color : `${s.color}40`}}
                               >
                                 <span>{s.code}</span>
                               </button>
                            ))}
                        </div>
                   </div>

                   {/* Absences & Permissions */}
                   <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                             <CalendarOff size={12} /> Assenze & Permessi
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                            {absenceShifts.map(s => (
                               <button 
                                 key={s.code}
                                 onClick={() => handleDraftShiftSelection(s)}
                                 className={`p-1 text-xs font-bold rounded-md border transition-all flex flex-col items-center justify-center gap-0.5 h-10
                                    ${s.code === draftShift 
                                        ? 'ring-2 ring-blue-500 ring-offset-2 border-transparent shadow-md transform scale-105 z-10' 
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'} ${getContrastColor(s.color)}`}
                                 style={{backgroundColor: s.code === draftShift ? s.color : `${s.color}40`}}
                               >
                                 <span>{s.code}</span>
                               </button>
                            ))}
                            <button 
                                onClick={() => {
                                    setDraftShift('');
                                    setDraftVariationReason('');
                                    setDraftCustomHours(0);
                                }}
                                className={`p-1 text-xs border rounded-md hover:bg-slate-100 flex flex-col items-center justify-center h-10 transition-all ${draftShift === '' ? 'ring-2 ring-slate-400 ring-offset-2 bg-slate-100' : ''}`}
                            >
                                <span className="font-bold text-slate-400">OFF</span>
                            </button>
                        </div>
                   </div>
               </div>
               
               {draftShift && (
                   <div className="bg-slate-50 p-3 rounded-md border border-slate-200 animate-in fade-in slide-in-from-top-2">
                       <div className="flex justify-between items-center mb-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase">Durata Turno (Ore)</label>
                           
                           <div className="flex gap-4">
                               {/* Toggle Gettone */}
                               <label className={`flex items-center gap-1 text-xs font-bold cursor-pointer transition-colors px-2 py-0.5 rounded border ${hasGettone ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                   <input 
                                        type="checkbox" 
                                        checked={hasGettone}
                                        onChange={handleToggleGettone}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <Coins size={12} />
                                    Gettone
                               </label>

                               {/* Toggle Special Mode */}
                               <label className="flex items-center gap-1 text-xs text-indigo-600 font-bold cursor-pointer">
                                   <input 
                                        type="checkbox" 
                                        checked={isSpecialMode}
                                        onChange={(e) => setIsSpecialMode(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Voci Speciali
                               </label>
                           </div>
                       </div>

                       {/* Standard Duration Editing */}
                       {!isSpecialMode && (
                           <>
                             {defaultShift?.hours === 0 && <span className="text-[10px] text-blue-600 font-bold animate-pulse block mb-1">Inserire le ore effettive</span>}
                             <div className="flex gap-4 items-start">
                                 <Input 
                                     type="number" 
                                     step="0.5"
                                     className={`w-24 text-center font-bold ${defaultShift?.hours === 0 ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
                                     value={draftCustomHours !== undefined ? draftCustomHours : defaultShift?.hours}
                                     onChange={(e) => {
                                         const val = parseFloat(e.target.value);
                                         setDraftCustomHours(isNaN(val) ? 0 : val);
                                     }}
                                 />
                                 
                                 {(defaultShift?.hours === 0 || (draftCustomHours !== undefined && draftCustomHours !== defaultShift?.hours)) && (
                                     <div className="flex-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                         <Select 
                                             label="Dettaglio / Causale"
                                             value={draftVariationReason}
                                             onChange={(e) => setDraftVariationReason(e.target.value)}
                                             className="w-full text-xs"
                                         >
                                             <option value="">Seleziona causale...</option>
                                             <option value="Straordinario">Straordinario</option>
                                             <option value="Rientro">Rientro</option>
                                             <option value="Prolungamento">Prolungamento</option>
                                             <option value="Uscita Anticipata">Uscita Anticipata</option>
                                             <option value="Permesso Breve">Permesso Breve</option>
                                             <option value="Recupero Ore">Recupero Ore</option>
                                             <option value="Flessibilità">Flessibilità</option>
                                             <option value="Altro">Altro</option>
                                         </Select>
                                     </div>
                                 )}
                             </div>
                             <div className="text-[10px] text-slate-400 mt-1">
                                Standard per {draftShift}: {defaultShift?.hours}h. 
                                {defaultShift?.hours === 0 && " Turno variabile."}
                             </div>
                           </>
                       )}

                       {/* Special Mode Editing */}
                       {isSpecialMode && (
                           <div className="space-y-3 mt-2 animate-in fade-in">
                               <div className="bg-indigo-50 p-2 rounded border border-indigo-100 grid grid-cols-[1.5fr_1fr_1fr_0.6fr_1fr_auto] gap-2 items-end">
                                    <Select 
                                        label="Voce"
                                        value={newSpecialType}
                                        onChange={(e) => setNewSpecialType(e.target.value)}
                                        className="mb-0 text-xs"
                                    >
                                        <option value="Straordinario">Straordinario</option>
                                        <option value="Rientro">Rientro</option>
                                        <option value="Prolungamento">Prolungamento</option>
                                        <option value="Uscita Anticipata">Uscita Anticipata</option>
                                        <option value="Permesso Breve">Permesso Breve</option>
                                        <option value="Recupero Ore">Recupero Ore</option>
                                        <option value="Flessibilità">Flessibilità</option>
                                    </Select>
                                    <Input 
                                        type="time" 
                                        label="Inizio"
                                        value={newSpecialStart}
                                        onChange={(e) => setNewSpecialStart(e.target.value)}
                                        className="mb-0 text-xs"
                                    />
                                    <Input 
                                        type="time" 
                                        label="Fine"
                                        value={newSpecialEnd}
                                        onChange={(e) => setNewSpecialEnd(e.target.value)}
                                        className="mb-0 text-xs"
                                    />
                                    <Input
                                        type="number"
                                        step="0.5"
                                        label="Ore"
                                        value={newSpecialHours}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setNewSpecialHours(isNaN(val) ? '' : val);
                                        }}
                                        className="mb-0 text-xs font-bold text-center"
                                        placeholder="Auto"
                                    />
                                    
                                    {/* Mode Selector */}
                                    <div className="flex flex-col mb-0.5">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Tipo</label>
                                        <div className="flex bg-white rounded border border-slate-300 p-0.5">
                                            <button 
                                                className={`flex-1 px-1 py-1 rounded text-[10px] font-bold transition-colors ${newSpecialMode === 'ADDITIVE' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                                                onClick={() => setNewSpecialMode('ADDITIVE')}
                                                title="Aggiuntive (+)"
                                            >
                                                + Extra
                                            </button>
                                            <button 
                                                className={`flex-1 px-1 py-1 rounded text-[10px] font-bold transition-colors ${newSpecialMode === 'SUBSTITUTIVE' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                                onClick={() => setNewSpecialMode('SUBSTITUTIVE')}
                                                title="Sostitutive (=)"
                                            >
                                                = Sost.
                                            </button>
                                        </div>
                                    </div>

                                    <Button 
                                        variant="primary" 
                                        className="h-[34px] w-[34px] p-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700"
                                        onClick={handleAddSpecialEvent}
                                        title="Aggiungi Voce"
                                    >
                                        <Plus size={16} />
                                    </Button>
                               </div>
                               
                               {/* List of Special Events */}
                               {draftSpecialEvents.length > 0 ? (
                                   <div className="space-y-1">
                                       {draftSpecialEvents.map(ev => (
                                           <div key={ev.id} className="flex items-center justify-between bg-white p-2 border border-slate-200 rounded text-xs">
                                               <div className="flex items-center gap-2">
                                                   <span className={`font-bold ${ev.type === 'Gettone' ? 'text-emerald-700' : 'text-indigo-700'}`}>
                                                       {ev.type}
                                                   </span>
                                                   {ev.type !== 'Gettone' ? (
                                                       <>
                                                            <span className="text-slate-500 font-mono">
                                                                {ev.startTime} - {ev.endTime}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <Badge color={ev.hours > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}>
                                                                    {ev.hours}h
                                                                </Badge>
                                                                {ev.mode === 'SUBSTITUTIVE' ? (
                                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1 rounded border border-slate-200" title="Sostitutivo">=</span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1 rounded border border-indigo-100" title="Aggiuntivo">+</span>
                                                                )}
                                                            </div>
                                                       </>
                                                   ) : (
                                                       <Badge color="bg-emerald-100 text-emerald-800">Forfait</Badge>
                                                   )}
                                               </div>
                                               {/* Allow removing items, including Gettone if added here manually, though toggle handles it mostly */}
                                               <button onClick={() => handleRemoveSpecialEvent(ev.id)} className="text-red-400 hover:text-red-600">
                                                   <Trash2 size={14} />
                                               </button>
                                           </div>
                                       ))}
                                   </div>
                               ) : (
                                   <div className="text-center text-[10px] text-slate-400 italic py-1">Nessuna voce speciale inserita</div>
                               )}
                               
                               <div className="text-[10px] text-indigo-500 mt-1 flex items-start gap-1">
                                   <Info size={12} className="shrink-0 mt-0.5" />
                                   Usa "=" per ore che sostituiscono il turno (es. Permessi), "+" per extra (es. Straordinari).
                               </div>
                           </div>
                       )}
                   </div>
               )}

               <Input 
                 label="Note Turno" 
                 placeholder="Motivazione aggiuntiva, luogo o note..." 
                 value={draftNote}
                 onChange={(e) => setDraftNote(e.target.value)}
               />
               
               {draftShift && (() => {
                   const violation = validateCell(state, selectedCell.opId, selectedCell.date, draftShift);
                   if (violation) return (
                       <div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 rounded text-sm border border-red-100 animate-pulse">
                           <AlertTriangle size={16} />
                           <span className="font-medium">{violation}</span>
                       </div>
                   );
                   return null;
               })()}

               <div className="border-t pt-4">
                 <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                        <Zap size={14} className="text-amber-500" />
                        Suggerimenti Copertura
                    </h4>
                    <Button variant="ghost" className="px-2 py-1 text-xs h-auto" onClick={() => setShowSuggest(!showSuggest)}>
                        {showSuggest ? 'Nascondi' : 'Mostra'}
                    </Button>
                 </div>
                 
                 {showSuggest && (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {suggestions.filter(s => s.operator.id !== selectedCell.opId).slice(0, 5).map((s, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-2 bg-white rounded-md border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group">
                                <div className="flex-1 min-w-0 flex items-center justify-between mr-2">
                                    <div className="flex flex-col min-w-0 mr-2">
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-slate-700 truncate" title={`${s.operator.lastName} ${s.operator.firstName}`}>
                                                {s.operator.lastName} {s.operator.firstName}
                                            </div>
                                            <Badge color={s.score > 80 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
                                                {s.score}
                                            </Badge>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-1">
                                            {s.reasons.slice(0,2).map((r, i) => <span key={i} className="bg-slate-50 px-1 rounded border border-slate-100">{r}</span>)}
                                        </div>
                                    </div>
                                    
                                    {/* CONTEXT TIMELINE: 5 days before, 5 days after */}
                                    <div className="flex gap-0.5 opacity-90 overflow-hidden shrink-0 bg-slate-50 p-1 rounded border border-slate-100">
                                        {Array.from({ length: 11 }).map((_, i) => {
                                            const offset = i - 5;
                                            if (offset === 0) return (
                                                <div key={i} className="w-4 h-4 flex items-center justify-center border-b-2 border-blue-500 bg-white">
                                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                                </div>
                                            );
                                            
                                            const d = addDays(parseISO(selectedCell.date), offset);
                                            const k = formatDateKey(d);
                                            // Get effective shift (Planner or Matrix)
                                            const entry = getEntry(state, s.operator.id, k);
                                            const matrixCode = calculateMatrixShift(s.operator, k, state.matrices);
                                            const code = entry?.shiftCode || matrixCode || '';
                                            const shiftType = state.shiftTypes.find(t => t.code === code);
                                            const color = shiftType?.color || '#f1f5f9';
                                            const textColor = getContrastColor(color);

                                            return (
                                                <div 
                                                    key={i} 
                                                    className="w-4 h-4 flex items-center justify-center text-[8px] font-bold rounded-sm border border-black/5"
                                                    style={{ backgroundColor: color, color: textColor }}
                                                    title={`${format(d, 'dd/MM')}: ${code || 'OFF'}`}
                                                >
                                                    {code ? code.substring(0,2) : ''}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <Button 
                                    variant="secondary" 
                                    className="px-3 py-1.5 text-xs whitespace-nowrap group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200"
                                    onClick={() => handleAssignTo(s.operator.id)}
                                    title="Assegna questo turno a questo operatore"
                                >
                                    <UserPlus size={14} className="inline md:mr-1" />
                                    <span className="hidden md:inline">Assegna</span>
                                </Button>
                            </div>
                        ))}
                        {suggestions.length === 0 && <div className="text-center text-xs text-slate-400 py-2">Nessun altro operatore disponibile.</div>}
                    </div>
                 )}
               </div>

               <div className="flex gap-3 justify-end pt-2 border-t mt-2">
                   {entry?.isManual && (
                       <Button variant="ghost" onClick={handleResetCell} className="text-red-500 hover:bg-red-50 hover:text-red-700 mr-auto">
                           <RotateCcw size={14} className="mr-1 inline" /> Ripristina Originale
                       </Button>
                   )}
                   <Button variant="ghost" onClick={() => setEditMode(false)}>Annulla</Button>
                   <Button variant="primary" onClick={saveChanges} className="px-6 shadow-md hover:shadow-lg transform active:scale-95 transition-all">
                       <Save size={16} className="mr-2" />
                       Salva Modifiche
                   </Button>
               </div>
             </div>
           );
        })()}
      </Modal>

      {/* Modal Matrix Assignment */}
      <Modal isOpen={!!matrixAssignment} onClose={() => setMatrixAssignment(null)} title="Assegna Matrice Rapida">
          {matrixAssignment && (() => {
              const op = state.operators.find(o => o.id === matrixAssignment.opId);
              const currentMatrix = state.matrices.find(m => m.id === op?.matrixId);
              const hasExisting = !!op?.matrixId;

              return (
                  <div className="space-y-4">
                      <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3">
                          <CalendarClock className="text-indigo-600 shrink-0" size={20} />
                          <div className="text-sm text-indigo-900">
                              <p className="font-bold mb-1">Configura Rotazione per {op?.lastName}</p>
                              <p>Stai impostando una nuova matrice a partire dal giorno: <br/><strong className="text-base">{format(parseISO(matrixAssignment.date), 'dd MMMM yyyy')}</strong>.</p>
                          </div>
                      </div>

                      <div className="bg-amber-50 p-3 rounded border border-amber-200 text-xs text-amber-800 flex gap-2 items-center">
                          <AlertTriangle size={16} className="shrink-0" />
                          <span>
                              Questa azione aggiungerà una nuova voce allo storico matrici e chiuderà automaticamente il periodo precedente (se esistente) al giorno prima della data selezionata.
                          </span>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Seleziona Matrice</label>
                          <Select 
                              value={selectedMatrixId} 
                              onChange={(e) => setSelectedMatrixId(e.target.value)}
                              className="w-full"
                          >
                              <option value="">Seleziona...</option>
                              {state.matrices.map(m => (
                                  <option key={m.id} value={m.id}>{m.name} ({m.sequence.length} turni)</option>
                              ))}
                          </Select>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t">
                          <Button variant="ghost" onClick={() => setMatrixAssignment(null)}>Annulla</Button>
                          <Button 
                            variant="primary" 
                            disabled={!selectedMatrixId}
                            onClick={handleConfirmMatrixAssignment}
                          >
                              Conferma Assegnazione
                          </Button>
                      </div>
                  </div>
              );
          })()}
      </Modal>
    </div>
  );
};