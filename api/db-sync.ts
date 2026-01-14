
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL non configurata nel server' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const sql = neon(process.env.DATABASE_URL);

    // CHECK SICUREZZA CRITICO
    if (!process.env.APP_ACCESS_CODE) {
       return new Response(JSON.stringify({ error: 'CRITICO: Variabile APP_ACCESS_CODE mancante su Vercel.' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // --- Sincronizzazione Intelligente ---
    let isAuthorized = false;

    // 1. Verifica Master Key (Accesso Diretto)
    if (token === process.env.APP_ACCESS_CODE) {
        isAuthorized = true;
    } 
    // 2. Verifica Sessione Utente (Accesso Tramite Login)
    else if (token) {
        try {
             // Verifica se il token corrisponde a una sessione attiva nel DB
             const rows = await sql(`
                SELECT username FROM sessions 
                WHERE token = $1 AND expires_at > NOW()
             `, [token]);
             
             if (rows.length > 0) {
                 isAuthorized = true;
             }
        } catch (e) {
            // Ignora errori (es. tabella non esistente), fallisce sicuro su unauthorized
            console.warn("Sync auth check failed:", e);
        }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Accesso Negato: Token Sync non valido o sessione scaduta.' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Inizializzazione Tabelle (Garantita per ogni tipo di richiesta)
    await sql(`
        CREATE TABLE IF NOT EXISTS shiftmaster_state (
            id INT PRIMARY KEY DEFAULT 1,
            data JSONB,
            updated_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT single_row CHECK (id = 1)
        );
    `);

    if (request.method === 'GET') {
        const rows = await sql('SELECT data FROM shiftmaster_state WHERE id = 1');
        const data = rows.length > 0 ? rows[0].data : {};
        
        return new Response(JSON.stringify(data), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    } 
    
    if (request.method === 'POST') {
        const body = await request.json();
        
        await sql(`
            INSERT INTO shiftmaster_state (id, data, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE 
            SET data = $1, updated_at = NOW()
        `, [JSON.stringify(body)]);
        
        return new Response(JSON.stringify({ success: true }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    return new Response(JSON.stringify({ error: 'Metodo non supportato' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
      console.error("Database API Error:", err);
      return new Response(JSON.stringify({ error: `Errore Server: ${err.message}` }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
  }
}
