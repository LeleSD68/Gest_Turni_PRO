import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { format, addMonths, isWeekend, parseISO } from 'date-fns';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed, isItalianHoliday, getItalianHolidayName } from '../utils';
import { ChevronLeft, ChevronRight, Printer, StickyNote, AlertCircle, MoreVertical, MessageSquare } from 'lucide-react';
import { Button, Modal, Input } from '../components/UI';
import { PrintLayout } from '../components/PrintLayout';
import { TimesheetPrintLayout } from '../components/TimesheetPrintLayout';
import { OperatorDetailModal } from '../components/OperatorDetailModal';

export const Planner = () => {
  const { state, dispatch } = useApp();
  const days = useMemo(() => getMonthDays(state.currentDate), [state.currentDate]);
  
  // States
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [noteTooltip, setNoteTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [printMode, setPrintMode] = useState<'NONE' | 'PLANNER' | 'TIMESHEET'>('NONE');
  const [highlightNotes, setHighlightNotes] = useState(false);
  const [editingCell, setEditingCell] = useState<{ operatorId: string, date: string } | null>(null);

  // Navigation
  const handlePrevMonth = () => dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), -1), 'yyyy-MM-dd') });
  const handleNextMonth = () => dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), 1), 'yyyy-MM-dd') });
  const handleToday = () => dispatch({ type: 'SET_DATE', payload: format(new Date(), 'yyyy-MM-01') });

  // Formatting
  const formatMonth = (dateStr: string) => {
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return "-";
      const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Sorting
  const sortedOperators = useMemo(() => {
    return state.operators
        .filter(o => o.isActive)
        .sort((a, b) => {
            const matrixIndexA = state.matrices.findIndex(m => m.id === a.matrixId);
            const matrixIndexB = state.matrices.findIndex(m => m.id === b.matrixId);
            
            const hasMatrixA = matrixIndexA !== -1;
            const hasMatrixB = matrixIndexB !== -1;

            if (hasMatrixA && !hasMatrixB) return -1;
            if (!hasMatrixA && hasMatrixB) return 1;
            
            if (hasMatrixA && hasMatrixB && matrixIndexA !== matrixIndexB) {
                return matrixIndexA - matrixIndexB;
            }

            const orderA = a.order !== undefined ? a.order : 9999;
            const orderB = b.order !== undefined ? b.order : 9999;
            if (orderA !== orderB) return orderA - orderB;

            return a.lastName.localeCompare(b.lastName);
        });
  }, [state.operators, state.matrices]);

  // Helper for contrast
  const getContrastColor = (hexColor?: string) => {
      if (!hexColor) return '#000000';
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? '#000000' : '#ffffff';
  };

  const printRoot = document.getElementById('print-root');

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Tooltip */}
      {noteTooltip && (
          <div 
              className="fixed z-[100] bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none max-w-xs break-words"
              style={{ top: noteTooltip.y, left: noteTooltip.x, transform: 'translateX(-50%)' }}
          >
              <div className="font-bold mb-1 border-b border-slate-600 pb-1">Nota</div>
              {noteTooltip.text}
          </div>
      )}

      {/* Operator Detail Modal */}
      <OperatorDetailModal 
          isOpen={!!selectedOp} 
          onClose={() => setSelectedOp(null)} 
          operatorId={selectedOp || ''} 
      />

      {/* Print Preview Overlay */}
      {printMode !== 'NONE' && (
        <div className="fixed inset-0 z-[100] bg-white overflow-auto flex flex-col animate-in fade-in duration-200">
            <div className="shrink-0 p-4 border-b bg-slate-50 flex justify-between items-center no-print sticky top-0 shadow-sm z-50">
                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Printer className="text-blue-600"/> Anteprima di Stampa: {printMode === 'PLANNER' ? 'Planner Visivo' : 'Cartellino Ore'}
                </h2>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" onClick={() => window.print()} className="gap-2">
                        <Printer size={16} /> Stampa
                    </Button>
                    <Button variant="danger" onClick={() => setPrintMode('NONE')}>
                        Chiudi
                    </Button>
                </div>
            </div>
            <div className="flex-1 p-4 md:p-8 overflow-auto bg-slate-100 flex justify-center">
                <div className={`bg-white shadow-xl p-8 w-full min-h-screen print-area scale-75 origin-top ${printMode === 'PLANNER' ? 'max-w-[1500px]' : 'max-w-[1100px]'}`}>
                    {printMode === 'PLANNER' ? <PrintLayout /> : <TimesheetPrintLayout />}
                </div>
            </div>
        </div>
      )}
      
      {/* Print Portal */}
      {printMode !== 'NONE' && printRoot && createPortal(
          printMode === 'PLANNER' ? <PrintLayout /> : <TimesheetPrintLayout />,
          printRoot
      )}

      {/* Toolbar */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm z-20 gap-4">
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={16} /></button>
                <span className="px-3 font-semibold text-slate-700 min-w-[140px] text-center capitalize">{formatMonth(state.currentDate)}</span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={16} /></button>
            </div>
            <Button variant="secondary" className="text-xs py-1 px-3" onClick={handleToday}>Oggi</Button>
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={() => setHighlightNotes(!highlightNotes)}
                className={`p-2 rounded transition-colors ${highlightNotes ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400' : 'hover:bg-slate-100 text-slate-500'}`}
                title="Evidenzia Note"
            >
                <StickyNote size={18} />
            </button>

            <div className="h-6 w-px bg-slate-300 mx-2"></div>

            <Button variant="secondary" onClick={() => setPrintMode('PLANNER')} title="Stampa Planner">
                <Printer size={16} className="md:mr-2" /> <span className="hidden md:inline">Planner</span>
            </Button>
            <Button variant="secondary" onClick={() => setPrintMode('TIMESHEET')} title="Stampa Cartellini">
                <Printer size={16} className="md:mr-2" /> <span className="hidden md:inline">Cartellini</span>
            </Button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto planner-scroll relative">
         <div className="inline-block min-w-full align-middle">
            {/* Header Row */}
            <div className="sticky top-0 z-20 flex bg-slate-100 border-b border-slate-300 shadow-sm h-10">
                <div className="sticky left-0 w-48 bg-slate-100 border-r border-slate-300 flex items-center pl-4 font-bold text-slate-700 z-30 shadow-r text-xs uppercase tracking-wider">
                    Operatore
                </div>
                {days.map(d => {
                    const isHol = isItalianHoliday(d);
                    const holidayName = getItalianHolidayName(d);
                    const isWknd = isWeekend(d);
                    return (
                        <div 
                            key={d.toString()} 
                            className={`flex-1 min-w-[38px] flex flex-col items-center justify-center border-r border-slate-300 relative group
                                ${isHol ? 'bg-red-50 text-red-700' : isWknd ? 'bg-slate-200 text-slate-600' : 'text-slate-700'}
                            `}
                            title={holidayName || format(d, 'EEEE d MMMM')}
                        >
                            <div className="text-[10px] font-bold leading-none">{format(d, 'd')}</div>
                            <div className="text-[8px] uppercase leading-none mt-0.5">{format(d, 'EEE').charAt(0)}</div>
                        </div>
                    );
                })}
            </div>

            {/* Operator Rows */}
            {sortedOperators.map(op => (
                <div key={op.id} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors h-12">
                    {/* Sticky Operator Name */}
                    <div className="sticky left-0 w-48 bg-white border-r border-slate-300 flex items-center justify-between pl-3 pr-2 z-10 shadow-r group">
                        <div 
                            className="font-medium text-slate-800 text-sm truncate cursor-pointer hover:text-blue-600 hover:underline"
                            onClick={() => setSelectedOp(op.id)}
                        >
                            {op.lastName} {op.firstName}
                        </div>
                        {op.contracts && op.contracts.length > 0 && !isOperatorEmployed(op, state.currentDate) && (
                            <div className="w-2 h-2 rounded-full bg-red-400" title="Contratto non attivo in questo periodo"></div>
                        )}
                        <button 
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 transition-all"
                            onClick={() => setSelectedOp(op.id)}
                        >
                            <MoreVertical size={14} />
                        </button>
                    </div>

                    {/* Day Cells */}
                    {days.map(d => {
                        const dateKey = formatDateKey(d);
                        
                        // Check contract validity
                        if (!isOperatorEmployed(op, dateKey)) {
                            return (
                                <div key={dateKey} className="flex-1 min-w-[38px] border-r border-slate-200 bg-slate-100" 
                                    style={{ 
                                        backgroundImage: 'repeating-linear-gradient(45deg, #cbd5e1 0, #cbd5e1 1px, transparent 0, transparent 50%)',
                                        backgroundSize: '10px 10px'
                                    }}
                                ></div>
                            );
                        }

                        // Get Data
                        const entry = getEntry(state, op.id, dateKey);
                        const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
                        const currentShiftCode = entry?.shiftCode ?? matrixCode ?? '';
                        
                        const shiftType = state.shiftTypes.find(s => s.code === currentShiftCode);
                        const isWorking = shiftType && shiftType.hours > 0;
                        const isManual = entry?.isManual;
                        const isSwap = false;
                        const isEntryManual = !!entry;
                        const isVariation = isEntryManual && entry?.shiftCode !== matrixCode;
                        
                        const hasNote = !!entry?.note;
                        const hasViolation = !!entry?.violation;
                        
                        // Assignment overlay
                        const assignmentEntry = state.assignmentData[`${op.id}_${dateKey}`];
                        const assignment = assignmentEntry ? state.assignments.find(a => a.id === assignmentEntry.assignmentId) : null;

                        // Styles
                        const bgColor = assignment ? assignment.color : (shiftType?.color || 'transparent');
                        const textColor = getContrastColor(bgColor);
                        
                        return (
                            <div 
                                key={dateKey} 
                                className={`flex-1 min-w-[38px] border-r border-slate-200 relative flex items-center justify-center cursor-pointer select-none
                                    ${!shiftType ? 'hover:bg-slate-100' : 'hover:brightness-95'}
                                    ${highlightNotes && hasNote ? 'ring-2 ring-inset ring-yellow-400' : ''}
                                `}
                                style={{ backgroundColor: bgColor, color: textColor }}
                                onClick={() => setEditingCell({ operatorId: op.id, date: dateKey })}
                            >
                                <span className={`text-xs font-bold ${!isWorking ? 'opacity-50' : ''}`}>
                                    {currentShiftCode}
                                </span>

                                {/* Indicators */}
                                {isVariation && !assignment && (
                                    <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 ring-1 ring-white"></div>
                                )}
                                
                                {hasViolation && (
                                    <div className="absolute top-0.5 right-0.5 text-red-600 bg-white rounded-full p-[1px]" title={entry.violation}>
                                        <AlertCircle size={8} />
                                    </div>
                                )}

                                {assignment && (
                                    <div className="absolute inset-0 border-2 border-white/20 pointer-events-none"></div>
                                )}

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
                                        <StickyNote size={9} className="text-black fill-black opacity-80 hover:scale-125 transition-transform" />
                                    </div>
                                )}

                                {/* Variation indicator if has note */}
                                {hasNote && (isSwap || isEntryManual || isVariation) && !highlightNotes && (
                                     <div 
                                        className="absolute bottom-0.5 right-0.5 pointer-events-auto z-50 cursor-help"
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setNoteTooltip({ x: rect.left + rect.width/2, y: rect.bottom + 5, text: entry.note! });
                                        }}
                                        onMouseLeave={() => setNoteTooltip(null)}
                                     >
                                        <MessageSquare size={8} className={`${textColor === '#ffffff' ? 'text-white' : 'text-slate-800'} opacity-80`} />
                                     </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
         </div>
      </div>

      {/* Edit Modal */}
      <Modal 
         isOpen={!!editingCell} 
         onClose={() => setEditingCell(null)} 
         title="Modifica Turno"
      >
          {editingCell && (
              <CellEditor 
                 operatorId={editingCell.operatorId} 
                 date={editingCell.date} 
                 onClose={() => setEditingCell(null)} 
              />
          )}
      </Modal>
    </div>
  );
};

// Sub-component for editing
const CellEditor = ({ operatorId, date, onClose }: { operatorId: string, date: string, onClose: () => void }) => {
    const { state, dispatch } = useApp();
    const entry = getEntry(state, operatorId, date);
    const op = state.operators.find(o => o.id === operatorId);
    
    // Fallback if not found
    if (!op) return null;

    const matrixShift = calculateMatrixShift(op, date, state.matrices);
    const currentCode = entry?.shiftCode || matrixShift || '';

    const handleShiftSelect = (code: string) => {
        if (code === matrixShift && !entry?.note && !entry?.specialEvents) {
            dispatch({ type: 'REMOVE_CELL', payload: { operatorId, date } });
        } else {
            dispatch({
                type: 'UPDATE_CELL',
                payload: {
                    operatorId,
                    date,
                    shiftCode: code,
                    isManual: true,
                    note: entry?.note,
                    specialEvents: entry?.specialEvents,
                    customHours: entry?.customHours
                }
            });
        }
        onClose();
    };

    const handleNoteChange = (note: string) => {
         dispatch({
            type: 'UPDATE_CELL',
            payload: {
                operatorId,
                date,
                shiftCode: currentCode,
                isManual: true,
                note: note || undefined,
                specialEvents: entry?.specialEvents,
                customHours: entry?.customHours
            }
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded border">
                <span className="text-sm font-bold text-slate-700">{format(parseISO(date), 'dd MMMM yyyy')}</span>
                <span className="text-sm text-slate-500">{op.lastName} {op.firstName}</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
                {state.shiftTypes.map(s => (
                    <button
                        key={s.id}
                        onClick={() => handleShiftSelect(s.code)}
                        className={`p-2 text-xs font-bold rounded border transition-all ${currentCode === s.code ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:bg-slate-50'}`}
                        style={{ backgroundColor: s.color, color: '#000' }}
                    >
                        {s.code}
                    </button>
                ))}
            </div>

            <div className="border-t pt-3">
                <Input 
                    label="Nota" 
                    value={entry?.note || ''} 
                    onChange={(e) => handleNoteChange(e.target.value)} 
                    placeholder="Aggiungi una nota..."
                />
            </div>
            
            <div className="flex justify-between pt-2">
                {entry && (
                    <Button variant="danger" onClick={() => {
                        dispatch({ type: 'REMOVE_CELL', payload: { operatorId, date } });
                        onClose();
                    }}>
                        Ripristina Matrice
                    </Button>
                )}
                <Button variant="secondary" onClick={onClose} className="ml-auto">Chiudi</Button>
            </div>
        </div>
    );
};
