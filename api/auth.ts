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

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL missing' }), { status: 500 });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { action, username, password, newPassword } = await request.json();

    // Init Tables
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

    // Check for default admin
    const { rows: existingUsers } = await pool.query('SELECT count(*) FROM users');
    if (parseInt(existingUsers[0].count) === 0) {
      const defaultHash = await hashPassword('admin');
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', defaultHash, 'admin']);
    }

    // LOGIN
    if (action === 'login') {
      const hashedPassword = await hashPassword(password);
      const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 AND password_hash = $2', [username, hashedPassword]);
      
      if (rows.length > 0) {
        const token = crypto.randomUUID();
        await pool.query('INSERT INTO sessions (token, username) VALUES ($1, $2)', [token, username]);
        await pool.end();
        return new Response(JSON.stringify({ success: true, token, user: { username: rows[0].username, role: rows[0].role } }), { status: 200 });
      } else {
        await pool.end();
        return new Response(JSON.stringify({ error: 'Credenziali non valide' }), { status: 401 });
      }
    }

    // CREATE USER (Protected)
    if (action === 'create_user') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      // Verify session and role
      const { rows: sessionRows } = await pool.query(`
        SELECT u.role FROM sessions s 
        JOIN users u ON s.username = u.username 
        WHERE s.token = $1 AND s.expires_at > NOW()
      `, [token]);

      if (sessionRows.length === 0 || sessionRows[0].role !== 'admin') {
        await pool.end();
        return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 403 });
      }

      const hashedPassword = await hashPassword(password);
      try {
        await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, hashedPassword, 'user']);
        await pool.end();
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        await pool.end();
        return new Response(JSON.stringify({ error: 'Utente già esistente' }), { status: 400 });
      }
    }

    // CHANGE PASSWORD
    if (action === 'change_password') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      // Get current user from session
      const { rows: sessionRows } = await pool.query('SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
      
      if (sessionRows.length === 0) {
        await pool.end();
        return new Response(JSON.stringify({ error: 'Sessione scaduta' }), { status: 401 });
      }

      const currentUser = sessionRows[0].username;
      // Target user (admin can change anyone, user can change own)
      const targetUser = username || currentUser;

      // If changing someone else, verify admin
      if (targetUser !== currentUser) {
         const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE username = $1', [currentUser]);
         if (roleRows[0].role !== 'admin') {
             await pool.end();
             return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 403 });
         }
      }

      const newHash = await hashPassword(newPassword);
      await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, targetUser]);
      await pool.end();
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    await pool.end();
    return new Response(JSON.stringify({ error: 'Azione non valida' }), { status: 400 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}