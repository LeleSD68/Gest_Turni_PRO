import React from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '../utils';
import { format, eachDayOfInterval, isSameMonth, isSunday } from 'date-fns';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const WEEK_DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

// Helper per il contrasto del testo
const getContrastColor = (hexColor?: string) => {
  if (!hexColor) return '#000000';
  const hex = hexColor.replace('#', '');
  const fullHex = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (fullHex.length !== 6) return '#000000';
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

export const SingleOperatorCalendarLayout = ({ operatorId }: { operatorId: string }) => {
  const { state } = useApp();
  const operator = state.operators.find(o => o.id === operatorId);
  const currentDate = new Date(state.currentDate);
  
  // Calcolo giorni del calendario (inclusi padding inizio/fine mese per completare la griglia)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunedì
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  if (!operator) return <div>Operatore non trovato</div>;

  return (
    <div 
      className="p-8 font-sans w-full min-h-[297mm] flex flex-col bg-white"
      style={{ 
        width: '297mm', // A4 Landscape o A3 Portrait fit
        margin: '0 auto',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact'
      }}
    >
      {/* Header */}
      <div className="mb-6 border-b-4 border-slate-800 pb-4 flex justify-between items-end">
        <div>
            <h1 className="text-4xl font-black uppercase tracking-wider text-slate-900 mb-2">
                {ITALIAN_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h1>
            <h2 className="text-2xl font-light text-slate-600">
                Turni di servizio: <span className="font-bold text-slate-900">{operator.lastName} {operator.firstName}</span>
            </h2>
        </div>
        <div className="text-right">
            <div className="text-xl font-bold text-slate-400 uppercase tracking-widest">ShiftMaster Pro</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col border-l border-t border-slate-300">
        
        {/* Header Giorni Settimana */}
        <div className="grid grid-cols-7 h-10">
            {WEEK_DAYS.map((day, index) => (
                <div 
                    key={day} 
                    className={`flex items-center justify-center border-r border-b border-slate-300 font-bold uppercase text-sm
                        ${index === 6 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}
                    `}
                >
                    {day}
                </div>
            ))}
        </div>

        {/* Celle Giorni */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
            {calendarDays.map((day) => {
                const dateKey = formatDateKey(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSun = isSunday(day);
                
                // Dati Turno
                let cellContent = null;
                let bgColor = isCurrentMonth ? (isSun ? '#fff1f2' : '#ffffff') : '#f8fafc'; // Default backgrounds
                let textColor = '#1e293b'; // Slate-800
                
                if (isCurrentMonth && isOperatorEmployed(operator, dateKey)) {
                    const entry = getEntry(state, operator.id, dateKey);
                    const matrixCode = calculateMatrixShift(operator, dateKey, state.matrices);
                    const code = entry?.shiftCode || matrixCode || '';
                    const shiftType = state.shiftTypes.find(s => s.code === code);
                    const note = entry?.note;

                    if (code && code !== 'OFF') {
                        // Se c'è un turno, usa il colore del turno
                        if (shiftType) {
                            bgColor = shiftType.color;
                            textColor = getContrastColor(shiftType.color);
                        }
                        
                        cellContent = (
                            <>
                                <div className="flex-1 flex items-center justify-center">
                                    <span className="text-3xl font-black tracking-tight" style={{ fontSize: code.length > 3 ? '1.5rem' : '2.5rem' }}>
                                        {code}
                                    </span>
                                </div>
                                {note && (
                                    <div 
                                        className="w-full text-[10px] text-center px-1 truncate mb-1 opacity-90 font-medium"
                                        style={{ color: textColor }}
                                    >
                                        {note}
                                    </div>
                                )}
                                {entry?.customHours !== undefined && (
                                    <div className="absolute top-1 right-1 text-[10px] font-mono opacity-70">
                                        {entry.customHours}h
                                    </div>
                                )}
                            </>
                        );
                    }
                }

                return (
                    <div 
                        key={dateKey} 
                        className={`border-r border-b border-slate-300 relative flex flex-col min-h-[30mm]
                            ${!isCurrentMonth ? 'opacity-40 grayscale bg-slate-100' : ''}
                        `}
                        style={{ 
                            backgroundColor: bgColor,
                            color: textColor,
                            printColorAdjust: 'exact',
                            WebkitPrintColorAdjust: 'exact'
                        }}
                    >
                        {/* Numero Giorno (Alto Sx) */}
                        <div className={`absolute top-1 left-2 text-sm font-bold ${isSun && isCurrentMonth && !cellContent ? 'text-red-500' : 'opacity-60'}`}>
                            {format(day, 'd')}
                        </div>

                        {cellContent}
                    </div>
                );
            })}
        </div>
      </div>

      {/* Footer / Legenda Rapida */}
      <div className="mt-6 flex justify-between items-end border-t border-slate-300 pt-4">
         <div className="flex gap-4 flex-wrap max-w-[70%]">
            {state.shiftTypes.filter(s => s.hours > 0).map(s => (
                <div key={s.id} className="flex items-center gap-1.5">
                    <div 
                        className="w-3 h-3 border border-slate-300 rounded-sm shadow-sm" 
                        style={{ backgroundColor: s.color, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                    ></div>
                    <span className="text-[10px] uppercase text-slate-500 font-bold">{s.code}</span>
                </div>
            ))}
         </div>
         
         <div className="text-right text-[10px] text-slate-400">
            Generato il {format(new Date(), 'dd/MM/yyyy HH:mm')}
         </div>
      </div>

    </div>
  );
};