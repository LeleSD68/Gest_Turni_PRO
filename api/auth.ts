
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

// --- Crypto Helpers per PBKDF2 ---

function buf2hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

function hex2buf(hex: string) {
    const match = hex.match(/.{1,2}/g);
    if (!match) return new Uint8Array();
    return new Uint8Array(match.map(byte => parseInt(byte, 16)));
}

async function hashPassword(password: string, salt: Uint8Array | null = null): Promise<string> {
    const enc = new TextEncoder();
    // Genera un nuovo salt casuale se non fornito (per nuovi utenti/password)
    const currentSalt = salt || crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: currentSalt,
            iterations: 100000, // 100k iterazioni per rallentare il brute-force
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"] // Usage dummy per export
    );

    // Esporta la chiave derivata
    const exportedKey = await crypto.subtle.exportKey("raw", key);
    
    // Formato archiviazione: salt_hex:hash_hex
    return `${buf2hex(currentSalt)}:${buf2hex(exportedKey)}`;
}

async function verifyPassword(password: string, storedComposite: string): Promise<boolean> {
    try {
        const parts = storedComposite.split(':');
        // Se la password nel DB non ha il formato salt:hash (es. vecchi hash SHA256), fallisce
        if (parts.length !== 2) return false; 
        
        const [saltHex, originalHashHex] = parts;
        const salt = hex2buf(saltHex);
        
        // Ricalcola hash usando lo STESSO salt
        const newComposite = await hashPassword(password, salt);
        const [, newHashHex] = newComposite.split(':');
        
        return originalHashHex === newHashHex;
    } catch (e) {
        return false;
    }
}

// --- Handler ---

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

    const sql = neon(process.env.DATABASE_URL);
    const { action, username, password, newPassword, newUsername, masterKey } = await request.json();

    // Init Tables
    await sql(`
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
    const existingUsers = await sql('SELECT count(*) FROM users');
    if (parseInt(existingUsers[0].count) === 0) {
      // Usa il nuovo sistema di hash sicuro anche per l'admin di default
      const defaultHash = await hashPassword('admin');
      await sql('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', defaultHash, 'admin']);
    }

    // LOGIN
    if (action === 'login') {
      // Recupera l'utente per ottenere il salt memorizzato
      const rows = await sql('SELECT * FROM users WHERE username = $1', [username]);
      
      if (rows.length > 0) {
        const storedHash = rows[0].password_hash;
        const isValid = await verifyPassword(password, storedHash);

        if (isValid) {
            const token = crypto.randomUUID();
            await sql('INSERT INTO sessions (token, username) VALUES ($1, $2)', [token, username]);
            return new Response(JSON.stringify({ success: true, token, user: { username: rows[0].username, role: rows[0].role } }), { status: 200 });
        }
      } 
      
      return new Response(JSON.stringify({ error: 'Credenziali non valide' }), { status: 401 });
    }

    // RECOVER USERNAME (Public with Master Key)
    if (action === 'recover_username') {
        if (!process.env.APP_ACCESS_CODE) {
             return new Response(JSON.stringify({ error: 'Configurazione server incompleta (APP_ACCESS_CODE mancante)' }), { status: 500 });
        }

        if (masterKey !== process.env.APP_ACCESS_CODE) {
             return new Response(JSON.stringify({ error: 'Codice Master (Cloud Key) non valido' }), { status: 403 });
        }

        const rows = await sql('SELECT username FROM users ORDER BY username ASC');
        const usernames = rows.map(r => r.username);

        return new Response(JSON.stringify({ success: true, usernames }), { status: 200 });
    }

    // RESET PASSWORD (Public with Master Key)
    if (action === 'reset_password') {
        if (!process.env.APP_ACCESS_CODE) {
             return new Response(JSON.stringify({ error: 'Configurazione server incompleta (APP_ACCESS_CODE mancante)' }), { status: 500 });
        }

        if (masterKey !== process.env.APP_ACCESS_CODE) {
             return new Response(JSON.stringify({ error: 'Codice Master (Cloud Key) non valido' }), { status: 403 });
        }

        const userExists = await sql('SELECT username FROM users WHERE username = $1', [username]);
        if (userExists.length === 0) {
            return new Response(JSON.stringify({ error: 'Utente non trovato' }), { status: 404 });
        }

        const newHash = await hashPassword(newPassword);
        await sql('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, username]);
        
        // Invalidate all existing sessions for security
        await sql('DELETE FROM sessions WHERE username = $1', [username]);

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // CREATE USER (Protected)
    if (action === 'create_user') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      const sessionRows = await sql(`
        SELECT u.role FROM sessions s 
        JOIN users u ON s.username = u.username 
        WHERE s.token = $1 AND s.expires_at > NOW()
      `, [token]);

      if (sessionRows.length === 0 || sessionRows[0].role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 403 });
      }

      const safeHash = await hashPassword(password);
      try {
        await sql('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, safeHash, 'user']);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Utente già esistente' }), { status: 400 });
      }
    }

    // CHANGE PASSWORD
    if (action === 'change_password') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      const sessionRows = await sql('SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
      
      if (sessionRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Sessione scaduta' }), { status: 401 });
      }

      const currentUser = sessionRows[0].username;
      const targetUser = username || currentUser;

      if (targetUser !== currentUser) {
         const roleRows = await sql('SELECT role FROM users WHERE username = $1', [currentUser]);
         if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
             return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 403 });
         }
      }

      const newHash = await hashPassword(newPassword);
      await sql('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, targetUser]);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // CHANGE USERNAME
    if (action === 'change_username') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) return new Response(JSON.stringify({ error: 'Token mancante' }), { status: 401 });

      const sessionRows = await sql('SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
      
      if (sessionRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Sessione scaduta' }), { status: 401 });
      }

      const currentUser = sessionRows[0].username;
      const currentPassword = password; 
      
      // Verifica password attuale
      const userCheck = await sql('SELECT password_hash FROM users WHERE username = $1', [currentUser]);
      
      let isPasswordCorrect = false;
      if (userCheck.length > 0) {
          isPasswordCorrect = await verifyPassword(currentPassword, userCheck[0].password_hash);
      }
      
      if (!isPasswordCorrect) {
          return new Response(JSON.stringify({ error: 'Password attuale non corretta' }), { status: 403 });
      }

      // Check duplicati
      const duplicateCheck = await sql('SELECT username FROM users WHERE username = $1', [newUsername]);
      if (duplicateCheck.length > 0) {
          return new Response(JSON.stringify({ error: 'Nome utente già in uso' }), { status: 400 });
      }

      // Update DB
      await sql('UPDATE users SET username = $1 WHERE username = $2', [newUsername, currentUser]);
      await sql('UPDATE sessions SET username = $1 WHERE username = $2', [newUsername, currentUser]);

      return new Response(JSON.stringify({ success: true, newUsername }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Azione non valida' }), { status: 400 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
