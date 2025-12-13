import pkg from 'pg';
const { Pool } = pkg;

// Configurazione pool Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  try {
    // Inserisce un messaggio di prova nella tabella
    await pool.query("INSERT INTO test_table(message) VALUES($1)", ["Ciao Neon!"]);

    // Legge tutti i messaggi presenti nella tabella
    const result = await pool.query("SELECT * FROM test_table");

    // Risponde con JSON contenente i dati
    res.status(200).json(result.rows);
  } catch (error) {
    // Se qualcosa va storto, mostra l'errore
    res.status(500).json({ error: error.message });
  }
}
