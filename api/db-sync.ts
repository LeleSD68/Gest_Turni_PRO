import { Pool } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Gestione preflight CORS
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
    if (!process.env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Verifica Token di Sessione nel DB
    let isAuthenticated = false;
    if (token) {
        // Fallback per vecchio APP_ACCESS_CODE durante migrazione (opzionale, rimuovere per sicurezza totale)
        if (process.env.APP_ACCESS_CODE && token === process.env.APP_ACCESS_CODE) {
            isAuthenticated = true;
        } else {
            // Check tabella sessions
            // Nota: Lazy create table sessions nel caso db-sync venga chiamato prima di auth (raro ma possibile)
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
                );
            `);
            
            const { rows } = await pool.query('SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
            if (rows.length > 0) {
                isAuthenticated = true;
            }
        }
    }

    if (!isAuthenticated) {
      await pool.end();
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // --- Logica Dati (Invariata) ---

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
            headers: { 'Content-Type': 'application/json' } 
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