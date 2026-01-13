
import React, { useState, useMemo } from 'react';
import { Card, Input, Badge } from '../components/UI';
import { Search, HelpCircle, BookOpen, Calendar, Users, Settings, ShieldCheck, Zap, MousePointer2 } from 'lucide-react';

type HelpCategory = 'TUTTI' | 'PLANNER' | 'MATRICI' | 'OPERATORI' | 'CONFIGURAZIONE' | 'ALTRO';

interface HelpItem {
  id: string;
  category: HelpCategory;
  title: string;
  content: React.ReactNode;
  keywords: string[];
}

const HELP_TOPICS: HelpItem[] = [
  // --- PLANNER ---
  {
    id: 'basic-nav',
    category: 'PLANNER',
    title: 'Come muoversi nel calendario',
    content: (
      <ul className="list-disc pl-4 space-y-1">
        <li>Usa le <strong>frecce</strong> in alto per cambiare mese.</li>
        <li>Clicca su <strong>"Oggi"</strong> per tornare al mese corrente.</li>
        <li>Usa i tasti <strong>Vista Mese / Settimana</strong> per cambiare il dettaglio di visualizzazione.</li>
      </ul>
    ),
    keywords: ['navigazione', 'mese', 'settimana', 'frecce']
  },
  {
    id: 'edit-shift',
    category: 'PLANNER',
    title: 'Inserire o Modificare un Turno',
    content: (
      <div className="space-y-2">
        <p>Hai due modi per modificare un turno:</p>
        <ol className="list-decimal pl-4 space-y-1">
          <li><strong>Modifica Rapida:</strong> Clicca una volta sulla cella. Si apre un piccolo menu per scegliere il turno.</li>
          <li><strong>Modifica Completa:</strong> Fai <strong>doppio click</strong> sulla cella. Si apre una finestra grande dove puoi inserire anche note, orari personalizzati e voci extra (straordinari, reperibilità).</li>
        </ol>
      </div>
    ),
    keywords: ['modifica', 'inserimento', 'cella', 'click', 'doppio click']
  },
  {
    id: 'delete-shift',
    category: 'PLANNER',
    title: 'Cancellare un Turno',
    content: (
      <p>Clicca sulla cella e premi il pulsante rosso <strong>"Cancella"</strong> nel menu, oppure seleziona il turno <strong>"OFF"</strong>. Puoi anche usare il tasto destro del mouse e scegliere un'opzione se disponibile.</p>
    ),
    keywords: ['cancellare', 'rimuovere', 'off', 'elimina']
  },
  {
    id: 'multi-select',
    category: 'PLANNER',
    title: 'Selezione Multipla e Azioni di Massa',
    content: (
      <div className="space-y-2">
        <p>Per modificare più giorni contemporaneamente:</p>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Tieni premuto il tasto <strong>SHIFT</strong> (Maiuscolo) sulla tastiera.</li>
          <li>Clicca sulla <strong>prima cella</strong> e poi sull'<strong>ultima cella</strong> dell'intervallo desiderato (dello stesso operatore).</li>
          <li>Apparirà un menu per copiare, incollare o assegnare lo stesso turno a tutto il periodo.</li>
        </ol>
      </div>
    ),
    keywords: ['multipla', 'selezione', 'massa', 'shift', 'copia', 'incolla']
  },
  {
    id: 'drag-drop',
    category: 'PLANNER',
    title: 'Spostare o Scambiare Turni (Drag & Drop)',
    content: (
      <p>Puoi trascinare un turno da una casella all'altra. Se trascini su una casella vuota, il turno viene <strong>spostato</strong>. Se trascini su un turno esistente, il sistema ti chiederà se vuoi fare uno <strong>scambio</strong> tra i due operatori.</p>
    ),
    keywords: ['trascinare', 'spostare', 'scambio', 'drag', 'drop']
  },

  // --- MATRICI ---
  {
    id: 'matrix-concept',
    category: 'MATRICI',
    title: 'Cosa sono le Matrici?',
    content: (
      <p>Una matrice è una <strong>sequenza fissa di turni</strong> che si ripete nel tempo (es. Mattina, Pomeriggio, Notte, Smonto, Riposo). Assegnando una matrice a un operatore, il programma calcola automaticamente i turni futuri all'infinito.</p>
    ),
    keywords: ['matrice', 'sequenza', 'ciclo', 'automatico']
  },
  {
    id: 'ghost-shifts',
    category: 'MATRICI',
    title: 'Perché vedo turni "semitrasparenti"?',
    content: (
      <div className="space-y-2">
        <p>I turni semitrasparenti (o sbiaditi) sono <strong>previsioni</strong> basate sulla matrice assegnata. Non sono ancora salvati definitivamente nel database.</p>
        <p>Questo è utile perché se cambi la matrice, tutti i turni futuri si aggiornano da soli. Per renderli definitivi ("solidi"), devi <strong>Consolidarli</strong>.</p>
      </div>
    ),
    keywords: ['trasparente', 'sbiadito', 'previsione', 'fantasma']
  },
  {
    id: 'matrix-consolidate',
    category: 'MATRICI',
    title: 'Come confermare (Consolidare) una Matrice',
    content: (
      <div className="space-y-2">
        <p>Per trasformare i turni "previsionali" in turni fissi:</p>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Usa la <strong>selezione multipla</strong> (Tasto SHIFT + Click inizio/fine periodo).</li>
          <li>Dal menu che appare, clicca su <strong>"Consolida Matrice"</strong> (icona doppia spunta).</li>
          <li>I turni diventeranno colorati pieni e saranno modificabili singolarmente senza perdere la sequenza.</li>
        </ol>
      </div>
    ),
    keywords: ['consolidare', 'confermare', 'fissare', 'salvare']
  },
  {
    id: 'apply-matrix',
    category: 'MATRICI',
    title: 'Assegnare una Matrice a un Operatore',
    content: (
      <p>Vai su <strong>Configurazione {'>'} Operatori</strong> (o doppio click sul nome nel planner). Nella sezione "Anagrafica", seleziona la matrice dal menu a tendina e scegli una <strong>Data di Inizio</strong>. La sequenza partirà da quel giorno.</p>
    ),
    keywords: ['assegnare', 'impostare', 'start', 'inizio']
  },

  // --- OPERATORI ---
  {
    id: 'add-operator',
    category: 'OPERATORI',
    title: 'Aggiungere o Modificare Operatori',
    content: (
      <p>Vai nella scheda <strong>Configurazione</strong> e seleziona "Operatori". Qui puoi aggiungere nuovi dipendenti, cambiare i nomi, o disattivarli (non cancellarli) se non lavorano più, per mantenere lo storico.</p>
    ),
    keywords: ['nuovo', 'dipendente', 'anagrafica', 'aggiungere']
  },
  {
    id: 'contracts',
    category: 'OPERATORI',
    title: 'Gestione Contratti e Scadenze',
    content: (
      <p>Clicca sul <strong>nome dell'operatore</strong> nel Planner (colonna sinistra). Nella scheda "Anagrafica" puoi aggiungere periodi di contratto. Se un giorno è fuori contratto, la casella nel planner apparirà grigia e barrata.</p>
    ),
    keywords: ['contratto', 'scadenza', 'periodo', 'grigio']
  },

  // --- CONFIGURAZIONE ---
  {
    id: 'coverage',
    category: 'CONFIGURAZIONE',
    title: 'Analisi Copertura e Fabbisogno',
    content: (
      <p>Nella scheda <strong>Copertura</strong> puoi vedere se hai abbastanza personale per ogni fascia oraria. I colori indicano lo stato: <span className="text-red-600 font-bold">Rosso</span> (Critico, mancano persone), <span className="text-amber-500 font-bold">Giallo</span> (Basso), <span className="text-emerald-600 font-bold">Verde</span> (Ottimale).</p>
    ),
    keywords: ['copertura', 'fabbisogno', 'minimi', 'staffing']
  },
  {
    id: 'shift-types',
    category: 'CONFIGURAZIONE',
    title: 'Creare nuovi Tipi di Turno',
    content: (
      <p>Vai su <strong>Configurazione {'>'} Turni</strong>. Puoi creare nuovi codici (es. M, P, N), assegnare colori, orari e definire se sono turni notturni. I codici brevi (max 3 lettere) sono consigliati per la leggibilità.</p>
    ),
    keywords: ['tipo turno', 'creare', 'nuovo turno', 'orario']
  },

  // --- ALTRO ---
  {
    id: 'print',
    category: 'ALTRO',
    title: 'Stampa dei Turni',
    content: (
      <p>Nel Planner, clicca il pulsante <strong>"Stampa"</strong> in alto a destra. Si aprirà un'anteprima ottimizzata per fogli A3/A4. Puoi scegliere tra la vista "Planner Visivo" (grafica) o "Cartellino Ore" (tabellare).</p>
    ),
    keywords: ['stampa', 'pdf', 'cartaceo', 'export']
  },
  {
    id: 'cloud-sync',
    category: 'ALTRO',
    title: 'Salvataggio Cloud e Sincronizzazione',
    content: (
      <div className="space-y-2">
        <p>I dati vengono salvati automaticamente nel browser. Per condividere i dati con altri colleghi:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Clicca su <strong>"Forza Salvataggio su Cloud"</strong> in <i>Gestione Dati</i> per inviare le tue modifiche al server.</li>
          <li>Clicca su <strong>"Forza Ripristino"</strong> per scaricare le modifiche fatte da altri.</li>
        </ul>
      </div>
    ),
    keywords: ['cloud', 'salvare', 'sync', 'condivisione', 'server']
  }
];

export const Help = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory>('TUTTI');

  const categories: HelpCategory[] = ['TUTTI', 'PLANNER', 'MATRICI', 'OPERATORI', 'CONFIGURAZIONE', 'ALTRO'];

  const filteredItems = useMemo(() => {
    return HELP_TOPICS.filter(item => {
      const matchesCategory = selectedCategory === 'TUTTI' || item.category === selectedCategory;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        searchTerm === '' || 
        item.title.toLowerCase().includes(searchLower) ||
        item.keywords.some(k => k.toLowerCase().includes(searchLower)); // Search in keywords only for better precision
        // Note: we could search in content too, but sometimes it's too noisy. 
        // Let's stick to title + keywords for clean results.

      return matchesCategory && matchesSearch;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="p-6 pb-2 shrink-0">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
                <BookOpen size={32} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Guida e Supporto</h1>
                <p className="text-slate-500 text-sm">Trova risposte rapide su come utilizzare ShiftMaster Pro al meglio.</p>
            </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="text-slate-400" size={20} />
            </div>
            <input 
                type="text" 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-sm"
                placeholder="Cerca un argomento (es. 'matrice', 'stampa', 'spostare turni')..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
                        selectedCategory === cat 
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                    {cat === 'TUTTI' ? 'Tutti gli argomenti' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-2">
          {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredItems.map(item => (
                      <Card key={item.id} className="flex flex-col h-full hover:shadow-md transition-shadow border-slate-200">
                          <div className="flex items-center justify-between mb-3">
                              <Badge color="bg-slate-100 text-slate-600 border border-slate-200">
                                  {item.category}
                              </Badge>
                              {item.category === 'PLANNER' && <Calendar size={16} className="text-blue-400" />}
                              {item.category === 'MATRICI' && <Zap size={16} className="text-amber-400" />}
                              {item.category === 'OPERATORI' && <Users size={16} className="text-emerald-400" />}
                              {item.category === 'CONFIGURAZIONE' && <Settings size={16} className="text-slate-400" />}
                          </div>
                          <h3 className="font-bold text-lg text-slate-800 mb-3 leading-tight">{item.title}</h3>
                          <div className="text-sm text-slate-600 leading-relaxed flex-1">
                              {item.content}
                          </div>
                          {/* Keywords debug or visual aid - optional */}
                          {/* <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
                              {item.keywords.map(k => <span key={k} className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">#{k}</span>)}
                          </div> */}
                      </Card>
                  ))}
              </div>
          ) : (
              <div className="text-center py-20">
                  <HelpCircle size={48} className="mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-600">Nessun risultato trovato</h3>
                  <p className="text-slate-400 text-sm">Prova a cercare con parole chiave diverse o seleziona "Tutti gli argomenti".</p>
                  <button 
                    onClick={() => { setSearchTerm(''); setSelectedCategory('TUTTI'); }}
                    className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                  >
                      Mostra tutto
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};
