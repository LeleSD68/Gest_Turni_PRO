
import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { AppState, CONSTANTS, Operator, ShiftType, Matrix, LogEntry, CallEntry, PlannerEntry, Assignment, AssignmentEntry, HistoryAwareState, DayNote } from './types';
import { format } from 'date-fns';

// --- Stato Iniziale ---
const generateDefaultContract = (id: string) => ([{ id: `c-${id}`, start: '2025-01-01' }]);

const initialState: AppState = {
  isAuthenticated: false, // Default false per richiedere login
  lastLogin: Date.now(),
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
    // Mattina (Verdi)
    { id: 'm6', code: 'M6', name: 'Mattino (08:00-14:00)', color: '#bcdfc3', hours: 6, isNight: false, isWeekend: false },
    { id: 'm7', code: 'M7', name: 'Mattina 7 ore (06:00-13:00)', color: '#d1ebbe', hours: 7, isNight: false, isWeekend: false },
    { id: 'm7p', code: 'M7-', name: 'Mattino Posticipato (07:00-13:00)', color: '#9cf7c8', hours: 6, isNight: false, isWeekend: false }, 
    { id: 'm8', code: 'M8', name: 'Mattina 8 ore (06:00-14:00)', color: '#8ece69', hours: 8, isNight: false, isWeekend: false },
    { id: 'm8p', code: 'M8-', name: 'Mattino Posticipato (07:00-14:00)', color: '#6cd578', hours: 7, isNight: false, isWeekend: false },
    { id: 'dm', code: 'DM', name: 'Mattino Lungo (08:00-15:30)', color: '#98d7ab', hours: 7.5, isNight: false, isWeekend: false },

    // Pomeriggio (Arancio/Giallo)
    { id: 'p', code: 'P', name: 'Pomeriggio (14:00-21:00)', color: '#ff9e71', hours: 7, isNight: false, isWeekend: false },
    { id: 'pp', code: 'P-', name: 'Pomeriggio ridotto (14:00-20:00)', color: '#eac28a', hours: 6, isNight: false, isWeekend: false },
    { id: 'dp', code: 'DP', name: 'Pomeriggio (14:00-21:00)', color: '#d9b34a', hours: 7, isNight: false, isWeekend: false },

    // Notte (Azzurro scuro/Grigio)
    { id: 'n', code: 'N', name: 'Notte (21:00-06:00)', color: '#83afb8', hours: 9, isNight: true, isWeekend: false },
    { id: 'sn', code: 'SN', name: 'Smonto Notte', color: '#cad6e0', hours: 0, isNight: false, isWeekend: false },

    // Assenze e Permessi
    { id: 'r', code: 'R', name: 'Riposo', color: '#ffffff', hours: 0, isNight: false, isWeekend: false },
    { id: 'ro', code: 'R.O.', name: 'Recupero Ore', color: '#cccccc', hours: 0, isNight: false, isWeekend: false },
    { id: 'rr', code: 'R.R.', name: 'Recupero Riposo', color: '#cccccc', hours: 0, isNight: false, isWeekend: false },
    { id: 'f', code: 'F', name: 'Ferie', color: '#fde68a', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'fe', code: 'FE', name: 'Ferie Estive', color: '#fbff14', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'per', code: 'PER', name: 'Permesso', color: '#eca2e8', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'ps', code: 'P.S.', name: 'Permesso Sindacale', color: '#ac8c68', hours: 0, isNight: false, isWeekend: false },
    { id: '104', code: '104', name: 'Permesso 104', color: '#cc99be', hours: 0, isNight: false, isWeekend: false, inheritsHours: true },
    { id: 'mal', code: 'MAL', name: 'Malattia', color: '#ff0000', hours: 0, isNight: false, isWeekend: false, inheritsHours: true }, // Rosso
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
      sequence: [
        'M8', 'M7', 'P', 'R',
        'M8', 'M7', 'P', 'R',
        'M8', 'P', 'N', 'SN', 'R',
        'M8', 'M7', 'P', 'R',
        'M8', 'M7', 'P', 'R',
        'M7', 'P', 'N', 'SN', 'R'
      ]
    },
    {
      id: 'm2',
      name: 'Matrice Prescrizioni',
      color: '#fef3c7', 
      sequence: [
        'DM', 'DM', 'DP', 'DP', 'R', 'R'
      ]
    },
    {
      id: 'm3',
      name: 'Matrice Gennaio',
      color: '#dcfce7', 
      sequence: [
        'M8', 'P', 'N', 'SN', 'R',
        'M8', 'M8', 'P', 'R'
      ]
    },
    {
      id: 'm4',
      name: 'Matrice Fuori Turno',
      color: '#f3e8ff', 
      sequence: [
        'M8', 'M8', 'P', 'P', 'R', 'R'
      ]
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
    ai: {
        enabled: false,
        provider: 'OLLAMA',
        baseUrl: 'http://localhost:11434',
        model: 'llama3'
    },
    googleScriptUrl: ''
  },
};

// --- Actions ---
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

// --- Reducer ---
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return { ...state, isAuthenticated: true };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false };
    case 'SET_DATE':
      return { ...state, currentDate: action.payload };
    case 'UPDATE_CELL':
      const key = `${action.payload.operatorId}_${action.payload.date}`;
      return {
        ...state,
        plannerData: { ...state.plannerData, [key]: action.payload },
      };
    case 'REMOVE_CELL': {
      const keyToRemove = `${action.payload.operatorId}_${action.payload.date}`;
      const updatedPlannerData = { ...state.plannerData };
      delete updatedPlannerData[keyToRemove];
      return {
        ...state,
        plannerData: updatedPlannerData
      };
    }
    case 'BATCH_UPDATE':
      const newPlannerData = { ...state.plannerData };
      action.payload.forEach(entry => {
        newPlannerData[`${entry.operatorId}_${entry.date}`] = entry;
      });
      return { ...state, plannerData: newPlannerData };
    case 'UPDATE_ASSIGNMENT': {
      const key = `${action.payload.operatorId}_${action.payload.date}`;
      return {
        ...state,
        assignmentData: { ...state.assignmentData, [key]: action.payload },
      };
    }
    case 'REMOVE_ASSIGNMENT': {
      const key = `${action.payload.operatorId}_${action.payload.date}`;
      const updated = { ...state.assignmentData };
      delete updated[key];
      return { ...state, assignmentData: updated };
    }
    case 'ADD_LOG':
      return { ...state, logs: [action.payload, ...state.logs] };
    case 'ADD_CALL':
      return { ...state, calls: [action.payload, ...state.calls] };
    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.payload } };
    case 'RESTORE_BACKUP': {
      const incoming = action.payload;
      return {
        ...initialState, 
        ...incoming,     
        config: {
            ...initialState.config, 
            ...(incoming.config || {}), 
            coverage: {
                ...initialState.config.coverage, 
                ...(incoming.config?.coverage || {}) 
            },
            ai: {
                ...initialState.config.ai,
                ...(incoming.config?.ai || {})
            }
        },
        operators: (incoming.operators || []).map((op, idx) => ({
            ...op,
            contracts: op.contracts || [],
            matrixHistory: op.matrixHistory || [],
            order: op.order ?? (idx + 1)
        })),
        shiftTypes: incoming.shiftTypes || initialState.shiftTypes,
        matrices: incoming.matrices || initialState.matrices,
        assignments: incoming.assignments || initialState.assignments,
        plannerData: incoming.plannerData || {},
        assignmentData: incoming.assignmentData || {},
        dayNotes: incoming.dayNotes || {}, 
        logs: incoming.logs || [],
        calls: incoming.calls || [],
        matrixSwaps: incoming.matrixSwaps || [],
        currentDate: incoming.currentDate || initialState.currentDate, 
        isAuthenticated: true 
      };
    }
    case 'ADD_OPERATOR':
      const maxOrder = Math.max(...state.operators.map(o => o.order || 0), 0);
      return { ...state, operators: [...state.operators, { ...action.payload, order: maxOrder + 1 }] };
    case 'UPDATE_OPERATOR':
      return { ...state, operators: state.operators.map(op => op.id === action.payload.id ? action.payload : op) };
    case 'DELETE_OPERATOR':
      return { ...state, operators: state.operators.filter(op => op.id !== action.payload) };
    case 'ADD_SHIFT':
      return { ...state, shiftTypes: [...state.shiftTypes, action.payload] };
    case 'UPDATE_SHIFT':
      return { ...state, shiftTypes: state.shiftTypes.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SHIFT':
      return { ...state, shiftTypes: state.shiftTypes.filter(s => s.id !== action.payload) };
    case 'ADD_MATRIX':
      return { ...state, matrices: [...state.matrices, action.payload] };
    case 'UPDATE_MATRIX':
      return { ...state, matrices: state.matrices.map(m => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_MATRIX':
      return { ...state, matrices: state.matrices.filter(m => m.id !== action.payload) };
    case 'ADD_ASSIGNMENT_TYPE':
      return { ...state, assignments: [...state.assignments, action.payload] };
    case 'UPDATE_ASSIGNMENT_TYPE':
      return { ...state, assignments: state.assignments.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'DELETE_ASSIGNMENT_TYPE':
      return { ...state, assignments: state.assignments.filter(a => a.id !== action.payload) };
    case 'UPDATE_DAY_NOTE': {
        const notes = { ...state.dayNotes };
        if (action.payload.note) {
            notes[action.payload.date] = action.payload.note;
        } else {
            delete notes[action.payload.date];
        }
        return { ...state, dayNotes: notes };
    }
    case 'REORDER_OPERATORS':
        return { ...state, operators: action.payload };
    default:
      return state;
  }
};

// --- Undoable Reducer Wrapper ---
const undoableReducer = (state: HistoryAwareState, action: Action): HistoryAwareState => {
  const { past, present, future } = state;

  if (action.type === 'UNDO') {
    if (past.length === 0) return state;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    return {
      past: newPast,
      present: previous,
      future: [present, ...future]
    };
  }

  if (action.type === 'REDO') {
    if (future.length === 0) return state;
    const next = future[0];
    const newFuture = future.slice(1);
    return {
      past: [...past, present],
      present: next,
      future: newFuture
    };
  }

  const newPresent = appReducer(present, action);
  
  if (newPresent === present) return state; 

  const isTransientAction = 
    action.type === 'SET_DATE' || 
    action.type === 'ADD_LOG' ||
    action.type === 'LOGIN_SUCCESS' ||
    action.type === 'LOGOUT'; 

  if (isTransientAction) {
    return {
      past,
      present: newPresent,
      future 
    };
  }

  if (action.type === 'RESTORE_BACKUP') {
      return {
          past: [],
          present: newPresent,
          future: []
      };
  }

  return {
    past: [...past.slice(-CONSTANTS.HISTORY_LIMIT), present],
    present: newPresent,
    future: [] 
  };
};

// --- Context ---
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  history: { canUndo: boolean; canRedo: boolean };
  syncStatus: 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR' | 'UNAUTHORIZED';
  accessCode: string;
  setAccessCode: (code: string) => void;
  checkAuth: (code: string) => Promise<boolean>;
  saveToCloud: (force?: boolean) => Promise<void>;
  syncFromCloud: (isAutoSync?: boolean) => Promise<void>;
}>({ 
    state: initialState, 
    dispatch: () => null,
    history: { canUndo: false, canRedo: false },
    syncStatus: 'IDLE',
    accessCode: '',
    setAccessCode: () => {},
    checkAuth: async () => false,
    saveToCloud: async () => {},
    syncFromCloud: async () => {}
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [historyState, dispatch] = useReducer(undoableReducer, {
    past: [],
    present: initialState,
    future: []
  });

  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR' | 'UNAUTHORIZED'>('IDLE');
  const [accessCode, setAccessCode] = useState(() => localStorage.getItem('shiftmaster_access_code') || '');

  // 1. Sync FROM Cloud Logic
  const syncFromCloud = useCallback(async (isAutoSync = false) => {
    if (!accessCode) return;

    try {
        if (!isAutoSync) setSyncStatus('SYNCING');
        const res = await fetch('/api/db-sync', {
            headers: { 'Authorization': `Bearer ${accessCode}` }
        });
        
        if (res.status === 401) {
            setSyncStatus('UNAUTHORIZED');
            return;
        }

        if (res.ok) {
            const cloudData = await res.json();
            
            if (cloudData && cloudData.plannerData) {
                const localTs = historyState.present.lastLogin;
                const cloudTs = cloudData.lastLogin || 0;

                // Always load on explicit sync (not auto) OR if cloud is strictly newer
                if (cloudTs > localTs || !isAutoSync) {
                     dispatch({ type: 'RESTORE_BACKUP', payload: cloudData });
                     if (!isAutoSync) setSyncStatus('SAVED');
                } else if (isAutoSync && localTs > cloudTs) {
                    // Local is newer, triggering save might be better, but let's let auto-save handle it
                }
            } else {
                // Primo avvio con DB vuoto o pulito
                if (!isAutoSync) setSyncStatus('IDLE');
                dispatch({ type: 'LOGIN_SUCCESS' }); 
            }
        } else {
            if (!isAutoSync) setSyncStatus('ERROR');
        }
    } catch (e) {
        console.error("Cloud sync failed", e);
        if (!isAutoSync) setSyncStatus('ERROR');
    }
  }, [accessCode, historyState.present.lastLogin]); // Added timestamp dep

  // 2. Save TO Cloud Logic
  const saveToCloud = useCallback(async (force = false) => {
      if (!accessCode) return;
      setSyncStatus('SYNCING');

      try {
          // Update timestamp to now to ensure this save wins next time
          const payload = { ...historyState.present, lastLogin: Date.now() };
          
          const res = await fetch('/api/db-sync', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessCode}`
              },
              body: JSON.stringify(payload)
          });

          if (res.status === 401) {
              setSyncStatus('UNAUTHORIZED');
              dispatch({ type: 'LOGOUT' });
          } else if (res.ok) {
              setSyncStatus('SAVED');
          } else {
              setSyncStatus('ERROR');
          }
      } catch (e) {
          console.error("Cloud save failed", e);
          setSyncStatus('ERROR');
      }
  }, [historyState.present, accessCode]);

  const checkAuth = useCallback(async (codeToVerify: string) => {
      setAccessCode(codeToVerify);
      localStorage.setItem('shiftmaster_access_code', codeToVerify);
      
      try {
          const res = await fetch('/api/db-sync', {
              headers: { 'Authorization': `Bearer ${codeToVerify}` }
          });
          
          if (res.status === 401) {
              return false;
          }
          
          // Se auth ok, scarichiamo subito i dati!
          if (res.ok) {
              const cloudData = await res.json();
              if (cloudData && cloudData.plannerData) {
                  dispatch({ type: 'RESTORE_BACKUP', payload: cloudData });
              } else {
                  dispatch({ type: 'LOGIN_SUCCESS' });
              }
              setSyncStatus('SAVED');
          } else {
              // DB Error but auth ok
              dispatch({ type: 'LOGIN_SUCCESS' });
          }
          return true;
      } catch (e) {
          console.error("Auth check failed", e);
          return false;
      }
  }, []);

  // 1. Initial Load (if code exists in localStorage)
  useEffect(() => {
      if (accessCode) {
          syncFromCloud(false);
      }
  }, [accessCode]);

  // 2. Poll for updates (Every 30s)
  useEffect(() => {
      if (!historyState.present.isAuthenticated) return;
      const intervalId = setInterval(() => {
          syncFromCloud(true);
      }, 30000); 
      return () => clearInterval(intervalId);
  }, [syncFromCloud, historyState.present.isAuthenticated]);

  // 3. Sync on Focus
  useEffect(() => {
      if (!historyState.present.isAuthenticated) return;
      const handleFocus = () => syncFromCloud(true);
      window.addEventListener("focus", handleFocus);
      return () => window.removeEventListener("focus", handleFocus);
  }, [syncFromCloud, historyState.present.isAuthenticated]);

  // 4. AUTO-SAVE: Triggered on ANY state change
  useEffect(() => {
    // Only save if authenticated and we have a valid lastLogin (prevents saving empty state over cloud state on boot)
    if (historyState.present.isAuthenticated && historyState.present.lastLogin > 0) {
      const timeoutId = setTimeout(() => {
          saveToCloud(false);
      }, 2000); // Debounce 2s

      return () => clearTimeout(timeoutId);
    }
  }, [historyState.present, saveToCloud]);

  const historyStatus = {
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0
  };

  return (
    <AppContext.Provider value={{ 
        state: historyState.present, 
        dispatch, 
        history: historyStatus, 
        syncStatus,
        accessCode,
        setAccessCode,
        checkAuth,
        saveToCloud,
        syncFromCloud
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
