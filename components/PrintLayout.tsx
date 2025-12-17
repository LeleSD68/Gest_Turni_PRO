import React from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed } from '../utils';
import { format } from 'date-fns';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

// Helper per festività italiane
const isItalianHoliday = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1; // 0-indexed
  const isSunday = date.getDay() === 0;
  
  if (isSunday) return true;

  // Elenco festività fisse (giorno-mese)
  const holidays = [
    '1-1',   // Capodanno
    '6-1',   // Epifania
    '25-4',  // Liberazione
    '1-5',   // Lavoro
    '2-6',   // Repubblica
    '15-8',  // Ferragosto
    '1-11',  // Ognissanti
    '8-12',  // Immacolata
    '25-12', // Natale
    '26-12'  // Santo Stefano
  ];
  
  return holidays.includes(`${day}-${month}`);
};

export const PrintLayout = () => {
  const { state } = useApp();
  const days = getMonthDays(state.currentDate);

  // Helper per estrarre l'orario dalla descrizione
  const extractTime = (name: string) => {
    const match = name.match(/\((.*?)\)/);
    return match ? match[1] : '';
  };

  return (
    <div 
      id="printable-content"
      className="p-6 font-sans w-full text-xs min-h-[297mm] relative flex flex-col"
      style={{ 
        width: '420mm', // A3 Landscape width fixed
        height: '297mm', // A3 Landscape height fixed
        backgroundColor: '#1e3a8a', // Sfondo blu scuro
        color: 'white',
        WebkitPrintColorAdjust: 'exact', 
        printColorAdjust: 'exact',
        margin: '0 auto'
      }}
    >
      
      {/* Header */}
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
      
      {/* Griglia Turni - Sfondo Bianco */}
      <div className="bg-white text-black rounded-sm overflow-hidden shadow-sm flex-1">
        <table className="w-full border-collapse border border-slate-400 h-full table-fixed">
          <thead>
            <tr className="bg-slate-100 h-10" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <th className="border border-slate-400 p-2 w-40 text-left font-bold text-slate-800 uppercase text-[11px]">Operatore</th>
              <th className="border border-slate-400 p-2 w-14 text-center font-bold text-slate-700 uppercase text-[10px] bg-slate-200" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Ore</th>
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
            {state.operators.filter(o => o.isActive).map(op => {
              // Calcolo ore totali mensili per riga stampa
              const totalMonthlyHours = days.reduce((acc, d) => {
                  const dk = formatDateKey(d);
                  if (!isOperatorEmployed(op, dk)) return acc;
                  const entry = getEntry(state, op.id, dk);
                  const matrixCode = calculateMatrixShift(op, dk, state.matrices);
                  const code = entry?.shiftCode || matrixCode || '';
                  const st = state.shiftTypes.find(s => s.code === code);
                  
                  let h = 0;
                  if (entry?.customHours !== undefined) {
                      h = entry.customHours;
                  } else if (st) {
                      if (st.inheritsHours) {
                          const mxSt = state.shiftTypes.find(s => s.code === matrixCode);
                          h = mxSt?.hours || 0;
                      } else {
                          h = st.hours;
                      }
                  }
                  return acc + h;
              }, 0);

              return (
                <tr key={op.id}>
                  <td className="border border-slate-400 p-1 pl-3 font-semibold truncate text-slate-900 text-[11px]">
                    {op.lastName} {op.firstName.charAt(0)}.
                  </td>
                  <td className="border border-slate-400 p-1 text-center font-bold text-slate-700 bg-slate-50 text-[11px]" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    {totalMonthlyHours > 0 ? Math.round(totalMonthlyHours) : '-'}
                  </td>
                  {days.map(d => {
                    const dateKey = formatDateKey(d);
                    const isHol = isItalianHoliday(d);
                    
                    // Controllo se assunto
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
                    
                    let bg = 'transparent';
                    if (shift?.color) {
                        bg = `${shift.color}60`; 
                    } else if (isHol) {
                        bg = '#eff6ff'; 
                    }

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
      
      {/* Legenda - Solo Sigla e Orario */}
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

      {/* Footer: Data e Firma */}
      <div className="mt-auto pt-8 flex justify-between items-end">
         <div className="text-blue-200 italic text-xs mb-1">
            <div>Aggiornato il:</div>
            <div className="font-bold">{format(new Date(), 'dd/MM/yyyy')} <span className="font-normal">alle</span> {format(new Date(), 'HH:mm')}</div>
         </div>
         
         {/* Riquadro Firma - SFONDO BIANCO ESPLICITO */}
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