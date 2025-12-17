import React from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed } from '../utils';
import { format } from 'date-fns';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

const isItalianHoliday = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const isSunday = date.getDay() === 0;
  if (isSunday) return true;
  const holidays = ['1-1', '6-1', '25-4', '1-5', '2-6', '15-8', '1-11', '8-12', '25-12', '26-12'];
  return holidays.includes(`${day}-${month}`);
};

export const PrintLayout = () => {
  const { state } = useApp();
  const days = getMonthDays(state.currentDate);

  const extractTime = (name: string) => {
    const match = name.match(/\((.*?)\)/);
    return match ? match[1] : '';
  };

  return (
    <div 
      className="p-8 font-sans w-full text-xs min-h-[297mm] flex flex-col"
      style={{ 
        width: '100%',
        backgroundColor: '#1e3a8a',
        color: 'white',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-end mb-6 border-b-2 border-blue-400 pb-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider mb-1">Turni Personale</h1>
          <h2 className="text-2xl font-light capitalize">
            {(() => {
                const d = new Date(state.currentDate);
                return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
            })()}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">ShiftMaster Pro</div>
          <div className="text-xs uppercase opacity-70">Programmazione Operativa</div>
        </div>
      </div>
      
      {/* Griglia Turni - Espandibile */}
      <div className="bg-white text-black rounded-sm shadow-xl flex-grow overflow-hidden mb-6">
        <table className="w-full border-collapse table-fixed h-full">
          <thead>
            <tr className="bg-slate-100 h-12">
              <th className="border border-slate-300 p-2 w-40 text-left font-black text-slate-800 uppercase text-[11px]">Operatore</th>
              <th className="border border-slate-300 p-2 w-14 text-center font-bold text-slate-700 uppercase text-[9px] bg-slate-200">Ore</th>
              {days.map(d => {
                  const isHol = isItalianHoliday(d);
                  return (
                    <th key={d.toString()} className={`border border-slate-300 p-0.5 text-center ${isHol ? 'bg-blue-50 text-blue-800' : ''}`}>
                      <div className="font-bold text-[11px]">{format(d, 'd')}</div>
                      <div className="text-[8px] uppercase">{ITALIAN_DAYS[d.getDay()].substring(0, 1)}</div>
                    </th>
                  );
              })}
            </tr>
          </thead>
          <tbody>
            {state.operators.filter(o => o.isActive).map(op => {
              const totalMonthlyHours = days.reduce((acc, d) => {
                  const dk = formatDateKey(d);
                  if (!isOperatorEmployed(op, dk)) return acc;
                  const entry = getEntry(state, op.id, dk);
                  const matrixCode = calculateMatrixShift(op, dk, state.matrices);
                  const code = entry?.shiftCode || matrixCode || '';
                  const st = state.shiftTypes.find(s => s.code === code);
                  let h = entry?.customHours ?? (st?.inheritsHours ? (state.shiftTypes.find(s => s.code === matrixCode)?.hours || 0) : (st?.hours || 0));
                  return acc + h;
              }, 0);

              return (
                <tr key={op.id} className="h-8">
                  <td className="border border-slate-200 p-1 pl-3 font-bold truncate text-slate-900 text-[11px] uppercase">
                    {op.lastName} {op.firstName.charAt(0)}.
                  </td>
                  <td className="border border-slate-200 p-1 text-center font-black text-slate-700 bg-slate-50 text-[11px]">
                    {totalMonthlyHours > 0 ? Math.round(totalMonthlyHours) : '-'}
                  </td>
                  {days.map(d => {
                    const dk = formatDateKey(d);
                    if (!isOperatorEmployed(op, dk)) return <td key={dk} className="border border-slate-100 bg-slate-100"></td>;
                    const entry = getEntry(state, op.id, dk);
                    const matrixShift = calculateMatrixShift(op, dk, state.matrices);
                    const code = entry?.shiftCode || matrixShift || '';
                    const shift = state.shiftTypes.find(s => s.code === code);
                    return (
                      <td key={dk} className="border border-slate-200 p-0 text-center font-bold text-[10px]" style={{ backgroundColor: shift?.color ? `${shift.color}40` : 'transparent' }}>
                        {code}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Footer & Legenda */}
      <div className="mt-auto">
        <div className="flex justify-between items-end border-t border-blue-400 pt-6">
            <div className="flex-1">
                <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
                    {state.shiftTypes.filter(s => s.hours > 0).map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm border border-white/50" style={{ backgroundColor: s.color }}></div>
                            <span className="text-[10px] font-bold">{s.code}</span>
                            <span className="text-[10px] opacity-70">{extractTime(s.name)}</span>
                        </div>
                    ))}
                </div>
                <div className="text-blue-200 italic text-[10px]">Aggiornato al: {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
            </div>
            <div className="bg-white p-4 rounded shadow-lg w-72 text-black">
                <div className="border-b border-slate-400 h-10 mb-2"></div>
                <div className="text-[10px] font-black uppercase text-center text-slate-500">Firma Responsabile</div>
            </div>
        </div>
      </div>
    </div>
  );
};