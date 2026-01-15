
export enum ViewMode {
  PLANNER = 'PLANNER',
  MATRIX = 'MATRIX',
}

export type DayNoteType = 'INFO' | 'ALERT' | 'EVENT' | 'MEETING' | 'HOLIDAY' | 'CHECK';

export interface DayNote {
  text: string;
  type: DayNoteType;
}

export interface ShiftType {
  id: string;
  code: string; // M, P, N
  name: string;
  color: string; // Hex color
  hours: number;
  isNight: boolean;
  isWeekend: boolean;
  inheritsHours?: boolean;
}

export interface Contract {
  id: string;
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD, undefined means indefinite
}

export interface MatrixAssignment {
  id: string;
  matrixId: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface Operator {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  notes: string;
  order?: number; // New field for manual sorting
  
  // Matrix History Logic
  matrixHistory: MatrixAssignment[];

  // Deprecated fields (kept for backward compatibility during migration)
  matrixId?: string;
  matrixStartDate?: string;
  startDate?: string;
  endDate?: string;
  
  contracts?: Contract[];
  leaveOfAbsence?: { start: string; end: string }[];
}

export interface Matrix {
  id: string;
  name: string;
  color?: string;
  sequence: string[]; // Array of Shift Codes
}

export interface SpecialEvent {
  id: string;
  type: string; // Straordinario, Rientro, Permesso, Gettone, etc.
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  mode?: 'ADDITIVE' | 'SUBSTITUTIVE' | 'SUBTRACTIVE'; // Defines if hours add to total or replace existing time
}

export interface PlannerEntry {
  operatorId: string;
  date: string; // YYYY-MM-DD
  shiftCode: string;
  note?: string;
  isManual: boolean;
  violation?: string;
  customHours?: number;
  variationReason?: string;
  specialEvents?: SpecialEvent[];
}

export interface Assignment {
  id: string;
  code: string; // e.g., "Rubino"
  name: string; // e.g., "5° Unità Saletta"
  color: string;
}

export interface AssignmentEntry {
  operatorId: string;
  date: string;
  assignmentId: string;
}

export interface MatrixSwap {
  id: string;
  operatorA: string;
  operatorB: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  operatorId: string;
  actionType: 'UPDATE' | 'SWAP' | 'EMERGENCY' | 'EXTRA' | 'CALL';
  oldValue?: string;
  newValue?: string;
  reason?: string;
  user: string;
  targetDate?: string;
}

export interface CallEntry {
  id: string;
  date: string; // YYYY-MM-DD
  shiftCode: string;
  callerId: string; // Operator requesting
  targetId: string; // Operator called
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  timestamp: number;
}

export interface CoverageConfig {
  [shiftCode: string]: {
    min: number;
    optimal: number;
    mode?: 'SUM' | 'EXCLUDE' | 'VISUAL'; // New field for calculation mode
  };
}

export interface AIConfig {
  enabled: boolean;
  provider: 'OLLAMA' | 'OTHER';
  baseUrl: string; // e.g. http://localhost:11434 or https://xxxx.ngrok.app
  model: string; // e.g. llama3
}

export interface AppState {
  isAuthenticated: boolean;
  currentUser?: { username: string; role: string }; // Track currently logged in user
  lastLogin: number;
  dataRevision: number; // Incrementing counter for data versioning
  currentDate: string; // YYYY-MM-01
  operators: Operator[];
  shiftTypes: ShiftType[];
  specialEventTypes: string[]; // NEW: Configurable Special Event Types
  matrices: Matrix[];
  assignments: Assignment[];
  plannerData: Record<string, PlannerEntry>; // key: operatorId_date
  assignmentData: Record<string, AssignmentEntry>; // key: operatorId_date
  dayNotes: Record<string, string | DayNote>; // key: date (YYYY-MM-DD), value: note content
  logs: LogEntry[];
  calls: CallEntry[];
  matrixSwaps: MatrixSwap[];
  config: {
    minRestHours: number;
    maxConsecutiveDays: number;
    coverage: CoverageConfig;
    ai: AIConfig;
    googleScriptUrl?: string; // NEW: URL for Google Apps Script Web App
  };
}

// Extension for History Management
export interface HistoryAwareState {
  past: AppState[];
  present: AppState;
  future: AppState[];
}

export const CONSTANTS = {
  STORAGE_KEY: 'shiftmaster_v1',
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours
  HISTORY_LIMIT: 50
};
