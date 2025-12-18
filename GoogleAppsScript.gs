
/**
 * Script per Google Apps Script (da distribuire come Web App)
 * Istruzioni:
 * 1. Apri un Foglio Google
 * 2. Estensioni > Apps Script
 * 3. Incolla questo codice
 * 4. Distribuisci > Nuova distribuzione > Applicazione Web > Accesso: Chiunque
 * 5. Copia l'URL e incollalo nelle impostazioni di ShiftMaster Pro
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Pulisci il foglio esistente
    sheet.clear();
    
    // --- Riga 1: Mese e Numeri Giorni ---
    // Colonna A: Mese
    sheet.getRange(1, 1).setValue(data.monthLabel).setFontWeight("bold").setFontSize(12);
    
    // Da Colonna C: Numeri Giorni
    var dayNumbers = [data.days];
    sheet.getRange(1, 3, 1, data.days.length).setValues(dayNumbers).setFontWeight("bold").setHorizontalAlignment("center");
    
    // --- Riga 2: Intestazioni ---
    sheet.getRange(2, 1).setValue("Operatore").setFontWeight("bold");
    sheet.getRange(2, 2).setValue("Ore Totali").setFontWeight("bold").setHorizontalAlignment("center");
    
    // Da Colonna C: Iniziali Giorni
    var dayInitials = [data.dayInitials];
    sheet.getRange(2, 3, 1, data.dayInitials.length).setValues(dayInitials).setFontWeight("bold").setHorizontalAlignment("center");
    
    // --- Righe Operatori ---
    var startRow = 3;
    data.operators.forEach(function(op, index) {
      var currentRow = startRow + index;
      
      // Colonna A: Nome
      sheet.getRange(currentRow, 1).setValue(op.name.toUpperCase());
      
      // Colonna B: Ore Totali (Formato testo con virgola per compatibilità IT)
      sheet.getRange(currentRow, 2).setValue(op.totalHours).setHorizontalAlignment("center");
      
      // Da Colonna C: Turni
      var shifts = [op.shifts];
      sheet.getRange(currentRow, 3, 1, op.shifts.length).setValues(shifts).setHorizontalAlignment("center");
    });
    
    // --- Formattazione Finale ---
    var totalRange = sheet.getRange(1, 1, data.operators.length + 2, data.days.length + 2);
    totalRange.setBorder(true, true, true, true, true, true, "#cccccc", SpreadsheetApp.BorderStyle.SOLID);
    
    // Alternanza colori righe per leggibilità
    for (var i = 3; i <= data.operators.length + 2; i++) {
      if (i % 2 == 0) {
        sheet.getRange(i, 1, 1, data.days.length + 2).setBackground("#f8fafc");
      }
    }
    
    // Auto-ridimensionamento colonne
    sheet.autoResizeColumns(1, data.days.length + 2);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
