
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
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    if (!process.env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL non configurata nel server' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // CHECK SICUREZZA CRITICO
    if (!process.env.APP_ACCESS_CODE) {
       // Impedisce l'avvio se la variabile d'ambiente non è settata in Vercel
       return new Response(JSON.stringify({ error: 'CRITICO: Variabile APP_ACCESS_CODE mancante su Vercel.' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Verifica token rigorosa
    if (!token || token !== process.env.APP_ACCESS_CODE) {
      return new Response(JSON.stringify({ error: 'Accesso Negato: Token Sync non valido.' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Inizializzazione Tabelle (Garantita per ogni tipo di richiesta)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shiftmaster_state (
            id INT PRIMARY KEY DEFAULT 1,
            data JSONB,
            updated_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT single_row CHECK (id = 1)
        );
    `);

    if (request.method === 'GET') {
        const { rows } = await pool.query('SELECT data FROM shiftmaster_state WHERE id = 1');
        const data = rows.length > 0 ? rows[0].data : {};
        
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
  } finally {
      // In Edge runtime pool.end() non è sempre necessario o può causare problemi se fatto prematuramente
      // ma con @neondatabase/serverless è buona norma se non si usa una connessione persistente
      await pool.end().catch(() => {});
  }
}
