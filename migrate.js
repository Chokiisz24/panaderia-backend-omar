// migrate.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Aplicando migración...');
    await pool.query('ALTER TABLE recetas ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;');
    console.log('¡Columna "activa" agregada con éxito!');
  } catch (err) {
    console.error('Error durante la migración:', err);
  } finally {
    await pool.end();
  }
}

runMigration();