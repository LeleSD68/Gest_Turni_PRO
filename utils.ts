import { format, addDays, differenceInDays, getDaysInMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { AppState, Operator, PlannerEntry, ShiftType, Matrix } from './types';

// --- Date Helpers ---

// Polyfills for missing date-fns exports
export const parseISO = (dateString: string): Date => {
  if (!dateString) return new Date();
  try {
    const parts = dateString.split('-');
    if (parts.length < 3) return new Date();
    const [year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return new Date();
    return date;
  } catch (e) {
    return new Date();
  }
};

const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const subDays = (date: Date, amount: number): Date => {
  return addDays(date, -amount);
};

export const getMonthDays = (currentDateISO: string) => {
  let date = parseISO(currentDateISO);
  if (isNaN(date.getTime())) {
    date = new Date();
  }
  const start = startOfMonth(date);
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end });
};

export const formatDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

// --- Holiday Logic ---

const getEasterDate = (year: number): Date => {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);

  return new Date(year, month - 1, day);
};

export const getItalianHolidayName = (date: Date): string | null => {
  const day = date.getDate();
  const month = date.getMonth() + 1; // 1-indexed
  const year = date.getFullYear();
  const key = `${day}-${month}`;

  // Festività Fisse
  const fixedHolidays: Record<string, string> = {
    '1-1': 'Capodanno',
    '6-1': 'Epifania',
    '25-4': 'Liberazione',
    '1-5': 'Festa del Lavoro',
    '2-6': 'Festa della Repubblica',
    '15-8': 'Ferragosto',
    '1-11': 'Ognissanti',
    '8-12': 'Immacolata',
    '25-12': 'Natale',
    '26-12': 'Santo Stefano'
  };

  if (fixedHolidays[key]) return fixedHolidays[key];

  // Festività Mobili (Pasqua e Pasquetta)
  const easter = getEasterDate(year);
  const easterMonday = addDays(easter, 1);

  if (date.getDate() === easter.getDate() && date.getMonth() === easter.getMonth()) return 'Pasqua';
  if (date.getDate() === easterMonday.getDate() && date.getMonth() === easterMonday.getMonth()) return 'Pasquetta';

  // Patrono (Esempio: San Marco per Venezia 25 Aprile, Sant'Ambrogio Milano 7 Dicembre)
  // Qui potresti aggiungere logica custom se l'utente potesse configurare il patrono
  
  return null;
};

export const isItalianHoliday = (date: Date): boolean => {
  return !!getItalianHolidayName(date) || date.getDay() === 0; // Festivo o Domenica
};


// --- Logic Helpers ---

// Check if an operator is effectively employed on a specific date based on contracts
export const isOperatorEmployed = (operator: Operator, dateStr: string): boolean => {
  // Legacy support or fallback if no contracts defined (treat as always active or use legacy dates)
  if (!operator.contracts || operator.contracts.length === 0) {
      if (operator.startDate) {
          if (dateStr < operator.startDate) return false;
      }
      if (operator.endDate) {
          if (dateStr > operator.endDate) return false;
      }
      return true;
  }

  // Check against contracts list
  return operator.contracts.some(contract => {
      if (dateStr < contract.start) return false;
      if (contract.end && dateStr > contract.end) return false;
      return true;
  });
};

export const getEntry = (state: AppState, operatorId: string, dateStr: string): PlannerEntry | null => {
  return state.plannerData[`${operatorId}_${dateStr}`] || null;
};

export const getShiftByCode = (code: string, shifts: ShiftType[]) => {
  return shifts.find(s => s.code === code);
};

// Calculate matrix shift for a given date
export const calculateMatrixShift = (operator: Operator, dateStr: string, matrices: Matrix[]): string | null => {
  // First check employment
  if (!isOperatorEmployed(operator, dateStr)) return null;

  let activeAssignment = null;

  // New History Logic
  if (operator.matrixHistory && operator.matrixHistory.length > 0) {
    // Sort history by startDate descending to find the relevant one efficiently
    // or just iterate. We need the one where startDate <= dateStr AND (endDate >= dateStr or endDate is null)
    activeAssignment = operator.matrixHistory.find(assignment => {
        if (dateStr < assignment.startDate) return false;
        if (assignment.endDate && dateStr > assignment.endDate) return false;
        return true;
    });
  } 
  
  // Fallback to legacy fields if no history found (migration support)
  if (!activeAssignment && operator.matrixId && operator.matrixStartDate) {
      // Create a temporary object for logic
      activeAssignment = {
          id: 'legacy',
          matrixId: operator.matrixId,
          startDate: operator.matrixStartDate,
          endDate: undefined
      };
      // Ensure date validity for legacy
      if (dateStr < activeAssignment.startDate) return null;
  }

  if (!activeAssignment) return null;
  
  const matrix = matrices.find(m => m.id === activeAssignment.matrixId);
  if (!matrix || matrix.sequence.length === 0) return null;

  const start = parseISO(activeAssignment.startDate);
  const target = parseISO(dateStr);
  const diff = differenceInDays(target, start);

  if (diff < 0) return null;

  const index = diff % matrix.sequence.length;
  return matrix.sequence[index];
};

// --- Validation Engine ---

// Helper to get start/end hours for validation
// Returns hour as integer (0-23). Returns null if unknown or rest.
const getShiftTimes = (code: string): { start: number, end: number } | null => {
  const c = code.toUpperCase();
  // Mapping based on provided descriptions
  switch (c) {
    case 'M6': return { start: 8, end: 14 };
    case 'M7': return { start: 6, end: 13 };
    case 'M7-': return { start: 7, end: 13 }; // Posticipato
    case 'M8': return { start: 6, end: 14 };
    case 'M8-': return { start: 7, end: 14 }; // Posticipato
    case 'DM': return { start: 8, end: 15.5 }; // 15:30 treated as 15.5 for check? Use 16 for safety or floor. Let's use 15.
    case 'P': return { start: 14, end: 21 };
    case 'P-': return { start: 14, end: 20 }; // Ridotto
    case 'DP': return { start: 14, end: 21 };
    case 'N': return { start: 21, end: 6 }; // Ends next day
    // Non-working or undefined times
    case 'R': case 'F': case 'FE': case 'A': case '104': case 'P.S.': case 'PER':
      return null; 
    default:
      return null;
  }
};

export const validateCell = (
  state: AppState,
  operatorId: string,
  dateStr: string,
  newShiftCode: string
): string | null => {
  // 1. Min Rest Check (11 Hours Rule)
  if (!newShiftCode) return null; // Rest day
  
  const currentTimes = getShiftTimes(newShiftCode);
  
  // Check PREVIOUS day
  const prevDate = subDays(parseISO(dateStr), 1);
  const prevDateStr = formatDateKey(prevDate);
  const prevEntry = getEntry(state, operatorId, prevDateStr);
  
  // Note: We can't easily check matrix of prev day here without more context or refetching. 
  // Assuming 'prevEntry' is sufficient for manual changes, but ideally we should check matrix too if no manual entry.
  // For robustness, let's try to get the effective shift of prev day.
  let prevShiftCode = prevEntry?.shiftCode;
  if (!prevShiftCode) {
     const op = state.operators.find(o => o.id === operatorId);
     if (op) {
         prevShiftCode = calculateMatrixShift(op, prevDateStr, state.matrices) || '';
     }
  }

  if (prevShiftCode && currentTimes) {
    const prevTimes = getShiftTimes(prevShiftCode);
    
    if (prevTimes) {
      // Calculate Rest Hours
      let restHours = 0;
      
      if (prevTimes.start > prevTimes.end) {
          // Previous was Night shift (e.g. 21:00 to 06:00 next day)
          // The 'end' is actually on the *current* day.
          // So rest is simply currentStart - prevEnd.
          // e.g., N (ends 06:00) -> P (starts 14:00). Gap = 14 - 6 = 8 hours. Wait, N ends at 06:00 current day.
          
          // HOWEVER, the standard rule usually implies Night is validated against NEXT day. 
          // Here we are validating CURRENT day vs PREVIOUS day.
          // If Prev was N (21-06), it ends at 06:00 on current day.
          // If Current is M8 (06-14), gap is 0.
          // If Current is P (14-21), gap is 14 - 6 = 8 hours. (Violation < 11).
          
          // Correct logic for night ending on current day:
          restHours = currentTimes.start - prevTimes.end;
      } else {
          // Previous was Day shift (e.g. P 14:00-21:00)
          // Ends at 21:00 on prev day.
          // Rest = (24 - prevEnd) + currentStart
          restHours = (24 - prevTimes.end) + currentTimes.start;
      }

      if (restHours < 11) {
        // Specific suggestion logic requested by user
        if (prevShiftCode === 'P' && (newShiftCode === 'M8' || newShiftCode === 'M7' || newShiftCode === 'M6')) {
             return `Riposo ${restHours}h insufficiente (<11h). Dopo P usa M7- o M8-`;
        }
        return `Riposo insufficiente: ${restHours}h (Min 11h)`;
      }
    }
  }
  
  // 2. Consecutive Days Check
  // Logic updated: Only count consecutive WORKING days. 
  // Absences (F, MAL, etc.) should break the streak and not trigger the warning themselves.
  
  // Check if the NEW shift being assigned is a working shift
  const newShiftType = state.shiftTypes.find(s => s.code === newShiftCode);
  
  // Only proceed if the new shift is a working shift (hours > 0)
  if (newShiftType && newShiftType.hours > 0) {
      let consecutiveCount = 0;
      for (let i = 1; i <= state.config.maxConsecutiveDays; i++) {
        const d = subDays(parseISO(dateStr), i);
        const dateKey = formatDateKey(d);
        
        // Get effective shift
        const e = getEntry(state, operatorId, dateKey);
        let sCode = e?.shiftCode;
        if (!sCode) {
             const op = state.operators.find(o => o.id === operatorId);
             if (op) sCode = calculateMatrixShift(op, dateKey, state.matrices) || '';
        }

        if (sCode) {
            // Find shift definition to check if it's a working shift
            const sType = state.shiftTypes.find(s => s.code === sCode);
            
            // Only increment if it is a working shift (hours > 0)
            // This treats 'F', 'MAL', 'R', etc. (hours=0) as breaks in the consecutive chain
            if (sType && sType.hours > 0) {
                consecutiveCount++;
            } else {
                break; // Break the streak on non-working day
            }
        } else {
            break; // Break on empty/unknown
        }
      }
      
      if (consecutiveCount >= state.config.maxConsecutiveDays) {
        return `Limite ${state.config.maxConsecutiveDays} gg lavorativi consecutivi superato`;
      }
  }

  return null;
};

// --- Suggestion Engine ---

export const getSuggestions = (state: AppState, dateStr: string, requiredShiftCode: string) => {
  const suggestions: { operator: Operator; score: number; reasons: string[] }[] = [];

  state.operators.forEach(op => {
    if (!op.isActive) return;
    if (!isOperatorEmployed(op, dateStr)) return;

    let score = 100;
    const reasons: string[] = [];

    // Check availability
    const existingEntry = getEntry(state, op.id, dateStr);
    let currentCode = existingEntry?.shiftCode;
    if (!currentCode) {
         currentCode = calculateMatrixShift(op, dateStr, state.matrices) || '';
    }

    if (currentCode && currentCode !== 'R') {
      score = -999; // Already working
      reasons.push("Già in turno");
    } else {
      score += 50;
      reasons.push("Libero");
    }

    // Check violations
    const violation = validateCell(state, op.id, dateStr, requiredShiftCode);
    if (violation) {
      score -= 100;
      reasons.push("Violazione riposo");
    }

    // Check total hours balance (Mock logic: prefer those with fewer hours)
    // In real app, calculate actual hours
    const randomBalanceFactor = Math.random() * 20; 
    score += randomBalanceFactor;

    if (score > 0) {
      suggestions.push({ operator: op, score: Math.round(score), reasons });
    }
  });

  return suggestions.sort((a, b) => b.score - a.score);
};