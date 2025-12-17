import React, { useMemo } from 'react';
import { useApp } from '../store';
import { formatDateKey, getEntry, calculateMatrixShift, parseISO, isOperatorEmployed, getShiftByCode, getItalianHolidayName, startOfMonth, endOfMonth } from '../utils';
import { format, eachDayOfInterval, getDay } from 'date-fns';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ITALIAN_DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const getContrastColor = (hexColor?: string) => {
  if (!hexColor) return '#000000';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

export const PersonalCalendarPrintLayout: React.FC<{ operatorId: string }> = ({ operatorId }) => {
  const { state } = useApp();
  const operator = state.operators.find(o => o.id === operatorId);
  const monthDate = parseISO(state.currentDate);
  
  const calendarDays = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const monthDays = eachDayOfInterval({ start, end });
    let firstDayIndex = getDay(start) - 1;
    if (firstDayIndex < 0) firstDayIndex = 6;
    const padding = Array.from({ length: firstDayIndex }).fill(null) as (Date | null)[];
    return [...padding, ...monthDays];
  }, [monthDate]);

  if (!operator) return <div className="p-20 text-center text-slate-400 font-bold text-2xl uppercase">Seleziona un operatore per stampare il calendario</div>;

  return (
    <div 
      className="font-sans w-full bg-white flex flex-col"
      style={{ 
        width: '210mm', 
        minHeight: '296mm',
        margin: '0 auto',
        padding: '15mm',
        boxSizing: 'border-box'
      }}
    >
      {/* Intestazione Mese (Blu Scuro Immagine 2) */}
      <div className="bg-slate-900 text-white p-6 mb-2 text-center shadow-lg">
        <h1 className="text-5xl font-black uppercase tracking-tighter">
          {ITALIAN_MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}
        </h1>
      </div>

      {/* Barra Operatore (Grigio Immagine 2) */}
      <div className="bg-slate-300 p-4 mb-6 border-y-4 border-slate-400 text-center">
        <h2 className="text-3xl font-black uppercase tracking-widest text-slate-800">
          {operator.lastName} {operator.firstName}
        </h2>
      </div>

      {/* Griglia Calendario - Dimensioni Massimizzate */}
      <div className="flex-grow">
        <table className="w-full border-collapse border-4 border-slate-900 h-full">
          <thead>
            <tr className="bg-slate-100 h-10">
              {ITALIAN_DAYS.map(day => (
                <th key={day} className="border-2 border-slate-800 p-2 text-slate-700 uppercase text-xs font-black text-center">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIndex) => (
              <tr key={weekIndex} className="h-32">
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const day = calendarDays[weekIndex * 7 + dayIndex];
                  if (!day) return <td key={dayIndex} className="border-2 border-slate-300 bg-slate-50/50"></td>;

                  const dateKey = formatDateKey(day);
                  const entry = getEntry(state, operator.id, dateKey);
                  const matrixShift = calculateMatrixShift(operator, dateKey, state.matrices);
                  const code = entry?.shiftCode ?? matrixShift ?? '';
                  const shift = getShiftByCode(code, state.shiftTypes);
                  const isRedDay = getItalianHolidayName(day) || getDay(day) === 0;

                  return (
                    <td key={dayIndex} className="border-2 border-slate-800 p-1 relative align-top">
                      <div className={`text-sm font-black p-1 inline-block ${isRedDay ? 'text-white bg-red-600 rounded-sm' : 'text-slate-900'}`}>
                        {format(day, 'dd')}
                      </div>

                      {code && (
                        <div 
                          className="absolute inset-x-2 bottom-3 top-10 rounded shadow-md flex items-center justify-center text-3xl font-black border-2 border-black/10"
                          style={{ 
                            backgroundColor: shift?.color || '#f8fafc',
                            color: getContrastColor(shift?.color)
                          }}
                        >
                          {code}
                        </div>
                      )}
                      
                      {entry?.note && (
                        <div className="absolute top-1 right-1 text-[7px] text-slate-400 bg-white/80 px-1 font-bold rounded">
                          NOTA
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Riepilogo */}
      <div className="mt-8 border-t-2 border-slate-300 pt-4 flex justify-between items-center">
          <div className="text-[10px] text-slate-400 font-bold uppercase">
             ShiftMaster Pro | {format(new Date(), 'dd/MM/yyyy')}
          </div>
          <div className="flex flex-wrap gap-3">
             {state.shiftTypes.filter(s => s.hours > 0).map(s => (
                 <div key={s.id} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                     <div className="w-3 h-3 rounded-full border border-black/10" style={{backgroundColor: s.color}}></div>
                     <span className="text-[10px] font-black text-slate-700">{s.code}</span>
                 </div>
             ))}
          </div>
      </div>
    </div>
  );
};