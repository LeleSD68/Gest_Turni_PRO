import React, { useMemo } from 'react';
import { useApp } from '../store';
import { getMonthDays, formatDateKey, getEntry, calculateMatrixShift, isOperatorEmployed, getShiftByCode } from '../utils';
import { format, isSameMonth } from 'date-fns';
import { AlertCircle } from 'lucide-react';

const ITALIAN_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const ITALIAN_DAYS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

export const TimesheetPrintLayout = () => {
  const { state } = useApp();
  const days = getMonthDays(state.currentDate);
  const currentMonthIdx = new Date(state.currentDate).getMonth();

  const reportData = useMemo(() => {
    const activeOperators = state.operators.filter(o => o.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));
    const rows = activeOperators.map(op => {
      let monthlyExpectedHours = 0;
      let monthlyActualHours = 0;
      const dayData = days.map(d => {
        const dateKey = formatDateKey(d);
        if (!isOperatorEmployed(op, dateKey)) return { date: d, type: 'EMPTY' };
        const matrixCode = calculateMatrixShift(op, dateKey, state.matrices);
        const matrixShift = getShiftByCode(matrixCode || '', state.shiftTypes);
        const entry = getEntry(state, op.id, dateKey);
        const actualCode = entry?.shiftCode ?? matrixCode ?? '';
        const actualShift = getShiftByCode(actualCode, state.shiftTypes);

        if (isSameMonth(d, new Date(state.currentDate))) {
            if (matrixShift && matrixShift.hours > 0) monthlyExpectedHours += matrixShift.hours;
            let dailyHours = entry?.customHours ?? (actualShift?.inheritsHours && matrixShift ? matrixShift.hours : (actualShift?.hours ?? 0));
            if (entry?.specialEvents) {
                entry.specialEvents.forEach(ev => { if (ev.mode === 'ADDITIVE' || !ev.mode) dailyHours += ev.hours; });
            }
            monthlyActualHours += dailyHours;
        }
        return { date: d, type: 'DATA', actualCode, matrixCode: (entry?.isManual && actualCode !== matrixCode) ? matrixCode : null, entry, isVariation: entry?.isManual && actualCode !== matrixCode };
      });
      return { operator: op, days: dayData, stats: { expected: monthlyExpectedHours, actual: monthlyActualHours, diff: monthlyActualHours - monthlyExpectedHours } };
    });

    const specialEventsReport: any[] = [];
    rows.forEach(row => {
        row.days.forEach((cell: any) => {
            if (cell.type === 'DATA' && cell.entry?.specialEvents?.length > 0) {
                cell.entry.specialEvents.forEach((ev: any) => {
                    specialEventsReport.push({ opName: `${row.operator.lastName} ${row.operator.firstName}`, date: cell.date, type: ev.type, hours: ev.hours, note: cell.entry.note || '-', mode: ev.mode });
                });
            }
        });
    });
    return { rows, specialEventsReport };
  }, [state, days]);

  return (
    <div 
      className="p-8 font-sans w-full text-xs min-h-screen flex flex-col bg-white"
      style={{ width: '420mm', margin: '0 auto' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6 border-b-4 border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-1">Cartellino Presenze Mensile</h1>
          <div className="text-2xl text-slate-600 flex items-center gap-4">
            <span className="font-black bg-slate-800 text-white px-3 py-1 rounded">{ITALIAN_MONTHS[currentMonthIdx]}</span>
            <span className="font-light">{new Date(state.currentDate).getFullYear()}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-slate-800">ShiftMaster Pro</div>
          <div className="text-sm text-slate-400">Generato il {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>
      </div>

      {/* Griglia Principale - Senza limiti di altezza */}
      <div className="border-2 border-slate-800 rounded-sm mb-8">
          <table className="w-full border-collapse table-fixed">
            <thead>
                <tr className="bg-slate-900 text-white h-10">
                    <th className="w-56 text-left px-3 font-bold uppercase border-r border-slate-700">Operatore</th>
                    <th className="w-20 text-center font-bold uppercase border-r border-slate-700 bg-slate-700">Ore</th>
                    {days.map(d => (
                        <th key={d.toString()} className={`border-r border-slate-700 p-1 text-center ${d.getDay() === 0 ? 'bg-slate-800' : ''}`}>
                            <div className="text-[10px] font-bold">{d.getDate()}</div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {reportData.rows.map((row, idx) => (
                    <tr key={row.operator.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-300 h-10`}>
                        <td className="border-r border-slate-300 px-3 font-black text-slate-800 truncate uppercase text-[11px]">
                            {row.operator.lastName}
                        </td>
                        <td className="border-r border-slate-300 text-center bg-slate-100 font-black text-sm">
                            {row.stats.actual.toFixed(1)}
                        </td>
                        {row.days.map((cell: any, i) => (
                            <td key={i} className={`border-r border-slate-200 text-center relative h-10 ${cell.date?.getDay() === 0 ? 'bg-slate-100' : ''}`}>
                                <div className="font-bold text-[11px]">{cell.actualCode}</div>
                                {cell.isVariation && <div className="text-[7px] text-slate-400 font-bold">({cell.matrixCode})</div>}
                                {cell.entry?.specialEvents?.length > 0 && <div className="absolute top-0 right-0 w-2 h-2 bg-amber-500"></div>}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
          </table>
      </div>

      {/* Report Extra & Legenda - Ora dinamico senza scroll */}
      <div className="flex gap-10 flex-grow">
          <div className="flex-grow border-2 border-slate-800 rounded-sm flex flex-col h-fit">
              <div className="bg-slate-900 text-white px-4 py-3 font-black text-sm uppercase flex justify-between items-center">
                  <span>Dettaglio Variazioni e Voci Speciali</span>
                  <AlertCircle size={18} />
              </div>
              <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_3fr] bg-slate-200 border-b-2 border-slate-800 text-[11px] font-black uppercase">
                  <div className="p-2 border-r border-slate-400">Operatore</div>
                  <div className="p-2 border-r border-slate-400 text-center">Data</div>
                  <div className="p-2 border-r border-slate-400">Tipo</div>
                  <div className="p-2 border-r border-slate-400 text-center">Ore</div>
                  <div className="p-2">Note</div>
              </div>
              <div>
                  {reportData.specialEventsReport.map((ev, idx) => (
                      <div key={idx} className="grid grid-cols-[2fr_1fr_1.5fr_1fr_3fr] border-b border-slate-300 text-[11px] hover:bg-slate-50 items-center">
                          <div className="p-2 font-bold border-r border-slate-300">{ev.opName}</div>
                          <div className="p-2 text-center border-r border-slate-300 font-mono">{format(ev.date, 'dd/MM')}</div>
                          <div className="p-2 font-black text-blue-700 border-r border-slate-300 uppercase">{ev.type}</div>
                          <div className="p-2 text-center border-r border-slate-300 font-black text-emerald-700">{ev.hours}h</div>
                          <div className="p-2 text-slate-500 italic truncate">{ev.note}</div>
                      </div>
                  ))}
                  {reportData.specialEventsReport.length === 0 && <div className="p-10 text-center text-slate-400 italic">Nessun evento registrato.</div>}
              </div>
          </div>

          <div className="w-72 flex flex-col gap-6">
              <div className="border-2 border-slate-800 p-5 rounded-sm bg-slate-50">
                  <h4 className="font-black text-sm uppercase mb-4 border-b-2 border-slate-800 pb-2">Legenda</h4>
                  <div className="space-y-3 text-[11px] font-bold">
                      <div className="flex justify-between"><span>(XX)</span> <span className="text-slate-500">Matrice Originale</span></div>
                      <div className="flex justify-between items-center"><span>Evento</span> <div className="w-3 h-3 bg-amber-500"></div></div>
                      <div className="flex justify-between"><span>MOD</span> <span className="text-blue-600">Manuale</span></div>
                  </div>
              </div>
              <div className="border-2 border-slate-800 p-6 rounded-sm bg-white flex-grow relative min-h-[150px]">
                  <span className="text-[10px] font-black uppercase text-slate-400">Firma Coordinatore</span>
                  <div className="absolute bottom-6 left-6 right-6 border-b-2 border-slate-900"></div>
              </div>
          </div>
      </div>
    </div>
  );
};