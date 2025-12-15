import { Pool } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Gestione preflight CORS (opzionale se gestito dal framework, ma utile per sicurezza)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    const submittedToken = authHeader ? authHeader.replace('Bearer ', '') : '';

    // Recupera le password valide dalle variabili d'ambiente.
    // Supporta APP_ACCESS_CODES (lista separata da virgole) o fallback su APP_ACCESS_CODE (singola legacy)
    const rawCodes = process.env.APP_ACCESS_CODES || process.env.APP_ACCESS_CODE || '';
    
    // Crea un array di codici validi, rimuovendo spazi bianchi
    const validCodes = rawCodes.split(',').map(c => c.trim()).filter(c => c !== '');

    // BLOCCO DI SICUREZZA:
    // 1. Se non ci sono codici configurati sul server, blocca tutto (Configurazione Errata).
    // 2. Se il token inviato non è incluso nella lista dei codici validi, blocca (Non Autorizzato).
    
    if (validCodes.length === 0) {
        console.error("SECURITY ERROR: No APP_ACCESS_CODES configured on server.");
        return new Response(JSON.stringify({ error: 'Server misconfiguration: No access codes defined.' }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }

    if (!validCodes.includes(submittedToken)) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Access Code' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (!process.env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    if (request.method === 'GET') {
        // Inizializza la tabella se non esiste (Lazy initialization)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shiftmaster_state (
                id INT PRIMARY KEY DEFAULT 1,
                data JSONB,
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT single_row CHECK (id = 1)
            );
        `);
        
        const { rows } = await pool.query('SELECT data FROM shiftmaster_state WHERE id = 1');
        const data = rows.length > 0 ? rows[0].data : {};
        
        // Chiudi pool (opzionale in serverless HTTP ma buona prassi)
        await pool.end();

        return new Response(JSON.stringify(data), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });
    } 
    
    if (request.method === 'POST') {
        const body = await request.json();
        
        // Upsert dei dati: Inserisce o Aggiorna l'unica riga con ID=1
        await pool.query(`
            INSERT INTO shiftmaster_state (id, data, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE 
            SET data = $1, updated_at = NOW()
        `, [JSON.stringify(body)]);
        
        await pool.end();

        return new Response(JSON.stringify({ success: true }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (err: any) {
      console.error("Database Error:", err);
      return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
      });
  }
}