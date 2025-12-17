import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, parseISO } from '../utils';
import { format, isWeekend, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Briefcase, X, Eraser, Printer, Info } from 'lucide-react';
import { Button, Modal } from '../components/UI';
import { AssignmentEntry } from '../types';
import { AssignmentsPrintLayout } from '../components/AssignmentsPrintLayout';

export const Assignments = () => {
    const { state, dispatch } = useApp();
    const days = useMemo(() => getMonthDays(state.currentDate), [state.currentDate]);
    // selectedAssignment: string ID, 'CLEAR' for eraser mode, or null
    const [selectedAssignment, setSelectedAssignment] = useState<string | 'CLEAR' | null>(null);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    
    const handlePrevMonth = () => dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), -1), 'yyyy-MM-dd') });
    const handleNextMonth = () => dispatch({ type: 'SET_DATE', payload: format(addMonths(parseISO(state.currentDate), 1), 'yyyy-MM-dd') });
    const handleToday = () => dispatch({ type: 'SET_DATE', payload: format(new Date(), 'yyyy-MM-01') });

    const toggleAssignment = (opId: string, date: string) => {
        if (!selectedAssignment) return;

        const key = `${opId}_${date}`;
        const shiftEntry = getEntry(state, opId, date);
        const matrixShift = calculateMatrixShift(state.operators.find(o => o.id === opId)!, date, state.matrices);
        const shiftCode = shiftEntry ? shiftEntry.shiftCode : (matrixShift || '');
        const shiftType = state.shiftTypes.find(s => s.code === shiftCode);
        
        // Block assignment if not a day-working shift (hours 0 or Night)
        const isAssignable = shiftType && shiftType.hours > 0 && shiftCode !== 'N';
        if (!isAssignable) return;

        if (selectedAssignment === 'CLEAR') {
            dispatch({ type: 'REMOVE_ASSIGNMENT', payload: { operatorId: opId, date } });
            return;
        }

        const current = state.assignmentData[key];

        if (current && current.assignmentId === selectedAssignment) {
            // Remove if clicking the same one
            dispatch({ type: 'REMOVE_ASSIGNMENT', payload: { operatorId: opId, date } });
        } else {
            // Add or overwrite
            dispatch({
                type: 'UPDATE_ASSIGNMENT',
                payload: { operatorId: opId, date, assignmentId: selectedAssignment }
            });
        }
    };

    const formatMonth = (dateStr: string) => {
        const d = parseISO(dateStr);
        if (isNaN(d.getTime())) return "-";
        const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const printRoot = document.getElementById('print-root');

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Print Preview Overlay */}
            {showPrintPreview && (
                <div className="fixed inset-0 z-[100] bg-white overflow-auto flex flex-col animate-in fade-in duration-200">
                    <div className="shrink-0 p-4 border-b bg-slate-50 flex justify-between items-center no-print sticky top-0 shadow-sm z-50">
                        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <Printer className="text-blue-600"/> Anteprima di Stampa Incarichi
                        </h2>
                        <div className="flex items-center gap-3">
                            <div className="text-xs text-slate-500 flex items-center mr-2 bg-yellow-50 px-2 py-1 rounded border border-yellow-200 hidden md:flex">
                                <span className="flex items-center mr-1 text-yellow-600"><Info size={14} className="mr-1"/></span>
                                <span>Usa <strong>Ctrl+P</strong> se la stampa non parte automaticamente.</span>
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
                        <div className="bg-white shadow-xl p-8 max-w-[1400px] w-full min-h-screen print-area scale-75 origin-top">
                            <AssignmentsPrintLayout />
                        </div>
                    </div>
                </div>
            )}

            {/* Print Portal - Renders content to the hidden print div for browser printing */}
            {showPrintPreview && printRoot && createPortal(
                <AssignmentsPrintLayout />,
                printRoot
            )}

            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm z-20">
                <div className="flex items-center gap-6">
                    {/* Date Navigation */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={16} /></button>
                        <span className="px-3 font-semibold text-slate-700 min-w-[140px] text-center capitalize">{formatMonth(state.currentDate)}</span>
                        <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={16} /></button>
                    </div>

                    <Button variant="secondary" className="text-xs py-1 px-3 ml-2" onClick={handleToday}>
                        Oggi
                    </Button>
                    
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>

                    {/* Legend / Picker - MOVED LEFT */}
                    <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase mr-2">Strumenti:</span>
                        {state.assignments.map(a => (
                            <button
                                key={a.id}
                                onClick={() => setSelectedAssignment(selectedAssignment === a.id ? null : a.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${selectedAssignment === a.id ? 'ring-2 ring-offset-1 ring-blue-500 bg-slate-50 shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                                style={{borderColor: selectedAssignment === a.id ? a.color : 'transparent'}}
                            >
                                <div className="w-3 h-3 rounded-full shadow-sm border border-black/10" style={{backgroundColor: a.color}}></div>
                                {a.code}
                            </button>
                        ))}
                        
                        {/* Eraser Tool */}
                        <button 
                            onClick={() => setSelectedAssignment(selectedAssignment === 'CLEAR' ? null : 'CLEAR')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ml-2 ${selectedAssignment === 'CLEAR' ? 'ring-2 ring-offset-1 ring-red-500 bg-red-50 text-red-700 border-red-200' : 'bg-white hover:bg-slate-50 text-slate-500 border-transparent'}`}
                        >
                            <Eraser size={14} />
                            Gomma
                        </button>

                        {selectedAssignment && (
                            <button onClick={() => setSelectedAssignment(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 ml-2" title="Deseleziona">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <Button variant="secondary" onClick={() => setShowPrintPreview(true)} title="Stampa Incarichi">
                     <Printer size={16} className="md:mr-2" /> <span className="hidden md:inline">Stampa</span>
                </Button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto planner-scroll cursor-default">
                <div className="inline-block min-w-full align-middle">
                    <div className="sticky top-0 z-20 flex bg-slate-100 border-b border-slate-300 shadow-sm">
                        <div className="sticky left-0 w-48 bg-slate-100 border-r border-slate-300 flex items-center pl-4 font-bold text-slate-700 z-30 shadow-r h-10">
                            Operatore
                        </div>
                        {days.map(d => (
                            <div key={d.toString()} className={`flex-1 min-w-[35px] h-10 flex items-center justify-center border-r border-slate-300 text-xs font-bold ${isWeekend(d) ? 'bg-slate-200' : ''}`}>
                                {format(d, 'd')}
                            </div>
                        ))}
                    </div>

                    {state.operators.filter(o => o.isActive).map(op => (
                        <div key={op.id} className="flex border-b border-slate-300 hover:bg-slate-50">
                            <div className="sticky left-0 w-48 bg-white border-r border-slate-300 flex items-center pl-4 py-2 z-10 shadow-r">
                                <span className="font-medium text-slate-800 text-sm">{op.lastName} {op.firstName}</span>
                            </div>
                            {days.map(d => {
                                const dateKey = formatDateKey(d);
                                const shiftEntry = getEntry(state, op.id, dateKey);
                                const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
                                const shiftCode = shiftEntry ? shiftEntry.shiftCode : (matrixShift || '');
                                
                                const assignmentEntry = state.assignmentData[`${op.id}_${dateKey}`];
                                const assignment = assignmentEntry ? state.assignments.find(a => a.id === assignmentEntry.assignmentId) : null;

                                const shiftType = state.shiftTypes.find(s => s.code === shiftCode);
                                
                                // Assignment is only allowed for working day shifts (exclude OFF, R, etc. and Night N)
                                const isAssignable = shiftType && shiftType.hours > 0 && shiftCode !== 'N';

                                return (
                                    <div 
                                        key={d.toString()} 
                                        className={`flex-1 min-w-[35px] h-10 flex items-center justify-center border-r border-slate-300 text-sm relative ${isAssignable ? 'bg-white font-bold text-slate-900' : 'bg-slate-200 text-slate-400'} ${selectedAssignment && isAssignable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                                        onClick={() => isAssignable && toggleAssignment(op.id, dateKey)}
                                    >
                                        {!isAssignable && !assignment && (
                                            <div className="absolute inset-0" style={{ 
                                                backgroundImage: 'repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 2px, transparent 0, transparent 50%)',
                                                backgroundSize: '4px 4px',
                                                opacity: 0.3
                                            }}></div>
                                        )}

                                        <span className="relative z-10">{shiftCode}</span>
                                        
                                        {assignment && (
                                            <div 
                                                className="absolute inset-1 rounded border-2 flex items-center justify-center shadow-sm transition-all z-10"
                                                style={{ borderColor: assignment.color, backgroundColor: `${assignment.color}40` }}
                                                title={assignment.name}
                                            >
                                            </div>
                                        )}
                                        
                                        {/* Hover Preview for Eraser */}
                                        {selectedAssignment === 'CLEAR' && assignment && isAssignable && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-red-100/50 opacity-0 hover:opacity-100 text-red-600 z-20">
                                                <X size={14} />
                                            </div>
                                        )}
                                        
                                        {/* Hover Preview for Adding */}
                                        {selectedAssignment && selectedAssignment !== 'CLEAR' && !assignment && isAssignable && (
                                            <div 
                                                className="absolute inset-1 rounded opacity-0 hover:opacity-40 border-2 border-dashed z-20"
                                                style={{ borderColor: state.assignments.find(a => a.id === selectedAssignment)?.color }}
                                            ></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="p-3 bg-slate-50 border-t text-xs text-slate-500 text-center flex justify-between px-6">
                <span>I turni <strong>Notturni (N)</strong> e i turni di riposo sono stati esclusi dall'assegnazione incarichi.</span>
                <span>Seleziona uno strumento in alto e clicca sulle celle bianche.</span>
            </div>
        </div>
    );
};