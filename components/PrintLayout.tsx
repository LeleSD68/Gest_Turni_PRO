
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

export const PrintLayout = ({ operatorId }: { operatorId?: string }) => {
  const { state } = useApp();
  const days = getMonthDays(state.currentDate);

  const extractTime = (name: string) => {
    const match = name.match(/\((.*?)\)/);
    return match ? match[1] : '';
  };

  const operatorsToPrint = operatorId 
    ? state.operators.filter(o => o.id === operatorId)
    : state.operators.filter(o => o.isActive);

  return (
    <div 
      className="p-6 font-sans flex flex-col"
      style={{ 
        width: '100%',
        maxWidth: '420mm', // A3 Landscape limit
        minHeight: '280mm',
        backgroundColor: '#1e3a8a', 
        color: 'white',
        WebkitPrintColorAdjust: 'exact', 
        printColorAdjust: 'exact',
        margin: '0 auto'
      }}
    >
      <div className="flex justify-between items-end mb-6 border-b-2 border-blue-400 pb-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider mb-2">Turni Personale</h1>
          <h2 className="text-2xl font-light capitalize">
            {(() => {
                const d = new Date(state.currentDate);
                return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
            })()}
          </h2>
        </div>
        <div className="text-right opacity-80">
          <div className="text-xl font-bold">ShiftMaster Pro</div>
          <div className="text-sm">Programmazione Operativa</div>
        </div>
      </div>
      
      <div className="bg-white text-black rounded-sm overflow-hidden shadow-sm flex-1">
        <table className="w-full border-collapse border border-slate-400 h-full table-fixed">
          <thead>
            <tr className="bg-slate-100 h-10" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <th className="border border-slate-400 p-2 w-48 text-left font-bold text-slate-800 uppercase text-[11px]">Operatore</th>
              <th className="border border-slate-400 p-0.5 text-center w-12 font-bold text-slate-500 uppercase text-[9px] bg-slate-200" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Ore</th>
              {days.map(d => {
                  const isHol = isItalianHoliday(d);
                  return (
                    <th 
                      key={d.toString()} 
                      className="border border-slate-400 p-0.5 text-center"
                      style={{ 
                          backgroundColor: isHol ? '#dbeafe' : 'transparent', 
                          color: isHol ? '#1e40af' : 'inherit',
                          WebkitPrintColorAdjust: 'exact', 
                          printColorAdjust: 'exact' 
                      }}
                    >
                      <div className="font-bold text-sm">{format(d, 'd')}</div>
                      <div className="text-[10px] uppercase">
                        {ITALIAN_DAYS[d.getDay()].substring(0, 1)}
                      </div>
                    </th>
                  );
              })}
            </tr>
          </thead>
          <tbody>
            {operatorsToPrint.map(op => {
              const totalHours = days.reduce((acc, d) => {
                const dk = formatDateKey(d);
                if (!isOperatorEmployed(op, dk)) return acc;
                const entry = getEntry(state, op.id, dk);
                const mxCode = calculateMatrixShift(op, dk, state.matrices);
                const code = entry?.shiftCode || mxCode || '';
                const st = state.shiftTypes.find(s => s.code === code);
                let h = 0;
                if (entry?.customHours !== undefined) {
                  h = entry.customHours;
                } else if (st) {
                  if (st.inheritsHours) {
                    const mxShift = state.shiftTypes.find(s => s.code === mxCode);
                    h = mxShift?.hours || 0;
                  } else {
                    h = st.hours;
                  }
                }
                if (entry?.specialEvents) {
                  entry.specialEvents.forEach(ev => {
                    if (ev.mode === 'ADDITIVE' || !ev.mode) h += ev.hours;
                    else if (ev.mode === 'SUBTRACTIVE') h -= ev.hours;
                  });
                }
                return acc + h;
              }, 0);

              return (
                <tr key={op.id}>
                  <td className="border border-slate-400 p-1 pl-3 font-semibold truncate text-slate-900 text-[11px]">
                    {op.lastName} {op.firstName.charAt(0)}.
                  </td>
                  <td className="border border-slate-400 p-0.5 text-center font-bold text-slate-600 bg-slate-50 text-[10px]" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    {totalHours > 0 ? Math.round(totalHours) : '-'}
                  </td>
                  {days.map(d => {
                    const dateKey = formatDateKey(d);
                    const isHol = isItalianHoliday(d);
                    if (!isOperatorEmployed(op, dateKey)) {
                       return (
                        <td 
                            key={dateKey} 
                            className="border border-slate-400 bg-slate-200"
                            style={{ 
                                backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 50%, #cbd5e1 50%, #cbd5e1 75%, transparent 75%, transparent)',
                                backgroundSize: '6px 6px',
                                WebkitPrintColorAdjust: 'exact', 
                                printColorAdjust: 'exact'
                            }}
                        ></td>
                       );
                    }
                    const entry = getEntry(state, op.id, dateKey);
                    const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
                    const code = entry?.shiftCode || matrixShift || '';
                    const shift = state.shiftTypes.find(s => s.code === code);
                    let bg = shift?.color ? `${shift.color}60` : (isHol ? '#eff6ff' : 'transparent');
                    return (
                      <td 
                        key={dateKey} 
                        className="border border-slate-400 p-0 text-center font-bold align-middle text-[10px]"
                        style={{
                            backgroundColor: bg,
                            WebkitPrintColorAdjust: 'exact', 
                            printColorAdjust: 'exact'
                        }}
                      >
                        <span style={{ color: '#000' }}>{code}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 pt-4 border-t-2 border-blue-400">
         <div className="text-center font-bold uppercase text-xs mb-3 tracking-widest opacity-80">Legenda Orari</div>
         <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {state.shiftTypes.filter(s => s.hours > 0).map(s => {
                const timeRange = extractTime(s.name);
                if (!timeRange) return null;
                return (
                  <div key={s.id} className="flex items-center gap-2 min-w-[80px]">
                      <div 
                          className="w-3.5 h-3.5 border border-white/50 rounded-sm shadow-sm" 
                          style={{ 
                              backgroundColor: s.color,
                              WebkitPrintColorAdjust: 'exact', 
                              printColorAdjust: 'exact'
                          }}
                      ></div>
                      <div className="text-[10px]">
                          <span className="font-bold text-blue-100">{s.code}</span>
                          <span className="mx-1 text-blue-300">:</span>
                          <span className="text-white">{timeRange}</span>
                      </div>
                  </div>
                );
            })}
         </div>
      </div>

      <div className="mt-auto pt-8 flex justify-between items-end">
         <div className="text-blue-200 italic text-xs mb-1">
            <div>Aggiornato il:</div>
            <div className="font-bold">{format(new Date(), 'dd/MM/yyyy')} <span className="font-normal">alle</span> {format(new Date(), 'HH:mm')}</div>
         </div>
         <div 
            className="p-4 rounded-sm w-80 shadow-sm"
            style={{
                backgroundColor: 'white',
                color: 'black',
                WebkitPrintColorAdjust: 'exact', 
                printColorAdjust: 'exact'
            }}
         >
            <div className="border-b-2 border-black mb-3 h-10"></div>
            <div className="font-bold text-[10px] uppercase tracking-wide text-center text-slate-700">Il Responsabile Sanitario</div>
         </div>
      </div>
    </div>
  );
};
