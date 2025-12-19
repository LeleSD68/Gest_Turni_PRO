
import { Pool } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(request: Request) {
  // Gestione preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL non configurata nel server' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Verifica Autorizzazione
    let isAuthenticated = false;
    
    // Se non c'è una master key impostata, permettiamo l'accesso (setup iniziale)
    if (!process.env.APP_ACCESS_CODE) {
        isAuthenticated = true;
    } else if (token && token === process.env.APP_ACCESS_CODE) {
        isAuthenticated = true;
    } else if (token) {
        // Verifica se è un token di sessione valido
        const { rows } = await pool.query('SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
        if (rows.length > 0) {
            isAuthenticated = true;
        }
    }

    if (!isAuthenticated) {
      await pool.end();
      return new Response(JSON.stringify({ error: 'Accesso Cloud negato: Codice non valido o mancante' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Inizializzazione Tabelle se non esistono
    if (request.method === 'GET') {
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
        
        await pool.end();
        return new Response(JSON.stringify(data), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    } 
    
    if (request.method === 'POST') {
        const body = await request.json();
        
        await pool.query(`
            INSERT INTO shiftmaster_state (id, data, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE 
            SET data = $1, updated_at = NOW()
        `, [JSON.stringify(body)]);
        
        await pool.end();
        return new Response(JSON.stringify({ success: true }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (err: any) {
      console.error("Database Error:", err);
      return new Response(JSON.stringify({ error: `Errore Database: ${err.message}` }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
  }
}
