import React from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, isOperatorEmployed, getEntry, calculateMatrixShift } from '../utils';
import { format } from 'date-fns';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

// Helper per determinare il colore del testo in base allo sfondo (contrasto)
const getContrastColor = (hexColor?: string) => {
  if (!hexColor) return '#000000';
  // Remove hash if present
  const hex = hexColor.replace('#', '');
  
  // Expand shorthand form (e.g. "03F") to full form ("0033FF")
  const fullHex = hex.length === 3 
    ? hex.split('').map(c => c + c).join('') 
    : hex;

  if (fullHex.length !== 6) return '#000000';

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  
  // Calculate YIQ ratio
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // Returns black for light backgrounds, white for dark
  return yiq >= 128 ? '#000000' : '#ffffff';
};

const isItalianHoliday = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const isSunday = date.getDay() === 0;
  
  if (isSunday) return true;

  const holidays = [
    '1-1', '6-1', '25-4', '1-5', '2-6', '15-8', '1-11', '8-12', '25-12', '26-12'
  ];
  
  return holidays.includes(`${day}-${month}`);
};

export const AssignmentsPrintLayout = () => {
  const { state } = useApp();
  const days = getMonthDays(state.currentDate);

  return (
    <div 
      className="p-6 font-sans w-full text-xs min-h-[297mm] relative flex flex-col"
      style={{ 
        width: '420mm', // A3 Landscape
        height: '297mm', 
        backgroundColor: '#1e3a8a', 
        color: 'white',
        WebkitPrintColorAdjust: 'exact', 
        printColorAdjust: 'exact',
        margin: '0 auto'
      }}
    >
      
      {/* Header */}
      <div className="flex justify-between items-end mb-6 border-b-2 border-blue-400 pb-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider mb-2">Piano Incarichi</h1>
          <h2 className="text-2xl font-light capitalize">
            {(() => {
                const d = new Date(state.currentDate);
                return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
            })()}
          </h2>
        </div>
        <div className="text-right opacity-80">
          <div className="text-xl font-bold">ShiftMaster Pro</div>
          <div className="text-sm">Gestione Assegnazione Postazioni</div>
        </div>
      </div>
      
      {/* Griglia Incarichi */}
      <div className="bg-white text-black rounded-sm overflow-hidden shadow-sm flex-1">
        <table className="w-full border-collapse border border-slate-400 h-full table-fixed">
          <thead>
            <tr className="bg-slate-100 h-10">
              <th className="border border-slate-400 p-2 w-48 text-left font-bold text-slate-800 uppercase text-[11px]">Operatore</th>
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
            {state.operators.filter(o => o.isActive).map(op => (
              <tr key={op.id}>
                <td className="border border-slate-400 p-1 pl-3 font-semibold truncate text-slate-900 text-[11px]">
                  {op.lastName} {op.firstName.charAt(0)}.
                </td>
                {days.map(d => {
                  const dateKey = formatDateKey(d);
                  
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

                  // Retrieve Assignment Data (Color)
                  const assignmentEntry = state.assignmentData[`${op.id}_${dateKey}`];
                  const assignment = assignmentEntry ? state.assignments.find(a => a.id === assignmentEntry.assignmentId) : null;
                  
                  // Retrieve Shift Data (Text)
                  const entry = getEntry(state, op.id, dateKey);
                  const matrixShift = calculateMatrixShift(op, dateKey, state.matrices);
                  const shiftCode = entry?.shiftCode || matrixShift || '';

                  const isHol = isItalianHoliday(d);
                  let bg = isHol ? '#eff6ff' : 'transparent';
                  let textColor = 'inherit';

                  if (assignment) {
                      bg = assignment.color;
                      textColor = getContrastColor(assignment.color);
                  }

                  return (
                    <td 
                      key={dateKey} 
                      className="border border-slate-400 p-0 text-center font-bold align-middle text-[10px]"
                      style={{
                          backgroundColor: bg,
                          color: textColor,
                          WebkitPrintColorAdjust: 'exact', 
                          printColorAdjust: 'exact'
                      }}
                    >
                      <span className="block w-full">{shiftCode}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Legenda Incarichi */}
      <div className="mt-6 pt-4 border-t-2 border-blue-400">
         <div className="text-center font-bold uppercase text-xs mb-3 tracking-widest opacity-80">Legenda Incarichi</div>
         <div className="flex flex-wrap justify-center gap-6">
            {state.assignments.map(a => (
                <div key={a.id} className="flex items-center gap-2">
                     <div 
                        className="w-4 h-4 rounded-sm border border-white/50 shadow-sm" 
                        style={{ 
                            backgroundColor: a.color,
                            WebkitPrintColorAdjust: 'exact', 
                            printColorAdjust: 'exact'
                        }}
                     ></div>
                     <div className="text-xs">
                         <span className="font-bold text-white">{a.code}</span>
                         <span className="text-blue-200 mx-1">-</span>
                         <span className="text-blue-100">{a.name}</span>
                     </div>
                </div>
            ))}
         </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-8 flex justify-between items-end">
         <div className="text-blue-200 italic text-xs mb-1">
            <div>Stampato il:</div>
            <div className="font-bold">{format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
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
            <div className="font-bold text-[10px] uppercase tracking-wide text-center text-slate-700">Firma Coordinatore</div>
         </div>
      </div>

    </div>
  );
};
