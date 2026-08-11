const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a PostgreSQL en Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. Obtener todos los ingredientes
app.get('/api/ingredientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ingredientes ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Actualizar el stock de un ingrediente (ej. desde la tabla)
app.put('/api/ingredientes/:id', async (req, res) => {
  const { id } = req.params;
  const { stock_actual } = req.body;
  try {
    const result = await pool.query(
      'UPDATE ingredientes SET stock_actual = $1 WHERE id = $2 RETURNING *',
      [stock_actual, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Obtener recetas CON sus ingredientes
app.get('/api/recetas', async (req, res) => {
  try {
    // Obtenemos las recetas y agrupamos sus ingredientes en formato JSON
    const query = `
      SELECT 
        r.id, 
        r.nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'ingrediente_id', ri.ingrediente_id,
              'cantidad_requerida', ri.cantidad_requerida
            )
          ) FILTER (WHERE ri.id IS NOT NULL), '[]'
        ) AS ingredientes
      FROM recetas r
      LEFT JOIN receta_ingredientes ri ON r.id = ri.receta_id
      GROUP BY r.id
      ORDER BY r.id ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Registrar Merma
app.post('/api/mermas', async (req, res) => {
  const { tipo_item, descripcion_item, cantidad, motivo } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO mermas_log (tipo_item, descripcion_item, cantidad, motivo) VALUES ($1, $2, $3, $4) RETURNING *',
      [tipo_item, descripcion_item, cantidad, motivo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));