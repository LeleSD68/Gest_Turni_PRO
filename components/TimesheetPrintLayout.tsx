
import React, { useMemo } from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed, getShiftByCode } from '../utils';
import { format, isSameMonth } from 'date-fns';
import { Clock, AlertCircle } from 'lucide-react';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ITALIAN_DAYS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

export const TimesheetPrintLayout = ({ operatorId }: { operatorId?: string }) => {
  const { state } = useApp();
  const days = getMonthDays(state.currentDate);
  const currentMonthIdx = new Date(state.currentDate).getMonth();

  // Calcolo dei dati per il report
  const reportData = useMemo(() => {
    // Filter operators based on prop or show all active
    const activeOperators = operatorId 
        ? state.operators.filter(o => o.id === operatorId)
        : state.operators.filter(o => o.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const rows = activeOperators.map(op => {
      let monthlyExpectedHours = 0;
      let monthlyActualHours = 0;
      
      const dayData = days.map(d => {
        const dateKey = formatDateKey(d);
        const isEmployed = isOperatorEmployed(op, dateKey);
        
        if (!isEmployed) return { date: d, type: 'EMPTY' };

        // 1. Turno da Matrice (Originale)
        const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
        const matrixShift = getShiftByCode(matrixCode || '', state.shiftTypes);
        
        // 2. Turno Effettivo (Planner)
        const entry = getEntry(state, op.id, dateKey);
        const actualCode = entry?.shiftCode ?? matrixCode ?? '';
        const actualShift = getShiftByCode(actualCode, state.shiftTypes);

        // Calcolo Ore
        if (isSameMonth(d, new Date(state.currentDate))) {
            // Ore Previste (da matrice se esiste, altrimenti 0)
            if (matrixShift && matrixShift.hours > 0) monthlyExpectedHours += matrixShift.hours;

            // Ore Effettive (Base + Eventi)
            let dailyHours = entry?.customHours;
            
            // Fallback inheritance check for actual hours
            if (dailyHours === undefined) {
                 if (actualShift?.inheritsHours && matrixShift) {
                     dailyHours = matrixShift.hours;
                 } else {
                     dailyHours = actualShift?.hours ?? 0;
                 }
            }
            
            // Aggiungi/Sottrai eventi speciali
            if (entry?.specialEvents) {
                entry.specialEvents.forEach(ev => {
                    if (ev.mode === 'ADDITIVE' || !ev.mode) {
                        dailyHours += ev.hours;
                    }
                    // Se è sostitutivo, le ore base sono già state sovrascritte dal turno o customHours, 
                    // l'evento serve solo per tracciatura o se customHours è 0.
                });
            }
            monthlyActualHours += dailyHours;
        }

        // Determina se c'è variazione
        const isVariation = entry?.isManual && actualCode !== matrixCode;
        
        return {
            date: d,
            type: 'DATA',
            actualCode,
            matrixCode: isVariation ? matrixCode : null, // Mostra matrice solo se diverso
            actualColor: actualShift?.color || '#ffffff',
            entry,
            isVariation
        };
      });

      return {
        operator: op,
        days: dayData,
        stats: {
            expected: monthlyExpectedHours,
            actual: monthlyActualHours,
            diff: monthlyActualHours - monthlyExpectedHours
        }
      };
    });

    // Estrazione Variazioni e Voci Speciali per il report a piè pagina
    const specialEventsReport: any[] = [];
    
    rows.forEach(row => {
        row.days.forEach((cell: any) => {
            if (cell.type !== 'DATA') return;
            
            // Voci Speciali (Straordinari, Permessi, etc.)
            if (cell.entry?.specialEvents?.length > 0) {
                cell.entry.specialEvents.forEach((ev: any) => {
                    specialEventsReport.push({
                        opName: `${row.operator.lastName} ${row.operator.firstName}`,
                        date: cell.date,
                        type: ev.type,
                        hours: ev.hours,
                        note: cell.entry.note || '-',
                        mode: ev.mode
                    });
                });
            }
            
            // Variazioni manuali significative di orario (senza evento speciale esplicito)
            // Es. Turno cambiato da M8 a P (nessuna variazione ore, ma variazione turno) -> Opzionale mostrarlo nel report
            // Qui mostriamo solo se ci sono ore custom senza eventi speciali associati che giustifichino
            if (cell.entry?.customHours !== undefined && (!cell.entry.specialEvents || cell.entry.specialEvents.length === 0)) {
                 // Logica opzionale per tracciare cambi orario manuali
            }
        });
    });

    return { rows, specialEventsReport };
  }, [state, days, operatorId]);

  return (
    <div 
      className="p-8 font-sans w-full text-xs min-h-[297mm] flex flex-col bg-white"
      style={{ 
        width: '420mm', // A3 Landscape
        height: '297mm',
        margin: '0 auto',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact'
      }}
    >
      {/* Header Cartellino */}
      <div className="flex justify-between items-start mb-6 border-b-2 border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-slate-900 mb-1">Cartellino Presenze</h1>
          <div className="text-xl text-slate-600 font-light flex items-center gap-2">
            <span className="capitalize font-bold">{ITALIAN_MONTHS[currentMonthIdx]}</span>
            <span>{new Date(state.currentDate).getFullYear()}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Azienda / Reparto</div>
          <div className="text-lg font-bold text-slate-800">ShiftMaster Pro</div>
          <div className="text-xs text-slate-400 mt-1">Generato il {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>
      </div>

      {/* Griglia Principale */}
      <div className="border border-slate-300 rounded-sm overflow-hidden mb-6 flex-1">
          <table className="w-full border-collapse table-fixed h-full">
            <thead>
                <tr className="bg-slate-100 h-8 border-b border-slate-300">
                    <th className="w-48 text-left px-2 font-bold text-slate-700 uppercase border-r border-slate-300">Operatore</th>
                    <th className="w-16 text-center font-bold text-slate-700 uppercase border-r border-slate-300 bg-slate-200">Tot. Ore</th>
                    {days.map(d => (
                        <th key={d.toString()} className={`border-r border-slate-200 p-0.5 text-center ${d.getDay() === 0 ? 'bg-slate-200' : ''}`}>
                            <div className="text-[9px] uppercase text-slate-500">{ITALIAN_DAYS[d.getDay()]}</div>
                            <div className="font-bold text-slate-800">{d.getDate()}</div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {reportData.rows.map((row, idx) => (
                    <tr key={row.operator.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-200`}>
                        {/* Nome Operatore */}
                        <td className="border-r border-slate-300 px-2 py-1">
                            <div className="font-bold text-slate-800 truncate">{row.operator.lastName}</div>
                            <div className="text-[10px] text-slate-500 truncate">{row.operator.firstName}</div>
                        </td>

                        {/* Riepilogo Ore */}
                        <td className="border-r border-slate-300 text-center bg-slate-50">
                            <div className="font-bold text-slate-900 text-sm">{row.stats.actual.toFixed(1)}</div>
                            {row.stats.diff !== 0 && (
                                <div className={`text-[9px] font-bold ${row.stats.diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {row.stats.diff > 0 ? '+' : ''}{row.stats.diff.toFixed(1)}
                                </div>
                            )}
                        </td>

                        {/* Celle Giornaliere */}
                        {row.days.map((cell: any, i) => {
                            if (cell.type === 'EMPTY') {
                                return <td key={i} className="bg-slate-100 border-r border-slate-200"></td>;
                            }
                            
                            const isSunday = cell.date.getDay() === 0;
                            const hasSpecial = cell.entry?.specialEvents?.length > 0;
                            
                            return (
                                <td key={i} className={`border-r border-slate-200 p-0 relative align-top h-10 ${isSunday ? 'bg-slate-100' : ''}`}>
                                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                                        {/* Indicatore Evento Speciale (Angolo) */}
                                        {hasSpecial && (
                                            <div className="absolute top-0 right-0 w-2 h-2">
                                                <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-r-[8px] border-t-amber-500 border-r-transparent"></div>
                                            </div>
                                        )}

                                        {/* Turno Attuale */}
                                        <div className="font-bold text-slate-900 text-[11px] leading-tight">
                                            {cell.actualCode}
                                        </div>

                                        {/* Turno Matrice (Se diverso) */}
                                        {cell.isVariation && (
                                            <div className="text-[8px] text-slate-400 font-medium leading-none mt-0.5">
                                                ({cell.matrixCode})
                                            </div>
                                        )}
                                    </div>
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
          </table>
      </div>

      {/* Sezione Riepilogo Voci Speciali & Footer */}
      <div className="flex gap-8 h-64">
          
          {/* Tabella Voci Speciali */}
          <div className="flex-1 border border-slate-300 rounded-sm overflow-hidden flex flex-col">
              <div className="bg-slate-800 text-white px-3 py-1.5 font-bold text-xs uppercase flex justify-between items-center">
                  <span>Riepilogo Voci Speciali & Variazioni</span>
                  <AlertCircle size={14} />
              </div>
              <div className="flex-1 overflow-hidden relative">
                  {/* Header Fissi per la tabella interna */}
                  <div className="grid grid-cols-[1.5fr_0.8fr_1fr_0.5fr_2fr] bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                      <div className="p-2 border-r border-slate-200">Operatore</div>
                      <div className="p-2 border-r border-slate-200 text-center">Data</div>
                      <div className="p-2 border-r border-slate-200">Voce</div>
                      <div className="p-2 border-r border-slate-200 text-center">Ore</div>
                      <div className="p-2">Note / Motivo</div>
                  </div>
                  
                  {/* Contenuto Scrollabile (se necessario, anche se in stampa si espande) */}
                  <div className="overflow-auto h-full">
                      {reportData.specialEventsReport.length > 0 ? (
                          reportData.specialEventsReport.map((ev, idx) => (
                              <div key={idx} className="grid grid-cols-[1.5fr_0.8fr_1fr_0.5fr_2fr] border-b border-slate-100 text-[10px] items-center hover:bg-slate-50">
                                  <div className="p-1.5 px-2 font-medium text-slate-800 border-r border-slate-100 truncate">{ev.opName}</div>
                                  <div className="p-1.5 px-2 text-slate-600 text-center border-r border-slate-100 font-mono">{format(ev.date, 'dd/MM')}</div>
                                  <div className="p-1.5 px-2 text-slate-700 border-r border-slate-100 truncate font-semibold">{ev.type}</div>
                                  <div className={`p-1.5 px-2 text-center border-r border-slate-100 font-bold ${ev.hours > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                      {ev.hours !== 0 ? `${ev.hours > 0 && ev.mode === 'ADDITIVE' ? '+' : ''}${ev.hours}` : '-'}
                                  </div>
                                  <div className="p-1.5 px-2 text-slate-500 italic truncate">{ev.note}</div>
                              </div>
                          ))
                      ) : (
                          <div className="p-8 text-center text-slate-400 italic">Nessuna voce speciale registrata in questo mese.</div>
                      )}
                  </div>
              </div>
          </div>

          {/* Legenda e Firma */}
          <div className="w-64 shrink-0 flex flex-col justify-between">
             <div className="bg-slate-50 border border-slate-300 p-3 rounded-sm">
                 <h4 className="font-bold text-[10px] uppercase text-slate-500 mb-2 border-b border-slate-200 pb-1">Legenda Rapida</h4>
                 <div className="space-y-1.5 text-[10px]">
                     <div className="flex items-center gap-2">
                         <span className="font-bold text-slate-900">M8</span> <span className="text-slate-500">Mattina (8h)</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="font-bold text-slate-900">P</span> <span className="text-slate-500">Pomeriggio (7h)</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="font-bold text-slate-900">N</span> <span className="text-slate-500">Notte (9h)</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="font-bold text-slate-900">(XX)</span> <span className="text-slate-500">Turno originale</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <div className="w-0 h-0 border-t-[6px] border-r-[6px] border-t-amber-500 border-r-transparent"></div>
                         <span className="text-slate-500">Evento Speciale</span>
                     </div>
                 </div>
             </div>

             <div className="border border-slate-300 p-4 rounded-sm bg-white h-24 relative">
                 <div className="absolute top-2 left-3 text-[9px] font-bold uppercase text-slate-400">Firma Coordinatore</div>
                 <div className="absolute bottom-3 right-3 w-32 border-b border-slate-800"></div>
             </div>
          </div>

      </div>
    </div>
  );
};
