
import React, { useRef, useState, useMemo } from 'react';
import { useApp } from '../store';
import { Button, Card, Modal, Badge } from '../components/UI';
import { Download, Upload, AlertTriangle, CheckCircle, Calendar, Users, FileJson, RefreshCw, ListFilter, ArrowRightLeft, ShieldCheck, FileCheck, Settings, X, Database, CloudUpload, CloudDownload } from 'lucide-react';
import { AppState, PlannerEntry, SpecialEvent, CONSTANTS, Operator } from '../types';
import { format, isValid } from 'date-fns';
import { calculateMatrixShift, getShiftByCode, parseISO } from '../utils';

// Tipo per il report
type ImportReport = {
    status: 'SUCCESS';
    mode: 'FULL' | 'PARTIAL';
    operatorsAdded: number;
    operatorsUpdated: number;
    shiftsImported: Record<string, number>; // Chiave: "YYYY-MM", Valore: count
    configUpdated: boolean;
};

export const DataManagement = () => {
    const { state, dispatch, saveToCloud, syncFromCloud, syncStatus } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [showConfirmReset, setShowConfirmReset] = useState(false);

    // --- Staging State for Import Analysis ---
    const [stagedData, setStagedData] = useState<AppState | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    
    // Import Configuration State
    const [importMode, setImportMode] = useState<'FULL' | 'PARTIAL'>('PARTIAL');
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // Format: "YYYY-MM"
    const [mergeStrategy, setMergeStrategy] = useState<'REPLACE_MONTH' | 'MERGE_CELLS'>('MERGE_CELLS');
    const [importOperators, setImportOperators] = useState(false);
    const [importConfig, setImportConfig] = useState(false);

    // Report State
    const [importReport, setImportReport] = useState<ImportReport | null>(null);

    const handleExport = () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `shiftmaster_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const processImportFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                
                // Basic Validation
                if (!json.plannerData && !json.operators) {
                    throw new Error("Formato file non riconosciuto");
                }

                // Process Legacy Data if needed
                let processedState = json;
                if (json.plannerData && !json.operators && !json.config) {
                     processedState = migrateLegacyData(json, state);
                } else {
                    processedState = validateImportedData(json);
                }

                setStagedData(processedState);
                
                // Pre-select months present in the file
                const months = extractAvailableMonths(processedState.plannerData);
                setSelectedMonths(months);
                
                setShowImportModal(true);
                setImportStatus(null);
                setImportReport(null); // Reset previous report
                
                // Reset form defaults
                setImportMode('PARTIAL');
                setMergeStrategy('MERGE_CELLS');
                setImportOperators(false); 
                setImportConfig(false);

            } catch (err) {
                console.error(err);
                setImportStatus({ type: 'error', message: 'Errore durante la lettura del file. Formato non valido.' });
            }
        };
        reader.readAsText(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processImportFile(file);
        e.target.value = '';
    };

    // --- Core Merge Logic ---
    const executeImport = () => {
        if (!stagedData) return;

        let finalState: AppState = { ...state }; // Clone current state
        
        // Report Counters
        let opsAdded = 0;
        let opsUpdated = 0;
        let shiftsCounts: Record<string, number> = {};
        let configUpd = false;

        if (importMode === 'FULL') {
            // Full Replace
            finalState = { ...stagedData };
            finalState.isAuthenticated = true; // Ensure auth persistence
            
            // Calculate pseudo-stats for report
            opsUpdated = finalState.operators.length;
            shiftsCounts = extractShiftsCountByMonth(finalState.plannerData);
            configUpd = true;

        } else {
            // --- PARTIAL MERGE LOGIC ---

            // 1. Merge Operators (Optional)
            if (importOperators) {
                const mergedOps = [...finalState.operators];
                stagedData.operators.forEach(stagedOp => {
                    const idx = mergedOps.findIndex(o => o.id === stagedOp.id);
                    if (idx >= 0) {
                        mergedOps[idx] = stagedOp; // Update
                        opsUpdated++;
                    } else {
                        mergedOps.push(stagedOp); // Add
                        opsAdded++;
                    }
                });
                finalState.operators = mergedOps;
            }

            // 2. Merge Configuration (Optional)
            if (importConfig && stagedData.config) {
                finalState.config = { ...finalState.config, ...stagedData.config };
                finalState.shiftTypes = stagedData.shiftTypes || finalState.shiftTypes;
                finalState.matrices = stagedData.matrices || finalState.matrices;
                configUpd = true;
            }

            // 3. Merge Planner Data
            const newPlannerData = { ...finalState.plannerData };
            
            // Strategy A: REPLACE_MONTH
            if (mergeStrategy === 'REPLACE_MONTH') {
                Object.keys(newPlannerData).forEach(key => {
                    const entry = newPlannerData[key];
                    const monthKey = entry.date.substring(0, 7); // "YYYY-MM"
                    if (selectedMonths.includes(monthKey)) {
                        delete newPlannerData[key];
                    }
                });
            }

            // Now insert/merge from staged data
            Object.keys(stagedData.plannerData).forEach(key => {
                const entry = stagedData.plannerData[key];
                const monthKey = entry.date.substring(0, 7); // "YYYY-MM"

                if (selectedMonths.includes(monthKey)) {
                    newPlannerData[key] = entry;
                    
                    // Update report count
                    shiftsCounts[monthKey] = (shiftsCounts[monthKey] || 0) + 1;
                }
            });

            finalState.plannerData = newPlannerData;
        }

        // CRITICAL: Update timestamp to NOW to prevent older cloud data from overwriting this import
        finalState.lastLogin = Date.now();

        dispatch({ type: 'RESTORE_BACKUP', payload: finalState });
        
        // Genera Report
        const report: ImportReport = {
            status: 'SUCCESS',
            mode: importMode,
            operatorsAdded: opsAdded,
            operatorsUpdated: opsUpdated,
            shiftsImported: shiftsCounts,
            configUpdated: configUpd
        };

        setImportReport(report);
        setImportStatus({ type: 'success', message: 'Importazione completata con successo!' });
        // Don't close modal yet, show report
    };

    const closeImportModal = () => {
        setShowImportModal(false);
        setStagedData(null);
        setImportReport(null);
    };

    const handleReset = () => {
        localStorage.removeItem(CONSTANTS.STORAGE_KEY);
        window.location.reload();
    };

    // Helper to extract unique months from planner data
    const availableMonths = useMemo(() => {
        if (!stagedData) return [];
        return extractAvailableMonths(stagedData.plannerData);
    }, [stagedData]);

    const toggleMonth = (m: string) => {
        if (selectedMonths.includes(m)) {
            setSelectedMonths(selectedMonths.filter(x => x !== m));
        } else {
            setSelectedMonths([...selectedMonths, m]);
        }
    };

    return (
        <div className="p-6 h-full overflow-y-auto bg-slate-50">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Gestione Dati</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                
                {/* Cloud Sync Manual Control */}
                <Card title="Sincronizzazione Cloud Database" className="md:col-span-2 border-blue-200">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <Database size={24} className="text-blue-600" />
                            <div className="text-sm text-blue-900 flex-1">
                                <p className="font-bold">Stato Connessione: {syncStatus}</p>
                                <p className="text-xs opacity-80">Ultimo aggiornamento locale: {format(new Date(state.lastLogin), 'dd/MM/yyyy HH:mm:ss')}</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <Button 
                                onClick={() => saveToCloud(true)} 
                                className="flex-1 flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={syncStatus === 'SYNCING'}
                            >
                                <CloudUpload size={18} /> Forza Salvataggio su Cloud
                            </Button>
                            <Button 
                                onClick={() => syncFromCloud(false)} 
                                variant="secondary"
                                className="flex-1 flex justify-center items-center gap-2"
                                disabled={syncStatus === 'SYNCING'}
                            >
                                <CloudDownload size={18} /> Forza Ripristino da Cloud
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 italic text-center">
                            Usa "Forza Salvataggio" se hai importato dati e vuoi sovrascrivere il database. 
                            Usa "Forza Ripristino" se vuoi scartare le modifiche locali e ricaricare dal server.
                        </p>
                    </div>
                </Card>

                <Card title="Esporta File Locale">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Scarica un backup completo di tutti i dati attuali (operatori, turni, configurazioni) in formato JSON.
                        </p>
                        <Button onClick={handleExport} className="w-full flex justify-center items-center gap-2">
                            <Download size={18} /> Scarica Backup
                        </Button>
                    </div>
                </Card>

                <Card title="Importa File Locale">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Carica un file di backup. Potrai scegliere <strong>cosa importare</strong> nel passaggio successivo.
                        </p>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept=".json" 
                            className="hidden" 
                        />
                        <Button variant="secondary" onClick={handleImportClick} className="w-full flex justify-center items-center gap-2">
                            <Upload size={18} /> Seleziona File...
                        </Button>
                        
                        {importStatus && (
                            <div className={`p-3 rounded text-sm flex items-center gap-2 ${importStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {importStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                {importStatus.message}
                            </div>
                        )}
                    </div>
                </Card>

                <Card title="Zona Pericolo" className="border-red-200 md:col-span-2">
                     <div className="flex items-center justify-between">
                         <div className="text-sm text-slate-600">
                             <h4 className="font-bold text-red-700 flex items-center gap-2 mb-1">
                                 <AlertTriangle size={16} /> Reset Totale
                             </h4>
                             Cancella tutti i dati salvati localmente e ripristina l'applicazione allo stato iniziale.
                         </div>
                         <Button variant="danger" onClick={() => setShowConfirmReset(true)}>
                             Reset App
                         </Button>
                     </div>
                </Card>
            </div>

            {/* IMPORT PREVIEW MODAL */}
            <Modal isOpen={showImportModal} onClose={closeImportModal} title={importReport ? "Riepilogo Importazione" : "Opzioni di Importazione"} className="max-w-2xl">
                {importReport ? (
                    // --- REPORT VIEW ---
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-full text-green-600">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-green-800 text-lg">Importazione Completata!</h3>
                                <p className="text-green-700 text-sm">I dati sono stati aggiornati correttamente nel sistema.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Operators Stats */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <Users size={18} className="text-blue-500" /> Operatori
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Nuovi Aggiunti:</span>
                                        <Badge color={importReport.operatorsAdded > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                                            +{importReport.operatorsAdded}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Aggiornati:</span>
                                        <Badge color={importReport.operatorsUpdated > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}>
                                            {importReport.operatorsUpdated}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Config Stats */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <Settings size={18} className="text-amber-500" /> Configurazione
                                </h4>
                                <div className="text-sm text-slate-600">
                                    {importReport.configUpdated ? (
                                        <div className="flex items-center gap-2 text-emerald-600 font-medium">
                                            <CheckCircle size={14} /> Regole, Turni e Matrici aggiornati
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 italic">Nessuna modifica alla configurazione</span>
                                    )}
                                </div>
                                <div className="mt-3 text-xs text-slate-400">
                                    Modalità: <span className="font-mono bg-slate-100 px-1 rounded">{importReport.mode === 'FULL' ? 'RIPRISTINO TOTALE' : 'MERGE PARZIALE'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Shifts Details */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                             <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <Calendar size={18} className="text-indigo-500" /> Dettaglio Turni Importati
                             </h4>
                             {Object.keys(importReport.shiftsImported).length > 0 ? (
                                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                     {Object.entries(importReport.shiftsImported).sort().reverse().map(([month, count]) => (
                                         <div key={month} className="bg-white p-2 rounded border border-slate-200 flex justify-between items-center shadow-sm">
                                             <span className="text-xs font-bold text-slate-600 uppercase">
                                                 {format(parseISO(`${month}-01`), 'MMM yyyy')}
                                             </span>
                                             <Badge color="bg-indigo-100 text-indigo-700">{count}</Badge>
                                         </div>
                                     ))}
                                 </div>
                             ) : (
                                 <div className="text-sm text-slate-400 italic text-center py-2">
                                     Nessun turno importato.
                                 </div>
                             )}
                        </div>

                        <div className="flex justify-end">
                            <Button variant="primary" onClick={closeImportModal} className="w-full md:w-auto">
                                Chiudi e Torna all'App
                            </Button>
                        </div>
                    </div>
                ) : stagedData && (
                    // --- CONFIGURATION VIEW ---
                    <div className="space-y-6">
                        {/* Summary Header */}
                        <div className="bg-slate-100 p-4 rounded-lg flex gap-6 text-sm text-slate-600 border border-slate-200">
                            <div className="flex items-center gap-2">
                                <FileJson size={18} className="text-blue-600"/>
                                <span>Turni nel file: <strong>{Object.keys(stagedData.plannerData).length}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users size={18} className="text-blue-600"/>
                                <span>Operatori: <strong>{stagedData.operators.length}</strong></span>
                            </div>
                        </div>

                        {/* Mode Selection */}
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                             <button 
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${importMode === 'PARTIAL' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setImportMode('PARTIAL')}
                             >
                                 Importazione Selettiva
                             </button>
                             <button 
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${importMode === 'FULL' ? 'bg-red-50 shadow text-red-700 ring-1 ring-red-200' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setImportMode('FULL')}
                             >
                                 Ripristino Totale (Sovrascrivi Tutto)
                             </button>
                        </div>

                        {importMode === 'PARTIAL' ? (
                            <div className="space-y-5 animate-in fade-in">
                                {/* Month Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                        <Calendar size={14} /> Seleziona Mesi da Importare
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                                        {availableMonths.map(m => (
                                            <button
                                                key={m}
                                                onClick={() => toggleMonth(m)}
                                                className={`px-3 py-2 rounded border text-sm font-medium transition-all ${selectedMonths.includes(m) ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {format(parseISO(`${m}-01`), 'MMM yyyy')}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedMonths.length === 0 && <p className="text-xs text-red-500 mt-1">Seleziona almeno un mese.</p>}
                                </div>

                                {/* Merge Strategy */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="border rounded-lg p-3 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setMergeStrategy('MERGE_CELLS')}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <input type="radio" checked={mergeStrategy === 'MERGE_CELLS'} onChange={() => setMergeStrategy('MERGE_CELLS')} className="text-blue-600" />
                                            <span className="font-bold text-slate-700 text-sm">Unisci & Aggiorna</span>
                                        </div>
                                        <p className="text-xs text-slate-500 pl-6">
                                            Importa solo i turni presenti nel file. I turni già presenti nell'app ma assenti nel file <strong>verranno mantenuti</strong>.
                                        </p>
                                    </div>

                                    <div className="border rounded-lg p-3 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setMergeStrategy('REPLACE_MONTH')}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <input type="radio" checked={mergeStrategy === 'REPLACE_MONTH'} onChange={() => setMergeStrategy('REPLACE_MONTH')} className="text-blue-600" />
                                            <span className="font-bold text-slate-700 text-sm">Sostituisci Mese</span>
                                        </div>
                                        <p className="text-xs text-slate-500 pl-6">
                                            Cancella tutto il mese nell'app e lo sostituisce interamente con quello del file.
                                        </p>
                                    </div>
                                </div>

                                {/* Additional Options */}
                                <div className="space-y-2 pt-2 border-t">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={importOperators} onChange={(e) => setImportOperators(e.target.checked)} className="rounded text-blue-600" />
                                        <span className="text-sm text-slate-700">Aggiorna anche Anagrafica Operatori</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={importConfig} onChange={(e) => setImportConfig(e.target.checked)} className="rounded text-blue-600" />
                                        <span className="text-sm text-slate-700">Importa Configurazioni (Tipi Turno, Matrici)</span>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-red-50 p-4 rounded border border-red-200 text-red-800 text-sm">
                                <div className="font-bold flex items-center gap-2 mb-2"><AlertTriangle size={16}/> Attenzione</div>
                                Questa operazione cancellerà <strong>tutti</strong> i dati attuali (turni, operatori, impostazioni) e li sostituirà con quelli del file di backup. L'operazione non è reversibile.
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="ghost" onClick={closeImportModal}>Annulla</Button>
                            <Button 
                                variant={importMode === 'FULL' ? 'danger' : 'primary'} 
                                onClick={executeImport}
                                disabled={importMode === 'PARTIAL' && selectedMonths.length === 0}
                            >
                                {importMode === 'FULL' ? 'Esegui Ripristino Totale' : 'Importa Dati Selezionati'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirm Reset Modal */}
            <Modal isOpen={showConfirmReset} onClose={() => setShowConfirmReset(false)} title="Conferma Reset">
                <div className="space-y-4">
                    <p className="text-slate-700">Sei sicuro di voler cancellare tutti i dati? L'operazione non può essere annullata.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowConfirmReset(false)}>Annulla</Button>
                        <Button variant="danger" onClick={handleReset}>Conferma e Ricarica</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// Helper to extract unique months from planner data
const extractAvailableMonths = (plannerData: Record<string, PlannerEntry>): string[] => {
    const months = new Set<string>();
    Object.values(plannerData).forEach(entry => {
        if (entry.date && entry.date.length >= 7) {
            months.add(entry.date.substring(0, 7)); // YYYY-MM
        }
    });
    return Array.from(months).sort().reverse();
};

const extractShiftsCountByMonth = (plannerData: Record<string, PlannerEntry>): Record<string, number> => {
    const counts: Record<string, number> = {};
    Object.values(plannerData).forEach(entry => {
        if (entry.date && entry.date.length >= 7) {
            const m = entry.date.substring(0, 7);
            counts[m] = (counts[m] || 0) + 1;
        }
    });
    return counts;
};

// Helper to validate and recalculate inherited hours on import
const validateImportedData = (json: AppState): AppState => {
    // We clone to avoid mutation
    const validatedState = { ...json };
    
    // Ensure shiftTypes and matrices are available
    if (!validatedState.shiftTypes || !validatedState.matrices || !validatedState.plannerData) return validatedState;

    Object.keys(validatedState.plannerData).forEach(key => {
        const entry = validatedState.plannerData[key];
        const shiftType = validatedState.shiftTypes.find(s => s.code === entry.shiftCode);
        
        // If shift inherits hours and customHours is NOT set (or 0), try to recalculate from matrix
        if (shiftType?.inheritsHours && !entry.customHours) {
            const operator = validatedState.operators.find(o => o.id === entry.operatorId);
            if (operator) {
                const matrixCode = calculateMatrixShift(operator, entry.date, validatedState.matrices);
                const matrixShift = validatedState.shiftTypes.find(s => s.code === matrixCode);
                
                if (matrixShift && matrixShift.hours > 0) {
                    // Update the entry with correct calculated hours
                    validatedState.plannerData[key] = {
                        ...entry,
                        customHours: matrixShift.hours
                    };
                }
            }
        }
    });

    return validatedState;
};

// Logic reconstructed for legacy migration with corrected Month (+1) and Operator-Day parsing
const migrateLegacyData = (legacyData: any, currentState: AppState): AppState => {
    const newState: AppState = { ...currentState };
    const newPlannerData: Record<string, PlannerEntry> = {};

    // 1. Import Operators FIRST to map IDs correctly
    if (legacyData.operatori && Array.isArray(legacyData.operatori)) {
        newState.operators = legacyData.operatori.map((op: any) => ({
             id: String(op.id), // Ensure string ID
             firstName: op.nome || op.firstName || '',
             lastName: op.cognome || op.lastName || '',
             isActive: op.isActive !== undefined ? op.isActive : true,
             notes: '',
             matrixId: op.idMatrice || (op.customMatrix ? String(op.customMatrix.matrixId) : undefined),
             matrixStartDate: op.baseStartDate || (op.customMatrix ? op.customMatrix.startDate : undefined),
             matrixHistory: op.customMatrix ? [
                 // Convert legacy customMatrix format to new history format if needed
                 {
                     id: crypto.randomUUID(),
                     matrixId: String(op.customMatrix.matrixId),
                     startDate: op.customMatrix.startDate || '2025-01-01',
                     endDate: undefined
                 }
             ] : [],
             contracts: [{ id: 'c1', start: op.dataInizio || '2024-01-01', end: op.dataFine }],
             order: op.ordine || 999
        }));
    } else if (legacyData.operators && Array.isArray(legacyData.operators)) {
         newState.operators = legacyData.operators.map((op: any) => ({
             id: String(op.id),
             firstName: op.firstName,
             lastName: op.lastName,
             isActive: op.isActive,
             notes: op.notes || '',
             matrixHistory: op.matrixHistory || [],
             contracts: op.contracts || [],
             order: op.order || 999
         }));
    }

    // 2. Import Planner Data
    if (legacyData.plannerData) {
        Object.keys(legacyData.plannerData).forEach(yearMonthKey => {
            // Key format example: "2025-11" (Dec) -> 0-based month in legacy file
            const parts = yearMonthKey.split('-');
            const year = parts[0];
            const monthIdxStr = parts[1];
            
            if (!year || !monthIdxStr) return;

            // FIX: Convert 0-based month to 1-based padded string (e.g. 11 (Dec) -> 12)
            // Legacy "2025-11" -> App "2025-12"
            const monthIndex = parseInt(monthIdxStr, 10);
            const paddedMonth = String(monthIndex + 1).padStart(2, '0');
            
            const monthData = legacyData.plannerData[yearMonthKey];
            
            Object.keys(monthData).forEach(opDayKey => {
                // Key format: "operatorId-day" (e.g. "1-5" or "12345-25")
                // Parsing strategy: Last part is day, Rest is OperatorID
                const lastDashIndex = opDayKey.lastIndexOf('-');
                if (lastDashIndex === -1) return;

                const operatorId = opDayKey.substring(0, lastDashIndex);
                const dayRaw = opDayKey.substring(lastDashIndex + 1);
                const day = dayRaw.padStart(2, '0');
                
                const dateStr = `${year}-${paddedMonth}-${day}`;
                const cellData = monthData[opDayKey];
                
                if (cellData.turno) {
                    const entryKey = `${operatorId}_${dateStr}`;
                    
                    const specialEvents: SpecialEvent[] = [];

                    if (cellData.extraInfo) {
                        if (cellData.extraInfo.hours !== 0 && cellData.extraInfo.hours !== undefined) {
                             specialEvents.push({
                                 id: crypto.randomUUID(),
                                 type: cellData.extraInfo.type || 'Extra',
                                 hours: cellData.extraInfo.hours,
                                 mode: 'ADDITIVE',
                                 startTime: cellData.extraInfo.startTime || '',
                                 endTime: cellData.extraInfo.endTime || ''
                             });
                        }
                    }

                    // --- INHERITANCE RECALCULATION START ---
                    let calculatedHours = undefined;
                    const shiftCode = cellData.turno;
                    const shiftType = newState.shiftTypes.find(s => s.code === shiftCode);
                    
                    // If inherits hours, calculate from matrix
                    if (shiftType?.inheritsHours) {
                        const operator = newState.operators.find(o => o.id === operatorId);
                        if (operator) {
                             // Use the NEW calculateMatrixShift with the parsed operator state
                             const matrixCode = calculateMatrixShift(operator, dateStr, newState.matrices);
                             const matrixShift = newState.shiftTypes.find(s => s.code === matrixCode);
                             if (matrixShift && matrixShift.hours > 0) {
                                 calculatedHours = matrixShift.hours;
                             }
                        }
                    }
                    // --- INHERITANCE RECALCULATION END ---

                    newPlannerData[entryKey] = {
                        operatorId: operatorId,
                        date: dateStr,
                        shiftCode: cellData.turno,
                        note: cellData.nota,
                        isManual: cellData.isManuallySet || false,
                        violation: (cellData.violations && cellData.violations.length > 0) ? cellData.violations[0] : undefined,
                        variationReason: cellData.changeReason ? 'Variazione' : undefined,
                        customHours: calculatedHours, // Use calculated if inherited
                        specialEvents: specialEvents.length > 0 ? specialEvents : undefined
                    };
                }
            });
        });
    }

    // Import Matrices if available
    if (legacyData.matrici && Array.isArray(legacyData.matrici)) {
         newState.matrices = legacyData.matrici.map((m: any) => ({
             id: String(m.id),
             name: m.nome,
             color: m.colore,
             sequence: m.sequenza || []
         }));
    }

    newState.plannerData = newPlannerData;
    return newState;
};
