
import { Pool } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!process.env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database non configurato nel Cloud. Usa il codice Master.' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Fix: Use type assertion for Pool as the inferred types in this environment incorrectly expect 0 arguments and lack standard methods.
  const pool = new (Pool as any)({ connectionString: process.env.DATABASE_URL }) as any;

  try {
    const { action, username, password, newPassword } = await request.json();

    // Inizializzazione rapida tabelle
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
      );
    `);

    // Admin di default
    const { rows: usersCount } = await pool.query('SELECT count(*) FROM users');
    if (parseInt(usersCount[0].count) === 0) {
      const adminHash = await hashPassword('admin');
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', adminHash, 'admin']);
    }

    if (action === 'login') {
      const hashedPassword = await hashPassword(password);
      const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 AND password_hash = $2', [username, hashedPassword]);
      
      if (rows.length > 0) {
        const token = crypto.randomUUID();
        await pool.query('INSERT INTO sessions (token, username) VALUES ($1, $2)', [token, username]);
        return new Response(JSON.stringify({ success: true, token, user: { username: rows[0].username, role: rows[0].role } }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      } else {
        return new Response(JSON.stringify({ error: 'Credenziali non valide' }), { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Azione non supportata' }), { status: 400, headers: corsHeaders });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } finally {
    await pool.end().catch(() => {});
  }
}
