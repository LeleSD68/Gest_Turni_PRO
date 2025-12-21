/**
 * SHIFTMASTER PRO - RICEVITORE DATI UNIVERSALE
 * Versione: 2.1
 * 
 * ISTRUZIONI PER LA DISTRIBUZIONE:
 * 1. Crea un nuovo Foglio Google.
 * 2. Clicca su "Estensioni" > "Apps Script".
 * 3. Cancella tutto il codice presente e incolla questo script.
 * 4. Clicca sull'icona del disco (Salva) e dai un nome al progetto (es. "Sync Turni").
 * 5. Clicca sul tasto blu "Distribuisci" > "Nuova distribuzione".
 * 6. Tipo: "Applicazione Web".
 * 7. Descrizione: "Integrazione ShiftMaster".
 * 8. Esegui come: "Io" (il tuo account).
 * 9. Chi ha accesso: "Chiunque" (necessario per permettere all'app di inviare dati).
 * 10. Copia l'URL dell'applicazione web e incollalo nelle Impostazioni dell'app ShiftMaster.
 */

/**
 * Funzione principale che intercetta le richieste POST inviate dall'applicazione.
 * @param {Object} e - L'evento POST contenente i dati JSON.
 */
function doPost(e) {
  try {
    // 1. Parsing dei dati in arrivo
    // L'app invia un oggetto JSON con: monthLabel, days, dayInitials, operators
    var data = JSON.parse(e.postData.contents);
    
    // 2. Riferimento al foglio attivo
    // Utilizza il foglio di calcolo dove è installato lo script
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // 3. Pulizia totale
    // Rimuove dati, formattazione, note e checkbox precedenti
    sheet.clear();
    sheet.clearFormats();
    
    // 4. SCRITTURA RIGA 1 (Mese e Numeri Giorni)
    // A1: Etichetta del mese (es. "Gennaio 2025")
    sheet.getRange(1, 1).setValue(data.monthLabel)
         .setFontWeight("bold")
         .setFontSize(14)
         .setFontColor("#1e3a8a");
    
    // C1 in poi: Numeri dei giorni (1, 2, 3...)
    if (data.days && data.days.length > 0) {
      sheet.getRange(1, 3, 1, data.days.length)
           .setValues([data.days])
           .setFontWeight("bold")
           .setHorizontalAlignment("center")
           .setBackground("#f1f5f9");
    }
    
    // 5. SCRITTURA RIGA 2 (Intestazioni Colonne e Iniziali Giorni)
    // A2: "Operatore"
    sheet.getRange(2, 1).setValue("OPERATORE")
         .setFontWeight("bold")
         .setBackground("#334155")
         .setFontColor("white");
         
    // B2: "Ore Totali"
    sheet.getRange(2, 2).setValue("ORE TOT.")
         .setFontWeight("bold")
         .setBackground("#475569")
         .setFontColor("white")
         .setHorizontalAlignment("center");
    
    // C2 in poi: Iniziali dei giorni (L, M, M, G, V, S, D)
    if (data.dayInitials && data.dayInitials.length > 0) {
      sheet.getRange(2, 3, 1, data.dayInitials.length)
           .setValues([data.dayInitials])
           .setFontWeight("bold")
           .setHorizontalAlignment("center")
           .setBackground("#e2e8f0");
    }
    
    // 6. SCRITTURA DATI OPERATORI (Dalla riga 3 in poi)
    var startRow = 3;
    data.operators.forEach(function(op, index) {
      var currentRow = startRow + index;
      
      // Colonna A: Nome e Cognome (tutto maiuscolo)
      sheet.getRange(currentRow, 1).setValue(op.name.toUpperCase())
           .setFontWeight("medium");
      
      // Colonna B: Totale ore calcolato dall'app
      sheet.getRange(currentRow, 2).setValue(op.totalHours)
           .setHorizontalAlignment("center")
           .setFontWeight("bold");
      
      // Da Colonna C: Sequenza codici turni (M8, P, N, R, etc.)
      if (op.shifts && op.shifts.length > 0) {
        sheet.getRange(currentRow, 3, 1, op.shifts.length)
             .setValues([op.shifts])
             .setHorizontalAlignment("center");
      }
    });
    
    // 7. FORMATTAZIONE ESTETICA E USABILITÀ
    var lastRow = data.operators.length + 2;
    var lastCol = data.days.length + 2;
    
    // A. Applica bordi a tutta la tabella dati
    var tableRange = sheet.getRange(1, 1, lastRow, lastCol);
    tableRange.setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
    
    // B. Alternanza colori righe (Zebra striping) per facilitare la lettura
    for (var i = 3; i <= lastRow; i++) {
      if (i % 2 == 0) {
        sheet.getRange(i, 1, 1, lastCol).setBackground("#f8fafc");
      }
    }
    
    // C. Blocco dei riquadri
    // Blocca le prime 2 righe (intestazioni) e le prime 2 colonne (nomi e ore)
    sheet.setFrozenRows(2);
    sheet.setFrozenColumns(2);
    
    // D. Ridimensionamento automatico delle colonne
    sheet.autoResizeColumns(1, lastCol);
    
    // E. Imposta larghezza minima per le colonne dei giorni (C in poi)
    // Rende il foglio più compatto e uniforme
    for (var j = 3; j <= lastCol; j++) {
      sheet.setColumnWidth(j, 35);
    }

    // 8. RITORNO RISPOSTA AL CLIENT (App)
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      message: "Foglio aggiornato: " + data.monthLabel 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    // Gestione errori: invia l'errore all'app per il debug
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}