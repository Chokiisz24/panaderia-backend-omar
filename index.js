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

// 2. Crear un nuevo ingrediente (NUEVO)
app.post('/api/ingredientes', async (req, res) => {
  const { nombre, unidad_medida = 'g', stock_actual = 0, stock_minimo = 0 } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del ingrediente es obligatorio' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ingredientes (nombre, unidad_medida, stock_actual, stock_minimo) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre.trim(), unidad_medida, stock_actual, stock_minimo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear ingrediente:', err);
    res.status(500).json({ error: 'Error al crear el ingrediente: ' + err.message });
  }
});

// 3. Actualizar stock_actual o stock_minimo de un ingrediente
app.put('/api/ingredientes/:id', async (req, res) => {
  const { id } = req.params;
  const { stock_actual, stock_minimo } = req.body;

  try {
    let result;
    if (stock_actual !== undefined && stock_minimo !== undefined) {
      result = await pool.query(
        'UPDATE ingredientes SET stock_actual = $1, stock_minimo = $2 WHERE id = $3 RETURNING *',
        [stock_actual, stock_minimo, id]
      );
    } 
    else if (stock_actual !== undefined) {
      result = await pool.query(
        'UPDATE ingredientes SET stock_actual = $1 WHERE id = $2 RETURNING *',
        [stock_actual, id]
      );
    } 
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

// 4. Obtener recetas CON sus ingredientes
app.get('/api/recetas', async (req, res) => {
  try {
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

// 5. Crear / Guardar una nueva receta con sus ingredientes
app.post('/api/recetas', async (req, res) => {
  const { nombre, ingredientes } = req.body;

  if (!nombre || !ingredientes || !Array.isArray(ingredientes) || ingredientes.length === 0) {
    return res.status(400).json({ error: 'Debes proporcionar un nombre y al menos un ingrediente' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertRecetaQuery = 'INSERT INTO recetas (nombre) VALUES ($1) RETURNING id, nombre';
    const resReceta = await client.query(insertRecetaQuery, [nombre]);
    const recetaId = resReceta.rows[0].id;

    const insertIngredienteQuery = `
      INSERT INTO receta_ingredientes (receta_id, ingrediente_id, cantidad_requerida)
      VALUES ($1, $2, $3)
    `;

    for (const item of ingredientes) {
      await client.query(insertIngredienteQuery, [
        recetaId,
        item.ingrediente_id,
        item.cantidad_requerida
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Receta guardada exitosamente',
      receta: {
        id: recetaId,
        nombre: resReceta.rows[0].nombre,
        ingredientes
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al guardar la receta:', err);
    res.status(500).json({ error: 'Error interno al guardar la receta: ' + err.message });
  } finally {
    client.release();
  }
});

// 6. Eliminar receta
app.delete('/api/recetas/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM receta_ingredientes WHERE receta_id = $1', [id]);
    await client.query('DELETE FROM recetas WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.json({ mensaje: 'Receta eliminada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar la receta:', err);
    res.status(500).json({ error: 'Error al eliminar la receta' });
  } finally {
    client.release();
  }
});

// 7. Registrar producción
app.post('/api/produccion', async (req, res) => {
  const { receta_id, cantidad_producida, fecha } = req.body;
  try {
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

// 8. Actualizar producción de un día específico
app.put('/api/produccion/actualizar', async (req, res) => {
  const { receta_id, fecha, nueva_cantidad } = req.body;

  try {
    await pool.query(
      'DELETE FROM produccion_log WHERE receta_id = $1 AND fecha::date = $2::date',
      [receta_id, fecha]
    );

    const cantidadNumerica = parseFloat(nueva_cantidad);

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

// 9. Obtener resumen de producción filtrado por fecha
app.get('/api/produccion/resumen', async (req, res) => {
  const { fecha } = req.query;
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

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));