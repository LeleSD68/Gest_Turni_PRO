
import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { AppState, CONSTANTS, Operator, ShiftType, Matrix, LogEntry, CallEntry, PlannerEntry, Assignment, AssignmentEntry, HistoryAwareState, DayNote } from './types';
import { format } from 'date-fns';

// --- Stato Iniziale ---
const generateDefaultContract = (id: string) => ([{ id: `c-${id}`, start: '2025-01-01' }]);

const initialState: AppState = {
  isAuthenticated: false, // Accesso protetto di default
  lastLogin: Date.now(),
  dataRevision: 0,
  currentDate: format(new Date(), 'yyyy-MM-01'),
  operators: [
    { id: '1', firstName: 'Lara', lastName: 'BUZZARELLO', isActive: true, notes: '', contracts: generateDefaultContract('1'), matrixHistory: [], order: 1 },
    { id: '2', firstName: 'Alessandra', lastName: 'CERESER', isActive: true, notes: '', contracts: generateDefaultContract('2'), matrixHistory: [], order: 2 },
    { id: '3', firstName: 'Lorena', lastName: 'BOSCOLO', isActive: true, notes: '', contracts: generateDefaultContract('3'), matrixHistory: [], order: 3 },
    { id: '4', firstName: 'Giuliana', lastName: 'LUCCHESE', isActive: true, notes: '', contracts: generateDefaultContract('4'), matrixHistory: [], order: 4 },
    { id: '5', firstName: 'Manuela', lastName: 'DALLA BELLA', isActive: true, notes: '', contracts: generateDefaultContract('5'), matrixHistory: [], order: 5 },
    { id: '6', firstName: 'Carmen', lastName: 'BEJENARU', isActive: true, notes: '', contracts: generateDefaultContract('6'), matrixHistory: [], order: 6 },
    { id: '7', firstName: 'Milena', lastName: 'CANAVESI', isActive: true, notes: '', contracts: generateDefaultContract('7'), matrixHistory: [], order: 7 },
    { id: '8', firstName: 'Emanuela', lastName: 'BOZZA', isActive: true, notes: '', contracts: generateDefaultContract('8'), matrixHistory: [], order: 8 },
    { id: '9', firstName: 'Pasquale', lastName: 'DE ANGELIS', isActive: true, notes: '', contracts: generateDefaultContract('9'), matrixHistory: [], order: 9 },
    { id: '10', firstName: 'Lorena', lastName: 'BARBETTA', isActive: true, notes: '', contracts: generateDefaultContract('10'), matrixHistory: [], order: 10 },
    { id: '11', firstName: 'Chiara', lastName: 'SARDO', isActive: true, notes: '', contracts: generateDefaultContract('11'), matrixHistory: [], order: 11 },
    { id: '12', firstName: 'Fabio', lastName: 'ZUCCHERI', isActive: true, notes: '', contracts: generateDefaultContract('12'), matrixHistory: [], order: 12 },
    { id: '13', firstName: 'Sonia', lastName: 'MARTINAZZI', isActive: true, notes: '', contracts: generateDefaultContract('13'), matrixHistory: [], order: 13 },
    { id: '14', firstName: 'Valentina', lastName: 'DONA\'', isActive: true, notes: '', contracts: generateDefaultContract('14'), matrixHistory: [], order: 14 },
    { id: '15', firstName: 'Paola', lastName: 'BORTOLOT', isActive: true, notes: '', contracts: generateDefaultContract('15'), matrixHistory: [], order: 15 },
    { id: '16', firstName: 'Genny', lastName: 'MORETTO', isActive: true, notes: '', contracts: generateDefaultContract('16'), matrixHistory: [], order: 16 },
    { id: '17', firstName: 'Patrick', lastName: 'FURLAN', isActive: true, notes: '', contracts: generateDefaultContract('17'), matrixHistory: [], order: 17 },
    { id: '18', firstName: 'Raffaella', lastName: 'MOCELLIN', isActive: true, notes: '', contracts: generateDefaultContract('18'), matrixHistory: [], order: 18 },
    { id: '19', firstName: 'Andrea', lastName: 'DE MARTIN', isActive: true, notes: '', contracts: generateDefaultContract('19'), matrixHistory: [], order: 19 },
    { id: '20', firstName: '-', lastName: 'OULY', isActive: true, notes: '', contracts: generateDefaultContract('20'), matrixHistory: [], order: 20 },
    { id: '21', firstName: 'Daniela', lastName: 'GRECO', isActive: true, notes: '', contracts: generateDefaultContract('21'), matrixHistory: [], order: 21 },
  ],
  shiftTypes: [
    { id: 'm6', code: 'M6', name: 'Mattino (08:00-14:00)', color: '#bcdfc3', hours: 6, isNight: false, isWeekend: false },
    { id: 'm7', code: 'M7', name: 'Mattina 7 ore (06:00-13:00)', color: '#d1ebbe', hours: 7, isNight: false, isWeekend: false },
    { id: 'm7p', code: 'M7-', name: 'Mattino Posticipato (07:00-13:00)', color: '#9cf7c8', hours: 6, isNight: false, isWeekend: false }, 
    { id: 'm8', code: 'M8', name: 'Mattina 8 ore (06:00-14:00)', color: '#8ece69', hours: 8, isNight: false, isWeekend: false },
    { id: 'm8p', code: 'M8-', name: 'Mattino Posticipato (07:00-14:00)', color: '#6cd578', hours: 7, isNight: false, isWeekend: false },
    { id: 'dm', code: 'DM', name: 'Mattino Lungo (08:00-15:30)', color: '#98d7ab', hours: 7.5, isNight: false, isWeekend: false },
    { id: 'p', code: 'P', name: 'Pomeriggio (14:00-21:00)', color: '#ff9e71', hours: 7, isNight: false, isWeekend: false },
    { id: 'pp', code: 'P-', name: 'Pomeriggio ridotto (14:00-20:00)', color: '#eac28a', hours: 6, isNight: false, isWeekend: false },
    { id: 'dp', code: 'DP', name: 'Pomeriggio (14:00-21:00)', color: '#d9b34a', hours: 7, isNight: false, isWeekend: false },
    { id: 'n', code: 'N', name: 'Notte (21:00-06:00)', color: '#83afb8', hours: 9, isNight: true, isWeekend: false },
    { id: 'sn', code: 'SN', name: 'Smonto Notte', color: '#cad6e0', hours: 0, isNight: false, isWeekend: false },
    { id: 'r', code: 'R', name: 'Riposo', color: '#ffffff', hours: 0, isNight: false, isWeekend: false },
    { id: 'ro', code: 'R.O.', name: 'Recupero Ore', color: '#cccccc', hours: 0, isNight: false, isWeekend: false },
    { id: 'rr', code: 'R.R.', name: 'Recupero Riposo', color: '#cccccc', hours: 0, isNight: false, isWeekend: false },
    { id: 'f', code: 'F', name: 'Ferie', color: '#fde68a', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'fe', code: 'FE', name: 'Ferie Estive', color: '#fbff14', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'per', code: 'PER', name: 'Permesso', color: '#eca2e8', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'ps', code: 'P.S.', name: 'Permesso Sindacale', color: '#ac8c68', hours: 0, isNight: false, isWeekend: false },
    { id: '104', code: '104', name: 'Permesso 104', color: '#cc99be', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'mal', code: 'MAL', name: 'Malattia', color: '#ff0000', hours: 0, isNight: false, isWeekend: false, inheritsHours: true }, 
    { id: 'a', code: 'A', name: 'Assenza', color: '#827d7d', hours: 0, isNight: false, isWeekend: false }
  ],
  assignments: [
    { id: 'rubino', code: 'Rubino', name: '5° Unità Saletta', color: '#ef4444' },
    { id: 'turchese', code: 'Turchese', name: '3° Unità Saletta', color: '#06b6d4' },
    { id: 'ambra', code: 'Ambra', name: 'Piano terra 16-17', color: '#f59e0b' },
  ],
  matrices: [
    {
      id: 'm1',
      name: 'Matrice Standard',
      color: '#e0f2fe', 
      sequence: ['M8', 'M7', 'P', 'R', 'M8', 'M7', 'P', 'R', 'M8', 'P', 'N', 'SN', 'R', 'M8', 'M7', 'P', 'R', 'M8', 'M7', 'P', 'R', 'M7', 'P', 'N', 'SN', 'R']
    },
    {
      id: 'm2',
      name: 'Matrice Prescrizioni',
      color: '#fef3c7', 
      sequence: ['DM', 'DM', 'DP', 'DP', 'R', 'R']
    },
    {
      id: 'm3',
      name: 'Matrice Gennaio',
      color: '#dcfce7', 
      sequence: ['M8', 'P', 'N', 'SN', 'R', 'M8', 'M8', 'P', 'R']
    },
    {
      id: 'm4',
      name: 'Matrice Fuori Turno',
      color: '#f3e8ff', 
      sequence: ['M8', 'M8', 'P', 'P', 'R', 'R']
    }
  ],
  plannerData: {},
  assignmentData: {},
  dayNotes: {}, 
  logs: [],
  calls: [],
  matrixSwaps: [],
  config: {
    minRestHours: 11,
    maxConsecutiveDays: 6,
    coverage: {
      'M8': { min: 2, optimal: 3 },
      'P': { min: 2, optimal: 3 },
      'N': { min: 1, optimal: 2 },
    },
    ai: { enabled: false, provider: 'OLLAMA', baseUrl: 'http://localhost:11434', model: 'llama3' },
    googleScriptUrl: ''
  },
};

type Action =
  | { type: 'SET_DATE'; payload: string }
  | { type: 'UPDATE_CELL'; payload: PlannerEntry }
  | { type: 'REMOVE_CELL'; payload: { operatorId: string; date: string } }
  | { type: 'BATCH_UPDATE'; payload: PlannerEntry[] }
  | { type: 'UPDATE_ASSIGNMENT'; payload: AssignmentEntry }
  | { type: 'REMOVE_ASSIGNMENT'; payload: { operatorId: string; date: string } }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'ADD_CALL'; payload: CallEntry }
  | { type: 'UPDATE_CONFIG'; payload: Partial<AppState['config']> }
  | { type: 'RESTORE_BACKUP'; payload: AppState }
  | { type: 'ADD_OPERATOR'; payload: Operator }
  | { type: 'UPDATE_OPERATOR'; payload: Operator }
  | { type: 'DELETE_OPERATOR'; payload: string }
  | { type: 'ADD_SHIFT'; payload: ShiftType }
  | { type: 'UPDATE_SHIFT'; payload: ShiftType }
  | { type: 'DELETE_SHIFT'; payload: string }
  | { type: 'ADD_MATRIX'; payload: Matrix }
  | { type: 'UPDATE_MATRIX'; payload: Matrix }
  | { type: 'DELETE_MATRIX'; payload: string }
  | { type: 'ADD_ASSIGNMENT_TYPE'; payload: Assignment }
  | { type: 'UPDATE_ASSIGNMENT_TYPE'; payload: Assignment }
  | { type: 'DELETE_ASSIGNMENT_TYPE'; payload: string }
  | { type: 'UPDATE_DAY_NOTE'; payload: { date: string; note: string | DayNote } }
  | { type: 'REORDER_OPERATORS'; payload: Operator[] }
  | { type: 'LOGIN_SUCCESS' }
  | { type: 'LOGOUT' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'LOGIN_SUCCESS': return { ...state, isAuthenticated: true };
    case 'LOGOUT': {
      localStorage.removeItem('sm_token');
      return { ...state, isAuthenticated: false };
    }
    case 'SET_DATE': return { ...state, currentDate: action.payload };
    case 'UPDATE_CELL': {
      const key = `${action.payload.operatorId}_${action.payload.date}`;
      return { ...state, plannerData: { ...state.plannerData, [key]: action.payload } };
    }
    case 'REMOVE_CELL': {
      const keyToRemove = `${action.payload.operatorId}_${action.payload.date}`;
      const updatedPlannerData = { ...state.plannerData };
      delete updatedPlannerData[keyToRemove];
      return { ...state, plannerData: updatedPlannerData };
    }
    case 'BATCH_UPDATE': {
      const newPlannerData = { ...state.plannerData };
      action.payload.forEach(entry => { newPlannerData[`${entry.operatorId}_${entry.date}`] = entry; });
      return { ...state, plannerData: newPlannerData };
    }
    case 'UPDATE_ASSIGNMENT': {
      const key = `${action.payload.operatorId}_${action.payload.date}`;
      return { ...state, assignmentData: { ...state.assignmentData, [key]: action.payload } };
    }
    case 'REMOVE_ASSIGNMENT': {
      const key = `${action.payload.operatorId}_${action.payload.date}`;
      const updated = { ...state.assignmentData };
      delete updated[key];
      return { ...state, assignmentData: updated };
    }
    case 'ADD_LOG': return { ...state, logs: [action.payload, ...state.logs] };
    case 'UPDATE_CONFIG': return { ...state, config: { ...state.config, ...action.payload } };
    case 'RESTORE_BACKUP': {
      const incoming = action.payload;
      return {
        ...initialState, ...incoming, isAuthenticated: true,
        operators: (incoming.operators || []).map(op => ({ ...op, contracts: op.contracts || [], matrixHistory: op.matrixHistory || [] }))
      };
    }
    case 'ADD_OPERATOR': return { ...state, operators: [...state.operators, action.payload] };
    case 'UPDATE_OPERATOR': return { ...state, operators: state.operators.map(op => op.id === action.payload.id ? action.payload : op) };
    case 'DELETE_OPERATOR': return { ...state, operators: state.operators.filter(op => op.id !== action.payload) };
    case 'UPDATE_DAY_NOTE': return { ...state, dayNotes: { ...state.dayNotes, [action.payload.date]: action.payload.note } };
    case 'REORDER_OPERATORS': return { ...state, operators: action.payload };
    default: return state;
  }
};

const historyReducer = (state: HistoryAwareState, action: Action): HistoryAwareState => {
  const { past, present, future } = state;
  if (action.type === 'UNDO' && past.length > 0) {
    const prev = past[past.length - 1];
    return { past: past.slice(0, -1), present: prev, future: [present, ...future] };
  }
  if (action.type === 'REDO' && future.length > 0) {
    const next = future[0];
    return { past: [...past, present], present: next, future: future.slice(1) };
  }
  const isHistoryAction = !['SET_DATE', 'LOGIN_SUCCESS', 'LOGOUT', 'RESTORE_BACKUP'].includes(action.type);
  if (!isHistoryAction) {
    const newPresent = appReducer(present, action);
    if (action.type === 'RESTORE_BACKUP') return { past: [], present: newPresent, future: [] };
    return { ...state, present: newPresent };
  }
  const newPresent = appReducer(present, action);
  if (newPresent === present) return state;
  const nextPresent = { ...newPresent, dataRevision: (present.dataRevision || 0) + 1 };
  return { past: [...past, present].slice(-CONSTANTS.HISTORY_LIMIT), present: nextPresent, future: [] };
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  history: { canUndo: boolean; canRedo: boolean };
  saveToCloud: (force?: boolean) => Promise<void>;
  syncFromCloud: (force?: boolean) => Promise<void>;
  syncStatus: 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR';
  syncErrorMessage: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loadInitialState = (): HistoryAwareState => {
    try {
      const stored = localStorage.getItem(CONSTANTS.STORAGE_KEY);
      const token = localStorage.getItem('sm_token');
      if (stored) {
        const merged = { ...initialState, ...JSON.parse(stored) };
        // Se c'è un token, proviamo a considerarlo autenticato (verrà validato dalla prima sync)
        merged.isAuthenticated = !!token;
        merged.operators = merged.operators.map((op: any) => ({ ...op, matrixHistory: op.matrixHistory || [], contracts: op.contracts || [] }));
        return { past: [], present: merged, future: [] };
      }
    } catch (e) {}
    return { past: [], present: initialState, future: [] };
  };

  const [historyState, dispatch] = useReducer(historyReducer, undefined, loadInitialState);
  const state = historyState.present;
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR'>('IDLE');
  const [syncErrorMessage, setSyncErrorMessage] = useState('');

  useEffect(() => { 
    if (state.isAuthenticated) {
        localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(state)); 
    }
  }, [state]);

  const saveToCloud = async (force = false) => {
    if (!state.isAuthenticated) return;
    setSyncStatus('SYNCING');
    setSyncErrorMessage('');
    try {
      const token = localStorage.getItem('sm_token') || '';
      const response = await fetch('/api/db-sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(state),
      });
      
      if (!response.ok) {
         if (response.status === 401) {
             dispatch({ type: 'LOGOUT' });
             throw new Error('Sessione scaduta');
         }
         const errData = await response.json().catch(() => ({}));
         throw new Error(errData.error || `Errore HTTP ${response.status}`);
      }
      
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e: any) {
      console.error("Cloud Save Error:", e);
      setSyncStatus('ERROR');
      setSyncErrorMessage(e.message || 'Errore di rete');
    }
  };

  const syncFromCloud = useCallback(async (force = false) => {
    const token = localStorage.getItem('sm_token');
    if (!token) return;

    setSyncStatus('SYNCING');
    setSyncErrorMessage('');
    try {
      const response = await fetch('/api/db-sync', { 
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
          if (response.status === 401) {
              dispatch({ type: 'LOGOUT' });
              return;
          }
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Errore HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data && Object.keys(data).length > 0) {
        if (force || (data.dataRevision || 0) > (state.dataRevision || 0)) {
          dispatch({ type: 'RESTORE_BACKUP', payload: data });
          dispatch({ type: 'LOGIN_SUCCESS' });
        }
      }
      setSyncStatus('IDLE');
    } catch (e: any) {
      console.error("Cloud Sync Error:", e);
      setSyncStatus('ERROR');
      setSyncErrorMessage(e.message || 'Errore di rete');
    }
  }, [state.dataRevision]);

  // Sincronizzazione automatica all'avvio se c'è un token
  useEffect(() => {
    const token = localStorage.getItem('sm_token');
    if (token) syncFromCloud(true);
  }, []); 

  return (
    <AppContext.Provider value={{ 
        state, 
        dispatch, 
        history: { canUndo: historyState.past.length > 0, canRedo: historyState.future.length > 0 }, 
        saveToCloud, 
        syncFromCloud, 
        syncStatus,
        syncErrorMessage 
    }}>
        {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
