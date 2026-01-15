
import React, { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom'; // Importante per la stampa
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, validateCell, getShiftByCode, getSuggestions, parseISO, isOperatorEmployed, getItalianHolidayName, startOfMonth, startOfWeek, endOfWeek, subWeeks, addWeeks, endOfMonth, isItalianHoliday } from '../utils';
import { format, isToday, isWeekend, addMonths, differenceInDays, addDays, isWithinInterval, isSameMonth, isSunday, isBefore, eachDayOfInterval, isSaturday } from 'date-fns';
import { ChevronLeft, ChevronRight, Filter, Download, Zap, AlertTriangle, UserCheck, RefreshCw, Edit2, X, Info, Save, UserPlus, Check, ArrowRightLeft, Wand2, HelpCircle, Eye, RotateCcw, Copy, ClipboardPaste, CalendarClock, Clock, Layers, GitCompare, Layout, CalendarDays, Search, List, MousePointer2, Eraser, CalendarOff, BarChart3, UserCog, StickyNote, Printer, Plus, Trash2, Watch, Coins, ArrowUpCircle, ArrowRightCircle, FileSpreadsheet, Undo, Redo, ArrowRight, ChevronDown, ChevronUp, FileText, History, Menu, Settings2, XCircle, Share2, Send, Cloud, CloudOff, Loader2, CheckCircle, PartyPopper, Star, CheckCircle2, Users, FileClock, Calendar, Grid, Columns, Briefcase, MoveRight, CheckCheck, MessageSquare, ShieldCheck, CheckCircle2 as CheckIcon } from 'lucide-react';
import { Button, Modal, Select, Input, Badge } from '../components/UI';
import { PlannerEntry, ViewMode, ShiftType, SpecialEvent, CoverageConfig, DayNote, DayNoteType } from '../types';
import { OperatorDetailModal } from '../components/OperatorDetailModal';
import { PrintLayout } from '../components/PrintLayout';
import { TimesheetPrintLayout } from '../components/TimesheetPrintLayout';
import { SingleOperatorCalendarLayout } from '../components/SingleOperatorCalendarLayout';

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
const ITALIAN_DAY_INITIALS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const NOTE_TYPES: Record<DayNoteType, { icon: React.ElementType, color: string, label: string }> = {
    INFO: { icon: StickyNote, color: 'text-amber-500', label: 'Nota' },
    ALERT: { icon: AlertTriangle, color: 'text-red-500', label: 'Urgent' },
    EVENT: { icon: Star, color: 'text-blue-500', label: 'Evento' },
    MEETING: { icon: Users, color: 'text-purple-500', label: 'Meet' },
    HOLIDAY: { icon: PartyPopper, color: 'text-pink-500', label: 'Festa' },
    CHECK: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Ok' }
};

export const Planner = () => {
  const { state, dispatch, history, syncStatus, saveToCloud } = useApp();
  
  const [displayMode, setDisplayMode] = useState<DisplayMode>('PLANNER_STANDARD');
  const [viewSpan, setViewSpan] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [selectedCell, setSelectedCell] = useState<{ opId: string; date: string } | null>(null);
  const [showCellReport, setShowCellReport] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isBulkEdit, setIsBulkEdit] = useState(false); 
  const [showPrevDays, setShowPrevDays] = useState(false);
  const [groupByMatrix, setGroupByMatrix] = useState(true);
  const [highlightPast, setHighlightPast] = useState(false);
  const [highlightNotes, setHighlightNotes] = useState(false); // NEW: Toggle highlight notes
  const [isCoverageExpanded, setIsCoverageExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [coveragePopover, setCoveragePopover] = useState<{ date: string; x: number; y: number } | null>(null);
  // FIX: Updated type for better positioning control
  const [cellPopupPosition, setCellPopupPosition] = useState<{x: number, top?: number, bottom?: number, maxHeight?: number} | null>(null);
  const [multiSelectPopupPosition, setMultiSelectPopupPosition] = useState<{x: number, y: number} | null>(null);
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [hoveredOpId, setHoveredOpId] = useState<string | null>(null);
  
  // NEW: State for Note Tooltip
  const [noteTooltip, setNoteTooltip] = useState<{ x: number, y: number, text: string } | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('planner_searchTerm') || '');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MODIFIED' | 'EXTRA'>(() => {
      const saved = localStorage.getItem('planner_filterStatus');
      return (['ALL', 'ACTIVE', 'INACTIVE', 'MODIFIED', 'EXTRA'].includes(saved || '')) ? saved as any : 'ACTIVE';
  });
  const [filterMatrix, setFilterMatrix] = useState<string>(() => localStorage.getItem('planner_filterMatrix') || 'ALL');
  
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printTargetId, setPrintTargetId] = useState<string | null>(null);
  const [printLayoutMode, setPrintLayoutMode] = useState<'VISUAL' | 'TIMESHEET' | 'CALENDAR'>('VISUAL');
  const isMatrixView = displayMode === 'MATRIX_ONLY' || displayMode === 'MATRIX_DIFF';
  const [tooltipPos, setTooltipPos] = useState<{x: number, y: number, isBottom: boolean} | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{ source: { opId: string; date: string }, target: { opId: string; date: string } } | null>(null);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [matrixAssignment, setMatrixAssignment] = useState<{ opId: string; date: string } | null>(null);
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>('');
  const [applyMatrixOpId, setApplyMatrixOpId] = useState('');
  const [applyMatrixId, setApplyMatrixId] = useState('');
  const [applyMatrixStart, setApplyMatrixStart] = useState('');
  const [detailsOpId, setDetailsOpId] = useState<string | null>(null);
  const [noteOpId, setNoteOpId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [editingDayNote, setEditingDayNote] = useState<{ date: string; note: DayNote } | null>(null);
  const [editingOperatorNote, setEditingOperatorNote] = useState<{ opId: string; name: string; text: string } | null>(null);
  const [multiSelection, setMultiSelection] = useState<{ opId: string, start: string, end: string } | null>(null);
  const [clipboard, setClipboard] = useState<string[] | null>(null);
  const [draggingCell, setDraggingCell] = useState<{ opId: string; date: string } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ opId: string; date: string } | null>(null);
  const [swapSource, setSwapSource] = useState<{ opId: string; date: string } | null>(null);
  const [dragActionPrompt, setDragActionPrompt] = useState<{
      source: { opId: string, date: string, code: string, entry: PlannerEntry | null, name: string },
      target: { opId: string, date: string, code: string, entry: PlannerEntry | null, name: string }
  } | null>(null);
  const [lastOperation, setLastOperation] = useState<LastOperation | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const [draftShift, setDraftShift] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftVariationReason, setDraftVariationReason] = useState('');
  const [draftCustomHours, setDraftCustomHours] = useState<number | undefined>(undefined);
  const [draftSpecialEvents, setDraftSpecialEvents] = useState<SpecialEvent[]>([]);
  const [newSpecialType, setNewSpecialType] = useState('Straordinario');
  const [newSpecialStart, setNewSpecialStart] = useState('');
  const [newSpecialEnd, setNewSpecialEnd] = useState('');
  const [newSpecialHours, setNewSpecialHours] = useState<number | ''>('');
  const [newSpecialHoursMode, setNewSpecialHoursMode] = useState<'ADDITIVE' | 'SUBSTITUTIVE' | 'SUBTRACTIVE'>('ADDITIVE');
  const [isSpecialMode, setIsSpecialMode] = useState(false);

  // When printTargetId changes, default to Calendar mode for single operator
  useEffect(() => {
      if (printTargetId) {
          setPrintLayoutMode('CALENDAR');
      } else {
          setPrintLayoutMode('VISUAL');
      }
  }, [printTargetId]);

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
              const hasModification = days.some(d => {
                  const dateKey = formatDateKey(d);
                  const entry = getEntry(state, op.id, dateKey);
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
          if (filterMatrix !== 'ALL' && op.matrixId !== filterMatrix) return false; 
          if (searchTerm) {
              const fullName = `${op.lastName} ${op.firstName}`.toLowerCase();
              if (!fullName.includes(searchTerm.toLowerCase())) return false;
          }
          return true;
      });
  }, [state.operators, filterStatus, filterMatrix, searchTerm, days, state.plannerData]);

  // ... (rest of planner logic unchanged)
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
          const indexA = state.matrices.findIndex(m => m.id === a);
          const indexB = state.matrices.findIndex(m => m.id === b);
          if (indexA === -1 && indexB !== -1) return 1;
          if (indexA !== -1 && indexB === -1) return -1;
          return indexA - indexB;
      });
  }, [groupedOperators, state.matrices, groupByMatrix]);

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
      if (diff < 0) diff += 24; 
      return parseFloat(diff.toFixed(2));
  };

  useEffect(() => {
      if (newSpecialStart && newSpecialEnd) {
          const dur = calculateDuration(newSpecialStart, newSpecialEnd);
          setNewSpecialHours(dur);
      }
  }, [newSpecialStart, newSpecialEnd]);

  useEffect(() => {
      if (window.innerWidth < 768 && days.length > 7) {
          const todayKey = formatDateKey(new Date());
          const isTodayVisible = days.some(d => formatDateKey(d) === todayKey);
          if (isTodayVisible) {
              setTimeout(() => {
                  const el = document.getElementById(`day-header-${todayKey}`);
                  if (el && gridScrollRef.current) {
                      const stickyWidth = 128;
                      const targetScroll = el.offsetLeft - stickyWidth;
                      gridScrollRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
                  }
              }, 100);
          } else {
              if (gridScrollRef.current) {
                  gridScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
              }
          }
      }
  }, [state.currentDate, days]);

  const getContrastColor = (hexColor?: string) => {
      if (!hexColor) return 'text-slate-700';
      const r = parseInt(hexColor.substring(1, 3), 16);
      const g = parseInt(hexColor.substring(3, 5), 16);
      const b = parseInt(hexColor.substring(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? 'text-slate-900' : 'text-white';
  };

  const clearSelection = () => {
    setSelectedCell(null);
    setShowCellReport(false);
    setShowEditModal(false);
    setTooltipPos(null);
    setMultiSelection(null);
    setCellPopupPosition(null);
    setMultiSelectPopupPosition(null);
    setCoveragePopover(null);
  };

  const handlePrev = () => {
    const date = parseISO(state.currentDate);
    if (viewSpan === 'WEEK') {
        dispatch({ type: 'SET_DATE', payload: format(subWeeks(date, 1), 'yyyy-MM-dd') });
    } else {
        dispatch({ type: 'SET_DATE', payload: format(addMonths(date, -1), 'yyyy-MM-dd') });
    }
    clearSelection();
  };

  const handleNext = () => {
    const date = parseISO(state.currentDate);
    if (viewSpan === 'WEEK') {
        dispatch({ type: 'SET_DATE', payload: format(addWeeks(date, 1), 'yyyy-MM-dd') });
    } else {
        dispatch({ type: 'SET_DATE', payload: format(addMonths(date, 1), 'yyyy-MM-dd') });
    }
    clearSelection();
  };

  const handleToday = () => {
    dispatch({ type: 'SET_DATE', payload: format(new Date(), 'yyyy-MM-dd') });
    clearSelection();
  };

  const getHeaderLabel = () => {
      const date = parseISO(state.currentDate);
      if (viewSpan === 'WEEK') {
          const start = startOfWeek(date, { weekStartsOn: 1 });
          const end = endOfWeek(date, { weekStartsOn: 1 });
          const startFormat = isSameMonth(start, end) ? 'd' : 'd MMM';
          return `${format(start, startFormat)} - ${format(end, 'd MMM yyyy')}`;
      }
      return `${ITALIAN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  };

  // ... (drag and drop and other handlers remain the same)
  const handleDragStart = (e: React.DragEvent, opId: string, date: string, isEmployed: boolean) => {
    if (!isEmployed) {
        e.preventDefault();
        return;
    }
    setDraggingCell({ opId, date });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ opId, date }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCellDragEnter = (opId: string, date: string, isEmployed: boolean) => {
      if (draggingCell && isEmployed) {
          if (dragOverCell?.opId !== opId || dragOverCell?.date !== date) {
              setDragOverCell({ opId, date });
          }
      }
  };

  const handleDragEnd = () => {
    setDraggingCell(null);
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, targetOpId: string, targetDate: string, isEmployed: boolean) => {
    e.preventDefault();
    setDragOverCell(null); 
    
    if (!draggingCell || !isEmployed) return;

    const { opId: sourceOpId, date: sourceDate } = draggingCell;
    if (sourceOpId === targetOpId && sourceDate === targetDate) {
        setDraggingCell(null);
        return;
    }

    const sourceEntry = getEntry(state, sourceOpId, sourceDate);
    const sourceOp = state.operators.find(o => o.id === sourceOpId);
    const sourceMatrixCode = sourceOp ? calculateMatrixShift(sourceOp, sourceDate, state.matrices) : null;
    const effectiveSourceCode = sourceEntry ? sourceEntry.shiftCode : (sourceMatrixCode || '');

    const targetEntry = getEntry(state, targetOpId, targetDate);
    const targetOp = state.operators.find(o => o.id === targetOpId);
    const targetMatrixCode = targetOp ? calculateMatrixShift(targetOp, targetDate, state.matrices) : null;
    const effectiveTargetCode = targetEntry ? targetEntry.shiftCode : (targetMatrixCode || '');

    if (!effectiveSourceCode) {
        setDraggingCell(null);
        return;
    }

    setDragActionPrompt({
        source: { 
            opId: sourceOpId, 
            date: sourceDate, 
            code: effectiveSourceCode, 
            entry: sourceEntry,
            name: `${sourceOp?.lastName} ${sourceOp?.firstName}` 
        },
        target: { 
            opId: targetOpId, 
            date: targetDate, 
            code: effectiveTargetCode, 
            entry: targetEntry,
            name: `${targetOp?.lastName} ${targetOp?.firstName}` 
        }
    });

    setDraggingCell(null);
  };

  const resolveDragAction = (action: 'SWAP' | 'COPY' | 'MOVE') => {
      if (!dragActionPrompt) return;
      const { source, target } = dragActionPrompt;
      const updates: PlannerEntry[] = [];

      const targetViolation = validateCell(state, target.opId, target.date, source.code);
      updates.push({
          operatorId: target.opId,
          date: target.date,
          shiftCode: source.code,
          note: source.entry?.note, 
          isManual: true,
          violation: targetViolation || undefined,
          variationReason: action === 'SWAP' ? 'Scambio' : (action === 'MOVE' ? 'Spostamento' : 'Copia'),
          customHours: source.entry?.customHours,
          specialEvents: source.entry?.specialEvents
      });

      if (action === 'SWAP') {
          const sourceViolation = validateCell(state, source.opId, source.date, target.code);
          updates.push({
              operatorId: source.opId,
              date: source.date,
              shiftCode: target.code,
              note: target.entry?.note,
              isManual: true,
              violation: sourceViolation || undefined,
              variationReason: 'Scambio',
              customHours: target.entry?.customHours,
              specialEvents: target.entry?.specialEvents
          });
      } else if (action === 'MOVE') {
          updates.push({
              operatorId: source.opId,
              date: source.date,
              shiftCode: '', 
              isManual: true,
              violation: undefined
          });
      }

      if (updates.length > 0) {
          dispatch({ type: 'BATCH_UPDATE', payload: updates });
          
          const logMsg = action === 'SWAP' ? 'Scambio Turni' : (action === 'MOVE' ? 'Spostamento Turno' : 'Copia Turno');
          dispatch({ 
              type: 'ADD_LOG', 
              payload: { 
                  id: crypto.randomUUID(), 
                  timestamp: Date.now(), 
                  operatorId: target.opId, 
                  actionType: 'UPDATE', 
                  reason: `${logMsg} da ${format(parseISO(source.date), 'dd/MM')} (${source.name})`, 
                  user: 'CurrentUser', 
                  targetDate: target.date 
              } 
          });
      }

      setDragActionPrompt(null);
  };

  const handleCopySelection = () => {
    if (!multiSelection) return;
    const { opId, start, end } = multiSelection;
    const s = parseISO(start);
    const e = parseISO(end);
    const daysRange = eachDayOfInterval({ start: s, end: e });
    const codes = daysRange.map(d => {
        const dKey = formatDateKey(d);
        const entry = getEntry(state, opId, dKey);
        if (entry) return entry.shiftCode;
        const op = state.operators.find(o => o.id === opId);
        return (op ? calculateMatrixShift(op, dKey, state.matrices) : '') || '';
    });
    setClipboard(codes);
    setMultiSelection(null);
    setMultiSelectPopupPosition(null);
  };

  const handlePasteSelection = () => {
    if (!clipboard || !selectedCell) return;
    const start = parseISO(selectedCell.date);
    const updates: PlannerEntry[] = [];
    clipboard.forEach((code, idx) => {
        const d = addDays(start, idx);
        const dKey = formatDateKey(d);
        const opId = selectedCell.opId;
        const violation = validateCell(state, opId, dKey, code);
        updates.push({ operatorId: opId, date: dKey, shiftCode: code, isManual: true, violation: violation || undefined });
    });
    if (updates.length > 0) {
        dispatch({ type: 'BATCH_UPDATE', payload: updates });
        dispatch({ type: 'ADD_LOG', payload: { id: crypto.randomUUID(), timestamp: Date.now(), operatorId: selectedCell.opId, actionType: 'UPDATE', reason: `Incolla (${updates.length} gg)`, user: 'CurrentUser', targetDate: selectedCell.date } });
    }
    setClipboard(null);
    setSelectedCell(null);
    setMultiSelectPopupPosition(null);
  };

  const handleBulkAssign = (shiftCode: string) => {
      if (!multiSelection) return;
      const { opId, start, end } = multiSelection;
      const s = parseISO(start);
      const e = parseISO(end);
      const daysRange = eachDayOfInterval({ start: s, end: e });
      const updates: PlannerEntry[] = [];
      const removeList: { operatorId: string, date: string }[] = [];

      daysRange.forEach(d => {
          const dateKey = formatDateKey(d);
          if (shiftCode === 'RESET') {
              removeList.push({ operatorId: opId, date: dateKey });
          } else {
             let codeToAssign = shiftCode;
             if (codeToAssign === 'FE' && isSunday(d)) codeToAssign = 'R';
             const violation = validateCell(state, opId, dateKey, codeToAssign);
             updates.push({ operatorId: opId, date: dateKey, shiftCode: codeToAssign, isManual: true, violation: violation || undefined });
          }
      });

      if (removeList.length > 0) removeList.forEach(item => dispatch({ type: 'REMOVE_CELL', payload: item }));
      if (updates.length > 0) dispatch({ type: 'BATCH_UPDATE', payload: updates });

      dispatch({ type: 'ADD_LOG', payload: { id: crypto.randomUUID(), timestamp: Date.now(), operatorId: opId, actionType: 'UPDATE', reason: shiftCode === 'RESET' ? 'Ripristino Matrice (Multi)' : (shiftCode === '' ? 'Svuota Cella (Multi)' : `Assegnazione Multipla (${shiftCode})`), user: 'CurrentUser', targetDate: start } });
      setMultiSelection(null);
      setMultiSelectPopupPosition(null);
      setShowBulkModal(false);
  };

  const handleConfirmSelection = () => {
    if (!multiSelection) return;
    const { opId, start, end } = multiSelection;
    const s = parseISO(start);
    const e = parseISO(end);
    const daysRange = eachDayOfInterval({ start: s, end: e });
    const updates: PlannerEntry[] = [];

    const op = state.operators.find(o => o.id === opId);
    if (!op) return;

    daysRange.forEach(d => {
        const dateKey = formatDateKey(d);
        const entry = getEntry(state, op.id, dateKey);
        
        if (!entry) {
            const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
            if (matrixCode) {
                 const violation = validateCell(state, opId, dateKey, matrixCode);
                 updates.push({
                     operatorId: opId,
                     date: dateKey,
                     shiftCode: matrixCode,
                     isManual: true, 
                     violation: violation || undefined
                 });
            }
        }
    });

    if (updates.length > 0) {
        dispatch({ type: 'BATCH_UPDATE', payload: updates });
        dispatch({ 
            type: 'ADD_LOG', 
            payload: { 
                id: crypto.randomUUID(), 
                timestamp: Date.now(), 
                operatorId: opId, 
                actionType: 'UPDATE', 
                reason: `Consolidamento Matrice (${updates.length} gg)`, 
                user: 'CurrentUser', 
                targetDate: start 
            } 
        });
    }
    setMultiSelection(null);
    setMultiSelectPopupPosition(null);
  };

  const handleApplyMatricesClick = () => {
     if (selectedCell) setApplyMatrixOpId(selectedCell.opId);
     setApplyMatrixStart(state.currentDate);
     setShowMatrixModal(true);
  };

  const handleApplyMatrixSubmit = () => {
      if (!applyMatrixOpId || !applyMatrixId || !applyMatrixStart) return;
      const op = state.operators.find(o => o.id === applyMatrixOpId);
      if (!op) return;
      const currentHistory = op.matrixHistory || [];
      const newHistory = [...currentHistory];
      newHistory.sort((a, b) => a.startDate.localeCompare(b.startDate));
      const newDateObj = parseISO(applyMatrixStart);
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
      const filteredHistory = newHistory.filter(a => a.startDate < applyMatrixStart);
      filteredHistory.push({ id: crypto.randomUUID(), matrixId: applyMatrixId, startDate: applyMatrixStart, endDate: undefined });
      dispatch({ type: 'UPDATE_OPERATOR', payload: { ...op, matrixHistory: filteredHistory } });
      dispatch({ type: 'ADD_LOG', payload: { id: crypto.randomUUID(), timestamp: Date.now(), operatorId: op.id, actionType: 'UPDATE', reason: 'Applicazione Nuova Matrice da Planner', user: 'CurrentUser' } });
      setShowMatrixModal(false);
      setApplyMatrixOpId('');
      setApplyMatrixId('');
      setApplyMatrixStart('');
  };

  const handleOpenDayNote = (dateKey: string) => {
      const note = state.dayNotes[dateKey];
      const noteObj: DayNote = (typeof note === 'string' || !note) 
         ? { text: typeof note === 'string' ? note : '', type: 'INFO' } 
         : note;
      setEditingDayNote({ date: dateKey, note: noteObj });
  };

  // ... (rest of imports and CSV export logic unchanged)
  
  const handleExportForGoogleSheets = async () => {
      if (!state.config.googleScriptUrl) {
          alert("Errore: URL Google Script non configurato in Impostazioni.");
          return;
      }

      setIsExporting(true);
      try {
          const monthDays = getMonthDays(state.currentDate);
          
          const exportData = {
              monthLabel: getHeaderLabel(),
              days: monthDays.map(d => d.getDate()),
              dayInitials: monthDays.map(d => ITALIAN_DAY_INITIALS[d.getDay()]),
              operators: state.operators.filter(op => op.isActive).map(op => {
                  let opTotalHours = 0;
                  
                  const shifts = monthDays.map(d => {
                      const dk = formatDateKey(d);
                      if (!isOperatorEmployed(op, dk)) return '';
                      
                      const entry = getEntry(state, op.id, dk);
                      const matrixCode = calculateMatrixShift(op, dk, state.matrices);
                      const code = entry?.shiftCode || matrixCode || '';
                      
                      const st = state.shiftTypes.find(s => s.code === code);
                      let h = 0;
                      
                      if (entry?.customHours !== undefined) {
                          h = entry.customHours;
                      } else if (st) {
                        if (st.inheritsHours && matrixCode) {
                            const mst = state.shiftTypes.find(s => s.code === matrixCode);
                            h = mst?.hours || 0;
                        } else {
                            h = st.hours;
                        }
                      }
                      
                      opTotalHours += h;
                      
                      if (entry?.specialEvents) {
                        entry.specialEvents.forEach(ev => {
                            if (ev.mode === 'ADDITIVE' || !ev.mode) opTotalHours += ev.hours;
                            else if (ev.mode === 'SUBTRACTIVE') opTotalHours -= ev.hours;
                        });
                      }
                      return code;
                  });
                  
                  return {
                      name: `${op.lastName} ${op.firstName}`,
                      totalHours: opTotalHours.toFixed(1).replace('.', ','),
                      shifts
                  };
              })
          };

          await fetch(state.config.googleScriptUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(exportData)
          });

          alert("Dati inviati con successo al Foglio Master!");
      } catch (err) {
          console.error(err);
          alert("Si è verificato un errore durante l'invio dei dati.");
      } finally {
          setIsExporting(false);
      }
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
      link.setAttribute("download", `turni_export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };
  
  // FIXED: Updated handleCellClick to support new safe positioning
  const handleCellClick = (e: React.MouseEvent, opId: string, date: string, isEmployed: boolean) => {
    if (!isEmployed) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
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
        setCellPopupPosition(null);
        setMultiSelectPopupPosition({ x: rect.right + 10, y: rect.top });
        return;
    }
    if (swapSource) {
        if (swapSource.opId === opId && swapSource.date === date) { setSwapSource(null); } else { setPendingSwap({ source: swapSource, target: { opId, date } }); setSwapSource(null); }
        return;
    }
    setSelectedCell({ opId, date });
    setMultiSelection(null);
    setMultiSelectPopupPosition(null);
    setShowCellReport(false); 
    
    const op = state.operators.find(o => o.id === opId);
    const entry = getEntry(state, opId, date);
    const mx = op ? calculateMatrixShift(op, date, state.matrices) : null;
    setDraftShift(entry?.shiftCode ?? mx ?? '');
    setDraftNote(entry?.note ?? '');
    setDraftVariationReason(entry?.variationReason ?? '');
    setDraftCustomHours(entry?.customHours); 
    setDraftSpecialEvents(entry?.specialEvents || []);
    setIsSpecialMode((entry?.specialEvents && entry.specialEvents.length > 0) || false);
    
    // --- POSITIONING LOGIC UPDATE ---
    const SCREEN_PADDING = 15;
    const CELL_GAP = 8; // Gap to ensure no overlap
    const POPUP_WIDTH = 280; // Matches CSS width
    
    const screenHeight = window.innerHeight;
    const screenWidth = window.innerWidth;
    const spaceBelow = screenHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Horizontal Positioning (Clamp to screen)
    let x = rect.left + rect.width / 2;
    if (x - (POPUP_WIDTH / 2) < SCREEN_PADDING) x = (POPUP_WIDTH / 2) + SCREEN_PADDING;
    if (x + (POPUP_WIDTH / 2) > screenWidth - SCREEN_PADDING) x = screenWidth - (POPUP_WIDTH / 2) - SCREEN_PADDING;

    // Vertical Positioning (Prefer below, switch to above if tight)
    const preferBottom = spaceBelow > 400 || spaceBelow > spaceAbove;
    
    let posData: any = { x };

    if (preferBottom) {
        posData.top = rect.bottom + CELL_GAP;
        posData.maxHeight = spaceBelow - CELL_GAP - SCREEN_PADDING;
    } else {
        // Anchor to bottom of screen relative to cell top
        posData.bottom = screenHeight - rect.top + CELL_GAP;
        posData.maxHeight = spaceAbove - CELL_GAP - SCREEN_PADDING;
    }
    
    setCellPopupPosition(posData);
  };

  const handleRightClick = (e: React.MouseEvent, opId: string, date: string, isEmployed: boolean) => {
      e.preventDefault();
      if (!isEmployed) return;
      if (isMatrixView) return; 
      if (!lastOperation) return;
      if (lastOperation.type === 'DELETE') {
          dispatch({ type: 'REMOVE_CELL', payload: { operatorId: opId, date } });
      } else {
          let codeToApply = lastOperation.shiftCode;
          if (codeToApply && codeToApply.startsWith('F') && isSunday(parseISO(date))) codeToApply = 'R';
          let hoursToApply = lastOperation.customHours;
          const sType = state.shiftTypes.find(s => s.code === codeToApply);
          if (sType?.inheritsHours) {
              const operator = state.operators.find(o => o.id === opId);
              if (operator) {
                  const matrixCode = calculateMatrixShift(operator, date, state.matrices);
                  const matrixShift = state.shiftTypes.find(s => s.code === matrixCode);
                  if (matrixShift) hoursToApply = matrixShift.hours;
              }
          }
          const violation = validateCell(state, opId, date, codeToApply);
          const newEntry: PlannerEntry = { operatorId: opId, date: date, shiftCode: codeToApply, note: lastOperation.note, isManual: true, violation: violation || undefined, variationReason: lastOperation.variationReason, customHours: hoursToApply, specialEvents: lastOperation.specialEvents };
          dispatch({ type: 'UPDATE_CELL', payload: newEntry });
          dispatch({ type: 'ADD_LOG', payload: { id: crypto.randomUUID(), timestamp: Date.now(), operatorId: opId, actionType: 'UPDATE', reason: 'Applicazione Rapida (Tasto Dx)', user: 'CurrentUser', targetDate: date } });
      }
      clearSelection();
  };

  const handleCellDoubleClick = () => {
    if (!isMatrixView && selectedCell) {
        const op = state.operators.find(o => o.id === selectedCell.opId);
        const entry = getEntry(state, selectedCell.opId, selectedCell.date);
        const matrixShift = op ? calculateMatrixShift(op, selectedCell.date, state.matrices) : null;
        const currentCode = entry?.shiftCode ?? matrixShift ?? '';
        setDraftShift(currentCode);
        setDraftNote(entry?.note ?? '');
        setDraftVariationReason(entry?.variationReason ?? '');
        setDraftCustomHours(entry?.customHours); 
        setDraftSpecialEvents(entry?.specialEvents || []);
        setNewSpecialType('Straordinario');
        setNewSpecialStart('');
        setNewSpecialEnd('');
        setNewSpecialHours('');
        setShowEditModal(true);
        setCellPopupPosition(null);
    }
  };

  const saveChanges = () => {
      if (!selectedCell) return;
      const targets: string[] = [];
      if (isBulkEdit && multiSelection && multiSelection.opId === selectedCell.opId) {
          const range = eachDayOfInterval({ start: parseISO(multiSelection.start), end: parseISO(multiSelection.end) });
          targets.push(...range.map(d => formatDateKey(d)));
      } else {
          targets.push(selectedCell.date);
      }
      const updates: PlannerEntry[] = [];
      const removeList: { operatorId: string, date: string }[] = [];
      targets.forEach(dateTarget => {
          if (!draftShift && !draftNote && !isSpecialMode) {
              removeList.push({ operatorId: selectedCell.opId, date: dateTarget });
              return;
          }
          let finalSpecialEvents = [...draftSpecialEvents];
          if (isSpecialMode && (newSpecialHours !== '' || (newSpecialStart && newSpecialEnd))) {
              const hours = typeof newSpecialHours === 'number' ? newSpecialHours : 0;
              finalSpecialEvents.push({ id: crypto.randomUUID(), type: newSpecialType, hours: hours, startTime: newSpecialStart, endTime: newSpecialEnd, mode: newSpecialHoursMode });
          }
          let codeToApply = draftShift;
          if (codeToApply === 'FE' && isSunday(parseISO(dateTarget))) codeToApply = 'R';
          if (codeToApply && codeToApply.startsWith('F') && isSunday(parseISO(dateTarget)) && codeToApply !== 'FE') codeToApply = 'R';
          const violation = validateCell(state, selectedCell.opId, dateTarget, codeToApply);
          updates.push({ operatorId: selectedCell.opId, date: dateTarget, shiftCode: codeToApply, note: draftNote, isManual: true, violation: violation || undefined, variationReason: draftVariationReason || undefined, customHours: draftCustomHours, specialEvents: finalSpecialEvents });
      });
      if (removeList.length > 0) removeList.forEach(item => dispatch({ type: 'REMOVE_CELL', payload: item }));
      if (updates.length > 0) dispatch({ type: 'BATCH_UPDATE', payload: updates });
      dispatch({ type: 'ADD_LOG', payload: { id: crypto.randomUUID(), timestamp: Date.now(), operatorId: selectedCell.opId, actionType: 'UPDATE', newValue: draftShift, reason: isBulkEdit ? `Modifica Massiva (${targets.length} gg)` : (draftNote || 'Modifica Manuale'), user: 'CurrentUser', targetDate: selectedCell.date } });
      if (draftShift) {
          setLastOperation({ type: 'UPDATE', shiftCode: draftShift, note: draftNote, variationReason: draftVariationReason, customHours: draftCustomHours, specialEvents: draftSpecialEvents });
      } else {
          setLastOperation({ type: 'DELETE' });
      }
      clearSelection();
  };

  const addSpecialEvent = () => {
      if (newSpecialHours === '' && newSpecialType !== 'Gettone') return; 
      const hours = typeof newSpecialHours === 'number' ? newSpecialHours : 0;
      const newEvent: SpecialEvent = {
          id: crypto.randomUUID(),
          type: newSpecialType,
          hours: hours,
          startTime: newSpecialStart,
          endTime: newSpecialEnd,
          mode: newSpecialHoursMode 
      };
      setDraftSpecialEvents([...draftSpecialEvents, newEvent]);
      setNewSpecialHours('');
      setNewSpecialStart('');
      setNewSpecialEnd('');
  };

  const toggleGettone = () => {
    const hasGettone = draftSpecialEvents.some(e => e.type === 'Gettone');
    if (hasGettone) {
        setDraftSpecialEvents(prev => prev.filter(e => e.type !== 'Gettone'));
    } else {
        setDraftSpecialEvents(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'Gettone',
            hours: 0,
            startTime: '',
            endTime: '',
            mode: 'ADDITIVE'
        }]);
    }
  };

  const addSpecialType = () => {
      const type = prompt("Inserisci il nome della nuova voce speciale:");
      if (type && type.trim()) {
          dispatch({ type: 'ADD_SPECIAL_EVENT_TYPE', payload: type.trim() });
          setNewSpecialType(type.trim());
      }
  };

  const renderCell = (op: any, day: Date) => {
    // ... (renderCell implementation remains unchanged)
    const dateKey = formatDateKey(day);
    const isEmployed = isOperatorEmployed(op, dateKey);
    const entry = getEntry(state, op.id, dateKey);
    const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
    const isCurrentMonth = isSameMonth(day, parseISO(state.currentDate));
    const holidayName = getItalianHolidayName(day);
    const isHol = !!holidayName; 
    const isPast = isBefore(day, new Date(new Date().setHours(0,0,0,0)));

    let displayCode = '';
    let isGhost = false;
    let isMatrixOverride = false;
    let manualOverrideCode = '';
    
    const isRowHovered = hoveredOpId === op.id;
    const isColHovered = hoveredDate === dateKey;
    const isHoveredCell = hoveredOpId === op.id && hoveredDate === dateKey;
    
    const isRedDay = isItalianHoliday(day);
    const isSat = isSaturday(day) && !isRedDay;

    if (!isEmployed) {
        return (
             <div 
                key={dateKey} 
                className={`flex-1 min-w-[44px] md:min-w-0 border-r border-b border-slate-300 h-10 md:h-8 relative group ${isRowHovered ? 'bg-blue-100/40' : 'bg-slate-100'}`}
                style={{ 
                    backgroundImage: !isRowHovered ? 'repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 2px, transparent 0, transparent 50%)' : undefined,
                    backgroundSize: '6px 6px',
                    opacity: 0.6,
                    cursor: 'not-allowed'
                }} 
                onContextMenu={(e) => e.preventDefault()} 
             />
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
    const isDragOver = dragOverCell?.opId === op.id && dragOverCell?.date === dateKey;

    let isMultiSelected = false;
    if (multiSelection && multiSelection.opId === op.id) {
        const current = parseISO(dateKey);
        const start = parseISO(multiSelection.start);
        const end = parseISO(multiSelection.end);
        if (isWithinInterval(current, { start, end })) isMultiSelected = true;
    }

    let coverageStatus: 'CRITICAL' | 'LOW' | 'ADEQUATE' | 'SURPLUS' | null = null;
    if (!isMatrixView && displayCode && isCurrentMonth) {
         let checkKey = displayCode;
         if (['M6','M7','M7-','M8','M8-'].includes(displayCode)) checkKey = 'M8';
         if (['P','P-'].includes(displayCode)) checkKey = 'P';
         const { mainCount } = getGroupedCoverage(dateKey, checkKey);
         const config = state.config.coverage[checkKey]; 
         if (config) {
            if (mainCount < config.min) coverageStatus = 'CRITICAL';
            else if (mainCount < config.optimal) coverageStatus = 'LOW';
            else if (mainCount > config.optimal) coverageStatus = 'SURPLUS';
            else coverageStatus = 'ADEQUATE';
         }
    }

    const isSwap = entry?.note?.toLowerCase().includes('scambio') ?? false;
    const isVariation = entry?.customHours !== undefined && entry.customHours !== shiftType?.hours;
    const hasNote = !!entry?.note;
    const isEntryManual = entry?.isManual && !isSwap && !isVariation;
    const hasSpecialEvents = entry?.specialEvents && entry.specialEvents.length > 0;
    const nextDateKey = formatDateKey(addDays(day, 1));
    const nextEntry = getEntry(state, op.id, nextDateKey);
    const isConnectedRight = !isMatrixView && entry?.isManual && nextEntry?.isManual && entry.shiftCode === nextEntry.shiftCode && entry.shiftCode !== 'OFF' && entry.shiftCode !== '';

    const isDimmedByFilter = filterStatus === 'EXTRA' && !hasSpecialEvents;

    let dropFeedbackClass = '';
    if (isDragOver && !isDragging) {
        const targetEntry = getEntry(state, op.id, dateKey);
        const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
        const targetCode = targetEntry ? targetEntry.shiftCode : (matrixShift || '');
        const isTargetOccupied = targetCode !== '' && targetCode !== 'R';
        dropFeedbackClass = isTargetOccupied ? 'ring-2 ring-amber-400 bg-amber-50 z-40' : 'ring-2 ring-green-50 z-40';
    }

    // Highlight Logic - OLD LOGIC: Background Color Change
    // const shouldHighlightNote = highlightNotes && hasNote;

    return (
      <div 
        key={dateKey} draggable={!isMatrixView && isEmployed} onDragStart={(e) => handleDragStart(e, op.id, dateKey, isEmployed)} onDragOver={handleDragOver} onDragEnter={() => handleCellDragEnter(op.id, dateKey, isEmployed)} onDrop={(e) => handleDrop(e, op.id, dateKey, isEmployed)} onDragEnd={handleDragEnd} onClick={(e) => { e.stopPropagation(); handleCellClick(e, op.id, dateKey, isEmployed); }} onContextMenu={(e) => handleRightClick(e, op.id, dateKey, isEmployed)} onDoubleClick={(e) => { e.stopPropagation(); handleCellDoubleClick(); }} onMouseEnter={() => { setHoveredDate(dateKey); setHoveredOpId(op.id); }}
        style={{ 
            backgroundColor: isDragOver ? undefined : (violation ? '#fee2e2' : (shiftType && !isDimmedByFilter ? shiftType.color : undefined)), 
            opacity: isGhost ? 0.5 : 1, 
            borderColor: isConnectedRight && shiftType && !isDimmedByFilter ? shiftType.color : undefined, 
            filter: (!isCurrentMonth && viewSpan === 'MONTH') || isDimmedByFilter ? 'grayscale(100%) opacity(0.6)' : undefined 
        }}
        className={`flex-1 min-w-[44px] md:min-w-0 border-r border-slate-300 border-b border-slate-300 text-xs md:text-sm flex items-center justify-center relative transition-all h-10 md:h-8 
          ${!isCurrentMonth && viewSpan === 'MONTH' ? 'bg-slate-100/50 text-slate-400' : isToday(day) ? 'bg-blue-50' : (isRedDay ? 'bg-red-50/40' : (isSat ? 'bg-slate-50/50' : ''))} 
          ${isPast && highlightPast ? 'opacity-30 grayscale bg-slate-100' : ''} 
          ${isHoveredCell ? 'ring-2 ring-inset ring-blue-500 z-30 bg-blue-100/80 shadow-inner' : ''} 
          ${(isRowHovered || isColHovered) && !isHoveredCell && !isSelected && !shiftType && !isRedDay ? 'bg-blue-100/40' : ''} 
          ${(isRowHovered || isColHovered) && shiftType && !isHoveredCell && !isDimmedByFilter ? 'brightness-90 ring-1 ring-inset ring-blue-200/50' : ''} 
          ${isSelected ? 'ring-4 ring-violet-600 ring-offset-2 ring-offset-white z-50 shadow-2xl scale-105 opacity-100 grayscale-0' : ''} 
          ${isMultiSelected ? 'ring-inset ring-2 ring-blue-600 bg-blue-300/60 z-20' : ''} 
          ${isPendingTarget ? 'ring-2 ring-dashed ring-blue-500 z-20' : ''} 
          ${isDragging ? 'opacity-40 scale-90 ring-2 ring-slate-400' : ''} 
          ${dropFeedbackClass} 
          ${violation ? 'text-red-600 font-bold border border-red-500' : (shiftType && !isDimmedByFilter ? getContrastColor(shiftType.color) : 'text-slate-700')} 
          ${isMatrixOverride ? 'ring-2 ring-dashed ring-red-500 z-10' : ''} 
          ${isEmployed ? 'cursor-pointer hover:opacity-90 active:cursor-grabbing' : 'cursor-not-allowed opacity-50 bg-slate-200'}`}
      >
        {(isColHovered || isRowHovered) && !isHoveredCell && !shiftType && (
             <div className="absolute inset-0 bg-blue-500/10 pointer-events-none z-10" />
        )}
        
        {/* Indicators Overlay */}
        <div className="absolute top-0 right-0 pointer-events-auto z-40 w-full h-full pointer-events-none">
          {/* Top Right Triangle Indicators */}
          <div className="absolute top-0 right-0 flex flex-col items-end">
              {isSwap && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-cyan-500 border-l-transparent" title="Scambio" />}
              {isVariation && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-fuchsia-500 border-l-transparent" title="Variazione" />}
              {isEntryManual && !violation && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-amber-500 border-l-transparent" title="Manuale" />}
              {hasSpecialEvents && <div className="w-0 h-0 border-t-[6px] border-l-[6px] border-t-indigo-600 border-l-transparent" />}
          </div>

          {/* Note Indicator - Bottom Right, Black Icon, No Background */}
          {hasNote && (highlightNotes || (!isSwap && !isEntryManual && !isVariation)) && (
              <div 
                  className="absolute bottom-0.5 right-0.5 pointer-events-auto z-50 cursor-help"
                  onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setNoteTooltip({ x: rect.left + rect.width/2, y: rect.bottom + 5, text: entry.note! });
                  }}
                  onMouseLeave={() => setNoteTooltip(null)}
              >
                  <StickyNote size={10} className="text-black fill-transparent opacity-80 hover:scale-125 transition-transform" />
              </div>
          )}
        </div>

        <span className={`${isMatrixOverride ? 'opacity-40 line-through decoration-slate-600' : ''} truncate font-medium relative z-20`}>{displayCode}</span>
        {isMatrixOverride && <div className="absolute -bottom-1 -right-1 bg-red-100 text-red-700 border border-red-200 text-[8px] font-bold px-1 rounded shadow-sm z-20">{manualOverrideCode}</div>}
        {isGhost && <div className="absolute inset-0 bg-white/30 pointer-events-none" />}
        {displayMode !== 'PLANNER_MINIMAL' && !isMatrixView && coverageStatus && coverageStatus !== 'ADEQUATE' && isCurrentMonth && (
            <div className={`absolute top-0 left-0 border-l-[6px] border-t-[6px] border-r-transparent border-b-transparent z-10 ${coverageStatus === 'CRITICAL' ? 'border-l-red-600 border-t-red-600' : ''} ${coverageStatus === 'LOW' ? 'border-l-amber-500 border-t-amber-500' : ''} ${coverageStatus === 'SURPLUS' ? 'border-l-purple-500 border-t-purple-500' : ''}`} />
        )}
        {displayMode === 'PLANNER_DETAILED' && coverageStatus === 'ADEQUATE' && isCurrentMonth && <div className="absolute top-0 left-0 w-1.5 h-1.5 rounded-br-sm bg-emerald-400 z-10" />}
        {displayMode === 'MATRIX_DIFF' && (entry?.variationReason || (entry?.customHours !== undefined && entry.customHours !== shiftType?.hours)) && <div className="absolute inset-0 border-2 border-dashed border-fuchsia-500 z-20 pointer-events-none" />}
        {displayMode === 'PLANNER_DETAILED' && shiftType && !isMatrixOverride && <div className={`absolute bottom-0.5 left-1 text-[10px] font-bold font-mono leading-none opacity-90 z-20 ${getContrastColor(shiftType.color)}`}>{entry?.customHours ?? shiftType.hours}h</div>}
      </div>
    );
  };

  const renderCoverageRow = () => {
      // ... (renderCoverageRow implementation remains unchanged)
      if (isMatrixView) return null;
      return (
        <div className="flex flex-col shrink-0 z-20 sticky top-10">
          <div className="flex h-8 bg-white border-b border-slate-300 shadow-sm relative z-30">
              <div className="w-32 md:w-48 shrink-0 bg-white border-r border-slate-300 flex items-center pl-2 md:pl-4 font-bold text-slate-500 text-[9px] uppercase sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-50 transition-colors" onClick={(e) => { e.stopPropagation(); setIsCoverageExpanded(!isCoverageExpanded); }}>
                  <ShieldCheck size={12} className={`mr-2 transition-colors ${isCoverageExpanded ? 'text-blue-500' : 'text-slate-300'}`} /> Verifica Copertura {isCoverageExpanded ? <ChevronUp size={12} className="ml-auto mr-2" /> : <ChevronDown size={12} className="ml-auto mr-2" />}
              </div>
              <div className="w-[40px] md:w-[60px] shrink-0 flex items-center justify-center font-bold text-[10px] text-slate-400 border-r bg-slate-50 z-30">-</div>
              {days.map(d => {
                  const dateKey = formatDateKey(d);
                  const isCurrentMonth = isSameMonth(d, parseISO(state.currentDate));
                  const isPast = isBefore(d, new Date(new Date().setHours(0,0,0,0)));
                  const m = getGroupedCoverage(dateKey, 'M8');
                  const p = getGroupedCoverage(dateKey, 'P');
                  const n = getGroupedCoverage(dateKey, 'N');
                  const getStatus = (data: any, key: string) => {
                      const cfg = state.config.coverage[key];
                      if (!cfg) return 'ADEQUATE';
                      if (data.mainCount < cfg.min) return 'CRITICAL';
                      if (data.mainCount < cfg.optimal) return 'LOW';
                      if (data.mainCount > cfg.optimal) return 'SURPLUS';
                      return 'ADEQUATE';
                  };
                  const statuses = [getStatus(m, 'M8'), getStatus(p, 'P'), getStatus(n, 'N')];
                  let finalColor = 'bg-emerald-500';
                  if (statuses.includes('CRITICAL')) finalColor = 'bg-red-500 animate-pulse';
                  else if (statuses.includes('LOW')) finalColor = 'bg-amber-500';
                  else if (statuses.includes('SURPLUS')) finalColor = 'bg-purple-500';
                  const handleCoverageHoverEnter = (e: React.MouseEvent) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setCoveragePopover({ date: dateKey, x: rect.left + rect.width / 2, y: rect.bottom + 5 });
                  };
                  return (
                      <div key={`cov-${dateKey}`} className={`flex-1 min-w-[44px] md:min-w-0 flex items-center justify-center border-r border-slate-200 transition-colors cursor-pointer hover:bg-slate-50 ${isToday(d) ? 'bg-blue-50/30' : ''} ${!isCurrentMonth && viewSpan === 'MONTH' ? 'opacity-30' : ''} ${isPast && highlightPast ? 'opacity-20' : ''}`} onMouseEnter={handleCoverageHoverEnter} onMouseLeave={() => setCoveragePopover(null)}><div className={`w-2.5 h-2.5 rounded-full ${finalColor} shadow-sm border border-white/20`} /></div>
                  );
              })}
          </div>
          {isCoverageExpanded && (
            <div className="flex flex-col animate-in slide-in-from-top-2 duration-200 z-20">
                {['M8', 'P', 'N'].map((type) => {
                    const label = type === 'M8' ? 'Mattina' : type === 'P' ? 'Pomeriggio' : 'Notte';
                    return (
                        <div key={type} className="flex h-6 bg-slate-50/80 border-b border-slate-200 backdrop-blur-sm">
                            <div className="w-32 md:w-48 shrink-0 bg-slate-50 border-r border-slate-200 flex items-center pl-2 md:pl-6 text-[8px] font-bold text-slate-400 uppercase sticky left-0 z-30">{label}</div>
                            <div className="w-[40px] md:w-[60px] shrink-0 border-r bg-slate-100/50" />
                            {days.map(d => {
                                const dateKey = formatDateKey(d);
                                const cov = getGroupedCoverage(dateKey, type);
                                const cfg = state.config.coverage[type];
                                
                                const getFontColor = (data: any, shiftKey: string) => {
                                    const config = state.config.coverage[shiftKey];
                                    if (!config) return 'text-slate-600';
                                    if (data.mainCount < config.min) return 'text-red-600';
                                    if (data.mainCount < config.optimal) return 'text-amber-500';
                                    if (data.mainCount === config.optimal) return 'text-emerald-600';
                                    return 'text-purple-600';
                                };
                                
                                const fontColorClass = getFontColor(cov, type);

                                return (
                                    <div key={`${type}-${dateKey}`} className="flex-1 min-w-[44px] md:min-w-0 flex items-center justify-center border-r border-slate-200/50">
                                        <div className="flex items-center gap-0.5 justify-center w-full">
                                            <span className={`text-[9px] font-black ${fontColorClass}`}>
                                                {cov.mainCount}
                                            </span>
                                            {cov.supportCount > 0 && (
                                                <span className="text-[8px] font-bold text-blue-500/80">
                                                    +{cov.supportCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
          )}
        </div>
      );
  };

  const printRoot = document.getElementById('print-root');

  return (
    <div className="flex flex-col h-full bg-white w-full overflow-hidden" onClick={clearSelection}>
      {/* Portale per la Stampa - Risolve il problema del rettangolo blu */}
      {showPrintPreview && printRoot && createPortal(
        <div className="bg-white p-8 w-full min-h-screen">
          {printLayoutMode === 'VISUAL' ? (
              <PrintLayout operatorId={printTargetId || undefined} />
          ) : printLayoutMode === 'TIMESHEET' ? (
              <TimesheetPrintLayout operatorId={printTargetId || undefined} />
          ) : (
              printTargetId ? <SingleOperatorCalendarLayout operatorId={printTargetId} /> : <PrintLayout />
          )}
        </div>,
        printRoot
      )}

      {showPrintPreview && (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto flex flex-col animate-in fade-in duration-200">
           <div className="shrink-0 p-4 border-b bg-slate-50 flex justify-between items-center no-print sticky top-0 shadow-sm z-50">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Printer className="text-blue-600"/> Anteprima di Stampa {printTargetId ? '(Singolo Operatore)' : ''}</h2>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-md">
                  <button onClick={() => setPrintLayoutMode('VISUAL')} className={`px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${printLayoutMode === 'VISUAL' ? 'bg-white text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}><Layout size={14} className="inline mr-1" /> Planner Visivo</button>
                  <button onClick={() => setPrintLayoutMode('TIMESHEET')} className={`px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${printLayoutMode === 'TIMESHEET' ? 'bg-white text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}><FileText size={14} className="inline mr-1" /> Cartellino Ore</button>
                  {printTargetId && (
                      <button onClick={() => setPrintLayoutMode('CALENDAR')} className={`px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${printLayoutMode === 'CALENDAR' ? 'bg-white text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}><Calendar size={14} className="inline mr-1" /> Calendario</button>
                  )}
              </div>
              <div className="flex items-center gap-3"><div className="text-xs text-slate-500 flex items-center mr-2 bg-yellow-50 px-2 py-1 rounded border border-yellow-200 hidden md:flex"><Info size={14} className="mr-1 text-yellow-600"/><span>Se la stampa non parte, usa <strong>Ctrl+P</strong></span></div><Button variant="secondary" onClick={() => window.print()} className="gap-2"><Printer size={16} /> Stampa</Button><Button variant="danger" onClick={() => { setShowPrintPreview(false); setPrintTargetId(null); }}>Chiudi</Button></div>
           </div>
           <div className="flex-1 p-4 md:p-8 overflow-auto bg-slate-100 flex justify-center">
               <div className="bg-white shadow-xl p-8 max-w-[1400px] w-full min-h-screen print-area">
                   {printLayoutMode === 'VISUAL' ? (
                       <PrintLayout operatorId={printTargetId || undefined} />
                   ) : printLayoutMode === 'TIMESHEET' ? (
                       <TimesheetPrintLayout operatorId={printTargetId || undefined} />
                   ) : (
                       printTargetId ? <SingleOperatorCalendarLayout operatorId={printTargetId} /> : <PrintLayout />
                   )}
               </div>
           </div>
        </div>
      )}

      {/* Rest of the component code (Header, Toolbar, Grid etc.) ... */}
      <div className="md:hidden flex items-center justify-between p-2 border-b bg-slate-50 sticky top-0 z-50"><div className="flex items-center gap-2 font-bold text-slate-700"><CalendarDays size={18} className="text-blue-600" /><span>Planner</span></div><button onClick={() => setIsMobileToolbarOpen(!isMobileToolbarOpen)} className={`p-2 rounded-lg transition-colors ${isMobileToolbarOpen ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-600 border'}`}>{isMobileToolbarOpen ? <XCircle size={20} /> : <Settings2 size={20} />}</button></div>
      <div className={`p-2 md:p-4 border-b border-slate-200 bg-white shadow-sm z-40 gap-2 no-print ${isMobileToolbarOpen ? 'flex flex-wrap items-center justify-between' : 'hidden md:flex flex-wrap items-center justify-between'}`} onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 min-w-0"><button onClick={() => saveToCloud(true)} disabled={syncStatus === 'SYNCING'} className="hidden lg:flex items-center mr-2 px-2 py-1 bg-slate-50 rounded border border-slate-200 hover:bg-blue-50 cursor-pointer transition-colors disabled:opacity-70 disabled:cursor-wait" title="Clicca per forzare il salvataggio su Cloud (Neon DB)">{syncStatus === 'SYNCING' && <><Loader2 size={16} className="animate-spin text-blue-500 mr-2" /><span className="text-xs text-blue-600 font-medium">Salvataggio...</span></>}{syncStatus === 'SAVED' && <><CheckCircle size={16} className="text-emerald-500 mr-2" /><span className="text-xs text-emerald-600 font-medium">Salvato</span></>}{syncStatus === 'ERROR' && <><CloudOff size={16} className="text-red-500 mr-2" /><span className="text-xs text-red-600 font-medium">Offline</span></>}{syncStatus === 'IDLE' && <><Cloud size={16} className="text-slate-400 mr-2" /><span className="text-xs text-slate-500">Pronto</span></>}</button>
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto"><div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 shrink-0"><button onClick={() => dispatch({ type: 'UNDO' })} disabled={!history.canUndo} className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent text-slate-600" title="Annulla (Ctrl+Z)"><Undo size={16} /></button><button onClick={() => dispatch({ type: 'REDO' })} disabled={!history.canRedo} className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent text-slate-600" title="Ripristina (Ctrl+Y)"><Redo size={16} /></button></div><div className="flex items-center bg-slate-100 rounded-lg p-1 shrink-0"><div className="flex mr-2 bg-white rounded shadow-sm"><button onClick={() => setViewSpan('MONTH')} className={`p-1.5 text-xs font-bold rounded-l transition-colors ${viewSpan === 'MONTH' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`} title="Vista Mese"><CalendarDays size={16} /></button><button onClick={() => setViewSpan('WEEK')} className={`p-1.5 text-xs font-bold rounded-r transition-colors ${viewSpan === 'WEEK' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`} title="Vista Settimana"><Columns size={16} /></button></div><button onClick={handlePrev} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={16} /></button><span className="px-2 md:px-3 font-semibold text-slate-700 text-sm md:text-base text-center capitalize min-w-[120px] md:min-w-[160px]">{getHeaderLabel()}</span><button onClick={handleNext} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={16} /></button></div><Button variant="secondary" className="text-xs md:text-sm py-1 px-2 md:px-3" onClick={handleToday} title="Vai ad Oggi">Oggi</Button><div className="flex items-center gap-2 border-l pl-2 md:pl-4 ml-2 shrink-0"><Layout size={16} className="text-slate-400" /><select className="text-xs md:text-sm border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer" value={displayMode} onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}><option value="PLANNER_STANDARD">Standard</option><option value="PLANNER_MINIMAL">Minimal</option><option value="PLANNER_DETAILED">Dettagliato</option><option disabled>──────────</option><option value="MATRIX_ONLY">Solo Matrice</option><option value="MATRIX_DIFF">Variazioni</option></select></div></div></div>
          <div className="flex gap-2 shrink-0 mt-2 md:mt-0"><div className="relative shrink-0 border-l pl-2 ml-2 flex items-center gap-2"><Button variant={highlightPast ? 'primary' : 'secondary'} className="text-xs md:text-sm py-1 px-2 md:px-3 flex items-center gap-2" onClick={() => setHighlightPast(!highlightPast)}><History size={16} /> <span className="hidden md:inline">Storico</span></Button><Button variant={highlightNotes ? 'primary' : 'secondary'} className="text-xs md:text-sm py-1 px-2 md:px-3 flex items-center gap-2" onClick={() => setHighlightNotes(!highlightNotes)} title="Evidenzia Celle con Note"><StickyNote size={16} /> <span className="hidden md:inline">Note</span></Button><Button variant="secondary" className="text-xs md:text-sm py-1 px-2 md:px-3 flex items-center gap-2" onClick={() => setShowFilters(!showFilters)}><Filter size={16} /> <span className="hidden md:inline">Filtri</span></Button>{showFilters && <div className="absolute top-full right-0 mt-2 p-4 bg-white border rounded-lg shadow-xl z-[100] w-64 space-y-3 animate-in fade-in zoom-in-95"><Input label="Cerca Operatore" placeholder="Nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="text-sm"/><Select label="Stato / Filtro" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="text-sm"><option value="ACTIVE">Attivi</option><option value="INACTIVE">Inattivi</option><option value="ALL">Tutti</option><option disabled>──────────</option><option value="MODIFIED">Con Modifiche</option><option value="EXTRA">Con Extra</option></Select><Select label="Matrice Assegnata" value={filterMatrix} onChange={(e) => setFilterMatrix(e.target.value)} className="text-sm"><option value="ALL">Tutte le Matrici</option>{state.matrices.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}</Select><div className="pt-2 border-t flex justify-end"><Button variant="ghost" className="text-xs py-1" onClick={() => { setSearchTerm(''); setFilterStatus('ACTIVE'); setFilterMatrix('ALL'); }}>Reset</Button></div></div>}</div>{multiSelection && (<><Button variant="primary" onClick={handleConfirmSelection} title="Conferma Matrice (Rendi definitivi)"><CheckCheck size={16} /></Button><Button variant="primary" onClick={handleCopySelection} title="Copia"><Copy size={16} /></Button><Button variant="secondary" onClick={() => { setShowBulkModal(true); setMultiSelectPopupPosition(null); }} title="Assegna"><Layers size={16} /></Button></>)}{clipboard && selectedCell && (<Button variant="primary" onClick={handlePasteSelection} title="Incolla"><ClipboardPaste size={16} /></Button>)}<Button variant="secondary" onClick={handleExportForGoogleSheets} title="Invia al Foglio Master" className="flex items-center gap-2" disabled={isExporting}>{isExporting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} <span className="hidden lg:inline">{isExporting ? 'Invio...' : 'Condividi'}</span></Button><Button variant="secondary" onClick={handleExportCSV} title="CSV"><FileSpreadsheet size={16} /></Button><Button variant="secondary" onClick={handleApplyMatricesClick} title="Matrici"><Wand2 size={16} /></Button><Button variant="secondary" onClick={() => setShowPrintPreview(true)} title="Stampa"><Printer size={16} /></Button></div>
      </div>
      <div ref={scrollContainerRef} className="flex-1 flex flex-col overflow-hidden bg-white relative no-print touch-pan-x touch-pan-y" onMouseLeave={() => { setHoveredDate(null); setHoveredOpId(null); }}><div className="flex-1 overflow-auto relative" ref={gridScrollRef}><div className="min-w-max"><div className="flex shrink-0 h-10 bg-slate-100 border-b border-slate-300 shadow-sm z-30 sticky top-0"><div className="w-32 md:w-48 shrink-0 bg-slate-100 border-r border-slate-300 flex items-center pl-2 md:pl-4 font-bold text-slate-700 text-xs md:text-sm sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Operatore</div><div className="w-[40px] md:w-[60px] shrink-0 flex items-center justify-center font-bold text-[10px] md:text-xs text-slate-600 border-r bg-slate-50 z-30 relative group"><span>Ore</span>{!isMatrixView && viewSpan === 'MONTH' && (<button onClick={() => setShowPrevDays(!showPrevDays)} className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all z-50 opacity-0 group-hover:opacity-100">{showPrevDays ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}</button>)}</div>{days.map(d => {
                        const dateKey = formatDateKey(d);
                        const isRedDay = isItalianHoliday(d); 
                        const isSat = isSaturday(d) && !isRedDay; 
                        const isPast = isBefore(d, new Date(new Date().setHours(0,0,0,0)));
                        const isHovered = dateKey === hoveredDate;
                        const isCurrentMonth = isSameMonth(d, parseISO(state.currentDate));
                        const note = state.dayNotes[dateKey];
                        const noteType = (typeof note === 'object' && note?.type) ? note.type : (note ? 'INFO' : null);
                        const NoteIcon = noteType ? NOTE_TYPES[noteType].icon : null;
                        const noteColor = noteType ? NOTE_TYPES[noteType].color : '';
                        return (
                          <div key={d.toString()} id={`day-header-${dateKey}`} className={`flex-1 min-w-[44px] md:min-w-0 flex flex-col items-center justify-center border-r border-slate-300 text-[10px] md:text-xs overflow-hidden relative cursor-pointer transition-colors group ${isRedDay ? 'bg-red-50/80 text-red-700 font-bold' : (isSat ? 'bg-slate-100 text-slate-700' : 'text-slate-600')} ${isToday(d) ? 'bg-blue-100 font-bold text-blue-700' : ''} ${!isCurrentMonth && viewSpan === 'MONTH' ? 'bg-slate-100 opacity-60 grayscale' : ''} ${isHovered ? 'bg-blue-300 brightness-90 ring-2 ring-inset ring-blue-500/50 z-40' : 'hover:bg-blue-50'} ${isPast && highlightPast ? 'opacity-40 bg-slate-200 grayscale' : ''}`} onClick={() => handleOpenDayNote(dateKey)} onMouseEnter={() => setHoveredDate(dateKey)}><span className={isRedDay ? 'text-red-700 font-bold' : ''}>{ITALIAN_DAY_INITIALS[d.getDay()]}</span><span className={`text-xs md:text-sm font-semibold ${isRedDay ? 'text-red-700' : ''}`}>{format(d, 'd')}</span>{NoteIcon && <div className="absolute top-0.5 right-0.5"><NoteIcon size={10} className={noteColor} /></div>}</div>
                        );
                    })}</div>{renderCoverageRow()}<div className="flex-1 min-w-max">{sortedGroupKeys.map(groupKey => {
                      const groupOps = groupedOperators[groupKey];
                      if (!groupOps || groupOps.length === 0) return null;
                      const matrixId = groupKey;
                      const matrix = state.matrices.find(m => m.id === matrixId);
                      const groupName = matrix ? matrix.name : 'Nessuna Matrice / Altro';
                      return (
                          <React.Fragment key={groupKey}>{groupByMatrix && (<div className="sticky left-0 z-20 bg-slate-100 border-b border-slate-300 px-4 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"><div className="w-2 h-2 rounded-full" style={{ background: matrix?.color || '#cbd5e1' }} />{groupName} ({groupOps.length})</div>)}
                              {groupOps.map(op => {
                                  const totalHours = days.reduce((acc, d) => {
                                      const k = formatDateKey(d);
                                      if (!isOperatorEmployed(op, k)) return acc;
                                      const entry = getEntry(state, op.id, k);
                                      const mx = calculateMatrixShift(op, k, state.matrices);
                                      const code = entry?.shiftCode || mx || '';
                                      const st = state.shiftTypes.find(s => s.code === code);
                                      let h = 0;
                                      if (entry?.customHours !== undefined) h = entry.customHours;
                                      else if (st) {
                                          if (st.inheritsHours) {
                                              const mxCode = calculateMatrixShift(op, k, state.matrices);
                                              const mxSt = state.shiftTypes.find(s => s.code === mxCode);
                                              h = mxSt?.hours || 0;
                                          } else { h = st.hours; }
                                      }
                                      return acc + h;
                                  }, 0);
                                  const totalSpecialHours = days.reduce((acc, d) => {
                                      const k = formatDateKey(d);
                                      if (!isOperatorEmployed(op, k)) return acc;
                                      const entry = getEntry(state, op.id, k);
                                      if (!entry || !entry.specialEvents) return acc;
                                      let daySpecial = 0;
                                      entry.specialEvents.forEach(ev => {
                                          if (ev.mode === 'ADDITIVE' || !ev.mode) daySpecial += ev.hours;
                                          else if (ev.mode === 'SUBTRACTIVE') daySpecial -= ev.hours;
                                      });
                                      return acc + daySpecial;
                                  }, 0);
                                  
                                  const isRowHovered = hoveredOpId === op.id;

                                  return (
                                      <div key={op.id} className={`flex border-b border-slate-300 transition-colors h-10 md:h-8 ${isRowHovered ? 'bg-blue-100/50' : 'hover:bg-slate-50'}`}>
                                          <div className={`w-32 md:w-48 shrink-0 border-r border-slate-300 flex items-center justify-between pl-2 md:pl-4 pr-1 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors group/op-name ${isRowHovered ? 'bg-blue-50' : 'bg-white'}`}>
                                              <div className="flex items-center truncate cursor-pointer flex-1" onClick={() => setDetailsOpId(op.id)}>
                                                  <div className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${op.isActive ? 'bg-emerald-500' : 'bg-red-300'}`} />
                                                  <span className={`text-xs md:text-sm truncate transition-all ${isRowHovered ? 'text-blue-700 font-bold scale-105 origin-left' : 'text-slate-700 font-medium'}`}>
                                                      {op.lastName} {op.firstName}
                                                  </span>
                                              </div>
                                              
                                              <div className="flex items-center gap-1 opacity-0 group-hover/op-name:opacity-100 transition-opacity">
                                                  <button
                                                      onClick={(e) => { e.stopPropagation(); setPrintTargetId(op.id); setShowPrintPreview(true); }}
                                                      className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                                                      title="Stampa Turno Operatore"
                                                  >
                                                      <Printer size={14} />
                                                  </button>
                                                  <button 
                                                      onClick={(e) => { e.stopPropagation(); setEditingOperatorNote({ opId: op.id, name: `${op.lastName} ${op.firstName}`, text: op.notes || '' }); }}
                                                      className={`p-1.5 rounded-md transition-colors ${op.notes ? 'text-blue-600 bg-blue-50 !opacity-100' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}
                                                      title="Note Personali"
                                                  >
                                                      <MessageSquare size={14} className={op.notes ? "fill-blue-100" : ""} />
                                                  </button>
                                              </div>
                                          </div>
                                          
                                          <div className={`w-[40px] md:w-[60px] shrink-0 border-r border-slate-300 flex flex-col items-center justify-center relative z-10 leading-none py-0.5 transition-colors ${isRowHovered ? 'bg-blue-100/30' : 'bg-slate-50'}`}>
                                              <span className={`text-[10px] md:text-xs font-semibold ${isRowHovered ? 'text-blue-800' : 'text-slate-600'}`}>
                                                  {totalHours > 0 ? Math.round(totalHours) : '-'}
                                              </span>
                                              {totalSpecialHours !== 0 && (
                                                  <span className={`text-[8px] font-bold mt-0.5 ${totalSpecialHours > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                                      {totalSpecialHours > 0 ? '+' : ''}{totalSpecialHours}
                                                  </span>
                                              )}
                                          </div>
                                          {days.map(d => renderCell(op, d))}
                                      </div>
                                  );
                              })}
                          </React.Fragment>
                      );
                  })}</div></div></div>{selectedCell && cellPopupPosition && !isMatrixView && (<div className="fixed z-[60] bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-slate-200 p-3 w-[280px] animate-in fade-in zoom-in-95 flex flex-col gap-2 overflow-y-auto custom-scrollbar" style={{ left: cellPopupPosition.x, top: cellPopupPosition.top, bottom: cellPopupPosition.bottom, maxHeight: cellPopupPosition.maxHeight, transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>{(() => {
                      const op = state.operators.find(o => o.id === selectedCell.opId);
                      const entry = getEntry(state, selectedCell.opId, selectedCell.date);
                      const matrixShift = op ? calculateMatrixShift(op, selectedCell.date, state.matrices) : null;
                      const currentCode = entry?.shiftCode ?? matrixShift ?? '';
                      const shiftType = state.shiftTypes.find(s => s.code === currentCode);
                      let hoursDisplay = '';
                      if (entry?.customHours !== undefined) hoursDisplay = `${entry.customHours}h`;
                      else if (shiftType?.inheritsHours && matrixShift) { const ms = state.shiftTypes.find(s => s.code === matrixShift); hoursDisplay = `${ms?.hours || 0}h`; }
                      else if (shiftType) { hoursDisplay = `${shiftType.hours}h`; }
                      const isManual = entry?.isManual && entry?.shiftCode;
                      const hasNote = !!entry?.note;
                      const violation = entry?.violation;
                      const specialEvents = entry?.specialEvents || [];

                      return (
                          <div className="mb-1 border-b border-slate-100 pb-2"><div className="flex justify-between items-start mb-1"><div><div className="font-bold text-slate-800 text-sm truncate w-40">{op?.lastName} {op?.firstName}</div><div className="text-[10px] text-slate-500 uppercase font-semibold">{format(parseISO(selectedCell.date), 'dd MMMM')}</div></div><div className={`px-2 py-1 rounded text-xs font-black shadow-sm border border-black/5 ${getContrastColor(shiftType?.color)}`} style={{backgroundColor: shiftType?.color || '#f1f5f9'}}>{currentCode || 'OFF'}</div></div><div className="flex flex-wrap gap-2 text-[10px] text-slate-600 mt-1.5 items-center">{isManual && <span className="bg-amber-100 text-amber-700 px-1 rounded font-medium border border-amber-200">Manuale</span>}<span>Matrice: <strong>{matrixShift || '-'}</strong></span><span>Ore: <strong>{hoursDisplay || '0h'}</strong></span></div>{violation && (<div className="mt-2 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2 animate-pulse"><AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" /><span className="text-[10px] font-bold text-red-700 leading-tight">{violation}</span></div>)}{specialEvents.length > 0 && (<div className="mt-2 space-y-1"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Zap size={10} /> Voci Speciali</div>{specialEvents.map(ev => (<div key={ev.id} className="flex justify-between items-center bg-indigo-50 border border-indigo-100 rounded px-2 py-1 text-[10px] font-bold text-indigo-700"><span>{ev.type}</span><span>{ev.hours}h</span></div>))}</div>)}{hasNote && <div className="mt-2 text-[10px] italic text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">"{entry.note}"</div>}</div>
                      );
                  })()}<div className="grid grid-cols-6 gap-1 mb-1">{state.shiftTypes.map(s => (<button key={s.id} onClick={() => { setDraftShift(s.code); }} className={`h-7 w-full rounded text-[10px] font-bold border flex items-center justify-center transition-transform active:scale-95 ${draftShift === s.code ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : 'opacity-90 hover:opacity-100'} ${getContrastColor(s.color)}`} style={{ backgroundColor: s.color }} title={s.name}>{s.code}</button>))}<button onClick={() => { setDraftShift('OFF'); }} className={`h-7 w-full rounded text-[10px] font-bold border bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 ${draftShift === 'OFF' ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}`}>OFF</button></div><input className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors" placeholder="Note rapide..." value={draftNote} onChange={(e) => setDraftNote(e.target.value)} /><div className="flex justify-between pt-1"><button className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition-colors flex items-center" onClick={() => { setDraftShift(''); setDraftNote(''); saveChanges(); }}><Trash2 size={12} className="mr-1 inline" /> Cancella</button><Button variant="primary" className="px-3 py-1 text-xs h-7" onClick={saveChanges}>Salva</Button></div></div>)}{multiSelection && multiSelectPopupPosition && (<div className="fixed z-[60] bg-white rounded-lg shadow-xl border border-slate-200 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 min-w-[150px]" style={{ left: multiSelectPopupPosition.x, top: multiSelectPopupPosition.y }} onClick={(e) => e.stopPropagation()}> <div className="text-xs font-bold text-slate-500 px-2 py-1 border-b mb-1">Azioni Multiple</div><button onClick={() => { setShowBulkModal(true); setMultiSelectPopupPosition(null); }} className="text-left px-2 py-1.5 text-sm hover:bg-slate-100 rounded text-slate-700 flex items-center gap-2"><Edit2 size={14} /> Assegna Turno...</button><button onClick={handleConfirmSelection} className="text-left px-2 py-1.5 text-sm hover:bg-slate-100 rounded text-slate-700 flex items-center gap-2"><CheckCheck size={14} /> Consolida Matrice</button><button onClick={handleCopySelection} className="text-left px-2 py-1.5 text-sm hover:bg-slate-100 rounded text-slate-700 flex items-center gap-2"><Copy size={14} /> Copia Selezione</button><button onClick={() => handleBulkAssign('')} className="text-left px-2 py-1.5 text-sm hover:bg-red-50 text-red-600 rounded flex items-center gap-2"><Trash2 size={14} /> Svuota Celle</button></div>)}</div>
      
      {/* Note Tooltip */}
      {noteTooltip && (
          <div 
              className="fixed z-[100] bg-slate-800 text-white text-xs p-2.5 rounded-lg shadow-xl border border-slate-700 max-w-[220px] break-words pointer-events-none animate-in fade-in zoom-in-95" 
              style={{ top: noteTooltip.y, left: noteTooltip.x, transform: 'translateX(-50%)' }}
          >
              <div className="font-bold mb-1 text-yellow-400 text-[10px] uppercase tracking-wide flex items-center gap-1">
                  <StickyNote size={10} /> Nota
              </div>
              <div className="leading-snug opacity-90">{noteTooltip.text}</div>
              {/* Arrow */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-t border-slate-700"></div>
          </div>
      )}

      {coveragePopover && (<div className="fixed z-[300] bg-slate-900 text-white rounded-lg shadow-2xl p-3 w-[180px] animate-in fade-in zoom-in-95 pointer-events-none" style={{ left: coveragePopover.x, top: coveragePopover.y, transform: 'translateX(-50%)' }}><div className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-700 pb-1">Presenze {format(parseISO(coveragePopover.date), 'dd/MM')}</div>{(() => {
                  const dateKey = coveragePopover.date;
                  const m = getGroupedCoverage(dateKey, 'M8');
                  const p = getGroupedCoverage(dateKey, 'P');
                  const n = getGroupedCoverage(dateKey, 'N');
                  const renderRow = (label: string, data: any, key: string) => {
                      const cfg = state.config.coverage[key];
                      const isCrit = data.mainCount < (cfg?.min || 0);
                      const isLow = data.mainCount < (cfg?.optimal || 0);
                      const isSurplus = cfg && data.mainCount > cfg.optimal;
                      return (<div className="flex justify-between items-center py-1"><span className="text-xs text-slate-300">{label}</span><div className="flex items-center gap-1 text-right">{data.supportCount > 0 && <span className="text-[9px] text-blue-300 bg-blue-500/20 px-1 rounded mr-1">{data.supportCount} {data.supportLabel} +</span>}<span className={`text-xs font-black ${isCrit ? 'text-red-400' : isLow ? 'text-amber-400' : isSurplus ? 'text-purple-500' : 'text-emerald-400'}`}>{data.mainCount}</span></div></div>);
                  };
                  return (<div className="space-y-0.5">{renderRow('Mattina', m, 'M8')}{renderRow('Pomeriggio', p, 'P')}{renderRow('Notte', n, 'N')}</div>);
              })()}</div>)}
      {detailsOpId && <OperatorDetailModal isOpen={!!detailsOpId} onClose={() => setDetailsOpId(null)} operatorId={detailsOpId} />}
      <Modal isOpen={showMatrixModal} onClose={() => setShowMatrixModal(false)} title="Applica Matrice"><div className="space-y-4"><p className="text-sm text-slate-600">Seleziona una matrice da applicare all'operatore corrente a partire da una data specifica.</p><Select label="Matrice" value={applyMatrixId} onChange={(e) => setApplyMatrixId(e.target.value)}><option value="">Seleziona...</option>{state.matrices.map(m => (<option key={m.id} value={m.id}>{m.name} ({m.sequence.length} turni)</option>))}</Select><Input type="date" label="Data Inizio" value={applyMatrixStart} onChange={(e) => setApplyMatrixStart(e.target.value)} /><div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setShowMatrixModal(false)}>Annulla</Button><Button variant="primary" onClick={handleApplyMatrixSubmit}>Applica</Button></div></div></Modal>
      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title="Assegnazione Multipla"><div className="p-2"><div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto mb-4">{state.shiftTypes.map(s => (<button key={s.id} onClick={() => handleBulkAssign(s.code)} className={`p-2 rounded text-xs font-bold border hover:opacity-80 ${getContrastColor(s.color)}`} style={{ backgroundColor: s.color }}>{s.code}</button>))}</div><div className="border-t pt-3 flex gap-2"><Button variant="secondary" className="flex-1 text-xs" onClick={() => handleBulkAssign('RESET')}>Ripristina Matrice</Button><Button variant="danger" className="flex-1 text-xs" onClick={() => handleBulkAssign('')}>Svuota Celle</Button></div></div></Modal>
      <Modal isOpen={!!dragActionPrompt} onClose={() => setDragActionPrompt(null)} title="Spostamento" className="max-w-[320px]">{dragActionPrompt && (<div className="flex flex-col gap-3"><div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mb-1"><div className="flex-1 text-center"><div className="font-bold text-slate-800 text-[10px] truncate w-20 mx-auto">{dragActionPrompt.source.name}</div><div className="text-[10px]">{format(parseISO(dragActionPrompt.source.date || ''), 'dd/MM')} <span className="font-mono font-bold ml-1">{dragActionPrompt.source.code}</span></div></div><div className="px-2 text-slate-400"><ArrowRight size={14} /></div><div className="flex-1 text-center"><div className="font-bold text-slate-800 text-[10px] truncate w-20 mx-auto">{dragActionPrompt.target.name}</div><div className="text-[10px]">{format(parseISO(dragActionPrompt.target.date || ''), 'dd/MM')} <span className="font-mono font-bold ml-1">{dragActionPrompt.target.code}</span></div></div></div><div className="grid grid-cols-3 gap-2"><button onClick={() => resolveDragAction('SWAP')} className="flex flex-col items-center justify-center p-2 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-blue-800"><ArrowRightLeft size={16} /><span className="text-[10px] font-bold mt-1">Scambia</span></button><button onClick={() => resolveDragAction('COPY')} className="flex flex-col items-center justify-center p-2 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-700"><Copy size={16} /><span className="text-[10px] font-bold mt-1">Copia</span></button><button onClick={() => resolveDragAction('MOVE')} className="flex flex-col items-center justify-center p-2 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-700"><ArrowRightCircle size={16} /><span className="text-[10px] font-bold mt-1">Sposta</span></button></div></div>)}</Modal>
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifica Turno" className="max-w-4xl">{selectedCell && (<div className="flex flex-col md:flex-row gap-6"><div className="flex-1"><h4 className="font-bold text-sm text-slate-700 mb-3 uppercase flex items-center gap-2"><Grid size={16} /> Seleziona Turno</h4><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{state.shiftTypes.map(s => (<button key={s.id} onClick={() => setDraftShift(s.code)} className={`p-2 rounded-lg text-sm font-bold border transition-all shadow-sm flex flex-col items-center justify-center h-16 ${draftShift === s.code ? 'ring-2 ring-blue-600 ring-offset-1 scale-105 z-10' : 'hover:scale-105 hover:shadow-md opacity-90'} ${getContrastColor(s.color)}`} style={{ backgroundColor: s.color }}><span>{s.code}</span>{s.hours > 0 && <span className="text-[10px] font-normal opacity-80">{s.hours}h</span>}</button>))}<button onClick={() => setDraftShift('OFF')} className={`p-2 rounded-lg text-sm font-bold border transition-all shadow-sm flex flex-col items-center justify-center h-16 bg-slate-100 text-slate-600 ${draftShift === 'OFF' ? 'ring-2 ring-blue-600 ring-offset-1 scale-105 z-10' : 'hover:bg-slate-200'}`}>OFF</button></div><div className="mt-6"><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Note Turno</label><textarea className="w-full border border-slate-300 rounded-md p-2 text-sm h-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" placeholder="Aggiungi una nota..." value={draftNote} onChange={(e) => setDraftNote(e.target.value)}/></div></div><div className="flex-1 border-l pl-0 md:pl-6 border-slate-200"><div className="mb-6 flex gap-4 items-end"><div className="flex-1"><Input label="Ore Personalizzate" type="number" step="0.5" value={draftCustomHours ?? ''} onChange={(e) => setDraftCustomHours(e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="Default"/></div><button onClick={toggleGettone} className={`flex items-center gap-2 px-4 py-2 rounded-md border font-bold transition-all h-[42px] mb-2 ${draftSpecialEvents.some(e => e.type === 'Gettone') ? 'bg-amber-100 text-amber-700 border-amber-300 ring-1 ring-amber-400' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}><Coins size={18} />Gettone</button></div><div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4"><h4 className="font-bold text-xs text-slate-600 mb-2 flex items-center gap-1"><Plus size={12}/> Aggiungi Voce</h4><div className="flex gap-2 mb-2"><div className="flex-1 flex gap-1"><select className="flex-1 text-xs border rounded p-1" value={newSpecialType} onChange={(e) => setNewSpecialType(e.target.value)}>{(state.specialEventTypes || []).map(t => <option key={t} value={t}>{t}</option>)}</select><button onClick={addSpecialType} className="p-1 rounded border bg-white hover:bg-slate-50 text-blue-600" title="Crea nuovo tipo"><Plus size={14}/></button></div><input type="number" className="w-16 text-xs border rounded p-1" placeholder="Ore" value={newSpecialHours} onChange={(e) => setNewSpecialHours(e.target.value ? parseFloat(e.target.value) : '')}/></div><Button variant="secondary" className="w-full text-xs py-1" onClick={addSpecialEvent} disabled={!newSpecialHours && newSpecialType !== 'Gettone'}>Aggiungi</Button></div><div className="mb-4"><h4 className="font-bold text-xs text-slate-500 uppercase mb-2">Voci Speciali Attive</h4><div className="space-y-2 max-h-40 overflow-y-auto">{draftSpecialEvents.length > 0 ? draftSpecialEvents.map(ev => (<div key={ev.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 text-sm"><div className="flex items-center gap-2">{ev.type === 'Gettone' ? <Coins size={14} className="text-amber-500"/> : <Star size={14} className="text-blue-500"/>}<span className="font-medium">{ev.type}</span>{ev.hours > 0 && <Badge color="bg-white border">{ev.hours}h</Badge>}</div><button onClick={() => setDraftSpecialEvents(prev => prev.filter(x => x.id !== ev.id))} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14} /></button></div>)) : (<div className="text-xs text-slate-400 italic text-center py-2 border border-dashed rounded">Nessuna voce speciale</div>)}</div></div></div></div>)}<div className="flex justify-between items-center pt-6 border-t mt-4"><button className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors flex items-center" onClick={() => { setDraftShift(''); setDraftNote(''); saveChanges(); }}><Eraser size={16} className="mr-2 inline" /> Ripristina / Cancella</button><div className="flex gap-2"><Button variant="ghost" onClick={() => setShowEditModal(false)}>Annulla</Button><Button variant="primary" onClick={saveChanges}><Save size={16} className="mr-2 inline" /> Salva Modifiche</Button></div></div></Modal>
      <Modal isOpen={!!editingDayNote} onClose={() => setEditingDayNote(null)} title={`Nota ${editingDayNote ? format(parseISO(editingDayNote.date), 'dd/MM') : ''}`} className="max-w-[300px]"><div className="space-y-3"><div><div className="flex gap-1 overflow-x-auto pb-1 justify-center no-scrollbar">{Object.entries(NOTE_TYPES).map(([key, config]) => (<button key={key} onClick={() => setEditingDayNote(prev => prev ? { ...prev, note: { ...prev.note, type: key as DayNoteType } } : null)} className={`flex flex-col items-center justify-center p-1.5 rounded border min-w-[36px] aspect-square transition-all ${editingDayNote?.note.type === key ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300' : 'bg-white border-slate-100 hover:bg-slate-50'}`} title={config.label}><config.icon size={18} className={config.color} /></button>))}</div></div><textarea className="w-full text-xs border border-slate-300 rounded p-2 h-16 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white" value={editingDayNote?.note.text || ''} onChange={(e) => setEditingDayNote(prev => prev ? { ...prev, note: { ...prev.note, text: e.target.value } } : null)} placeholder="Testo nota..." autoFocus /><div className="flex justify-between pt-1"><button className="p-1.5 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors" onClick={() => { if (editingDayNote) dispatch({ type: 'UPDATE_DAY_NOTE', payload: { date: editingDayNote.date, note: '' } }); setEditingDayNote(null); }} title="Elimina Nota"><Trash2 size={16} /></button><button className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1" onClick={() => { if (editingDayNote) dispatch({ type: 'UPDATE_DAY_NOTE', payload: { date: editingDayNote.date, note: editingDayNote.note } }); setEditingDayNote(null); }}><Save size={14} /> Salva</button></div></div></Modal>
      <Modal isOpen={!!editingOperatorNote} onClose={() => setEditingOperatorNote(null)} title={`Note: ${editingOperatorNote?.name}`} className="max-w-[300px]"><div className="space-y-3"><textarea className="w-full text-xs border border-slate-300 rounded p-2 h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white" value={editingOperatorNote?.text || ''} onChange={(e) => setEditingOperatorNote(prev => prev ? { ...prev, text: e.target.value } : null)} placeholder="Note personali operatore..." autoFocus /><div className="flex justify-between pt-1"><button className="p-1.5 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors" onClick={() => { if (editingOperatorNote) { const op = state.operators.find(o => o.id === editingOperatorNote.opId); if (op) dispatch({ type: 'UPDATE_OPERATOR', payload: { ...op, notes: '' } }); } setEditingOperatorNote(null); }} title="Elimina Nota"><Trash2 size={16} /></button><button className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1" onClick={() => { if (editingOperatorNote) { const op = state.operators.find(o => o.id === editingOperatorNote.opId); if (op) dispatch({ type: 'UPDATE_OPERATOR', payload: { ...op, notes: editingOperatorNote.text } }); } setEditingOperatorNote(null); }}><Save size={14} /> Salva</button></div></div></Modal>
    </div>
  );
};
