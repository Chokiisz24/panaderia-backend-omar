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

// 2. Actualizar stock_actual o stock_minimo de un ingrediente
app.put('/api/ingredientes/:id', async (req, res) => {
  const { id } = req.params;
  const { stock_actual, stock_minimo } = req.body;

  try {
    let result;
    // Si la petición actualiza ambos valores
    if (stock_actual !== undefined && stock_minimo !== undefined) {
      result = await pool.query(
        'UPDATE ingredientes SET stock_actual = $1, stock_minimo = $2 WHERE id = $3 RETURNING *',
        [stock_actual, stock_minimo, id]
      );
    } 
    // Si solo actualiza stock_actual
    else if (stock_actual !== undefined) {
      result = await pool.query(
        'UPDATE ingredientes SET stock_actual = $1 WHERE id = $2 RETURNING *',
        [stock_actual, id]
      );
    } 
    // Si solo actualiza stock_minimo
    else if (stock_minimo !== undefined) {
      result = await pool.query(
        'UPDATE ingredientes SET stock_minimo = $1 WHERE id = $2 RETURNING *',
        [stock_minimo, id]
      );
    }

    if (result && result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(400).json({ error: 'No se enviaron datos válidos para actualizar' });
    }
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

// 5. Registrar producción
app.post('/api/produccion', async (req, res) => {
  const { receta_id, cantidad_producida, fecha } = req.body;
  try {
    // Si no viene fecha, usamos la fecha local actual en formato YYYY-MM-DD
    const fechaRegistro = fecha || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `INSERT INTO produccion_log (receta_id, cantidad_producida, fecha) 
       VALUES ($1, $2, $3::date) RETURNING *`,
      [receta_id, cantidad_producida, fechaRegistro]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar producción' });
  }
});

// 6. Actualizar producción de un día específico (Lógica de Edición)
app.put('/api/produccion/actualizar', async (req, res) => {
  const { receta_id, fecha, nueva_cantidad } = req.body;

  try {
    // Reemplazamos los registros previos de ese día para esa receta
    await pool.query(
      'DELETE FROM produccion_log WHERE receta_id = $1 AND fecha::date = $2::date',
      [receta_id, fecha]
    );

    const cantidadNumerica = parseFloat(nueva_cantidad);
    
    // Si la nueva cantidad es mayor a 0, insertamos el nuevo valor
    if (cantidadNumerica > 0) {
      await pool.query(
        'INSERT INTO produccion_log (receta_id, cantidad_producida, fecha) VALUES ($1, $2, $3::date)',
        [receta_id, cantidadNumerica, fecha]
      );
    }

    res.json({ mensaje: 'Producción actualizada correctamente' });
  } catch (err) {
    console.error('Error al actualizar producción:', err);
    res.status(500).json({ error: 'Error interno al actualizar la producción' });
  }
});

// 7. Obtener resumen de producción filtrado por fecha
app.get('/api/produccion/resumen', async (req, res) => {
  const { fecha } = req.query; // YYYY-MM-DD
  
  // Validar que la fecha no venga undefined
  const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

  try {
    const result = await pool.query(
      `SELECT 
         r.id AS receta_id,
         r.nombre,
         r.total_recetas AS meta_diaria,
         COALESCE(SUM(p.cantidad_producida), 0) AS total_producido
       FROM recetas r
       LEFT JOIN produccion_log p 
         ON r.id = p.receta_id AND p.fecha::date = $1::date
       GROUP BY r.id, r.nombre, r.total_recetas
       ORDER BY r.nombre ASC`,
      [fechaConsulta]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en SQL:', err);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

// Iniciar servidor al final del archivo
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));