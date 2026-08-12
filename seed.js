const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Eliminar tablas previas para asegurar la recreación con estructura limpia
DROP TABLE IF EXISTS receta_ingredientes CASCADE;
DROP TABLE IF EXISTS produccion_log CASCADE;
DROP TABLE IF EXISTS mermas_log CASCADE;
DROP TABLE IF EXISTS recetas CASCADE;
DROP TABLE IF EXISTS ingredientes CASCADE;

-- 2. Crear tablas principales
CREATE TABLE ingredientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    stock_actual NUMERIC(10,2) DEFAULT 0,
    stock_minimo NUMERIC(10,2) DEFAULT 0,
    stock_maximo NUMERIC(10,2) DEFAULT 0,
    unidad_medida VARCHAR(20) DEFAULT 'g'
);

CREATE TABLE recetas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    total_recetas NUMERIC(10,2) DEFAULT 1
);

CREATE TABLE receta_ingredientes (
    id SERIAL PRIMARY KEY,
    receta_id INT REFERENCES recetas(id) ON DELETE CASCADE,
    ingrediente_id INT REFERENCES ingredientes(id),
    cantidad_requerida NUMERIC(10,2) NOT NULL
);

CREATE TABLE mermas_log (
    id SERIAL PRIMARY KEY,
    tipo_item VARCHAR(30),
    descripcion_item TEXT,
    cantidad NUMERIC(10,2) NOT NULL,
    motivo TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE produccion_log (
    id SERIAL PRIMARY KEY,
    receta_id INT REFERENCES recetas(id) ON DELETE CASCADE,
    cantidad_producida NUMERIC(10,2) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE
);

-- 3. Catálogo de Ingredientes
INSERT INTO ingredientes (id, nombre, stock_actual, stock_minimo, stock_maximo, unidad_medida) VALUES
(1, 'HARINA MC', 100000, 10000, 200000, 'g'),
(2, 'HARINA BLANCA', 100000, 10000, 200000, 'g'),
(3, 'HARINA CENTENO', 20000, 2000, 50000, 'g'),
(4, 'H. CENTENO', 20000, 2000, 50000, 'g'),
(5, 'H. INTEGRAL', 20000, 2000, 50000, 'g'),
(6, 'AZUCAR', 50000, 5000, 100000, 'g'),
(7, 'SAL', 20000, 2000, 50000, 'g'),
(8, 'LEVADURA', 10000, 1000, 20000, 'g'),
(9, 'AGUA', 100000, 10000, 200000, 'ml'),
(10, 'AGUA FRIA', 100000, 10000, 200000, 'ml'),
(11, 'AGUA HIRVIENDO', 50000, 5000, 100000, 'ml'),
(12, 'LECHE', 50000, 5000, 100000, 'ml'),
(13, 'LECHE EN POLVO', 20000, 2000, 40000, 'g'),
(14, 'HUEVO', 50000, 5000, 100000, 'g'),
(15, 'MANTEQUILLA', 30000, 3000, 60000, 'g'),
(16, 'MANTEQ. EMPASTE', 30000, 3000, 60000, 'g'),
(17, 'ACEITE', 30000, 3000, 60000, 'ml'),
(18, 'MASA MADRE', 50000, 5000, 100000, 'g'),
(19, 'BIGA', 30000, 3000, 60000, 'g'),
(20, 'POOLISH', 30000, 3000, 60000, 'g'),
(21, 'PLUS PAN', 10000, 1000, 20000, 'g'),
(22, 'PASTA MORITA', 10000, 1000, 20000, 'g'),
(23, 'SEMILLAS', 10000, 1000, 20000, 'g'),
(24, 'CERVEZA', 10000, 1000, 20000, 'ml'),
(25, 'ARANDANO DESH', 10000, 1000, 20000, 'g'),
(26, 'NUEZ TROZO', 10000, 1000, 20000, 'g'),
(27, 'COCOA CLARA', 10000, 1000, 20000, 'g'),
(28, 'COCOA OSCURA', 10000, 1000, 20000, 'g'),
(29, 'CHISPAS CHOCO', 10000, 1000, 20000, 'g'),
(30, 'AVELLANA TOST', 10000, 1000, 20000, 'g'),
(31, 'ELOTE AMARILLO', 50000, 5000, 100000, 'g'),
(32, 'PLATANO MADURO', 30000, 3000, 60000, 'g'),
(33, 'LECHERA', 30000, 3000, 60000, 'g'),
(34, 'VAINILLA', 10000, 1000, 20000, 'ml'),
(35, 'ROYAL', 5000, 500, 10000, 'g'),
(36, 'BICARBONATO', 5000, 500, 10000, 'g'),
(37, 'VINO BLANCO', 10000, 1000, 20000, 'ml'),
(38, 'CANELA MARTAJADA', 5000, 500, 10000, 'g'),
(39, 'RAYADURA NARANJA', 500, 50, 1000, 'pz'),
(40, 'ESCE. AZAHAR', 5000, 500, 10000, 'ml'),
(41, 'THAN ZONG', 10000, 1000, 20000, 'g'),
(42, 'ESCE. NARAN MANTE', 5000, 500, 10000, 'ml');

-- 4. Registro de Recetas y Metas
INSERT INTO recetas (id, nombre, total_recetas) VALUES
(1, 'Masa Baguette', 15),
(2, 'Masa Centeno', 1),
(3, 'Brioche', 5.5),
(4, 'Pizza', 10),
(5, 'Biga', 10),
(6, 'Brioche Caja', 20),
(7, 'Masa Baguette Cacao', 1),
(8, 'Muffin Inglés', 1),
(9, 'Pan Blanco', 1),
(10, 'Masa Croissant', 1),
(11, 'Poolish', 1),
(12, 'Hojaldre Simple', 1),
(13, 'Rosca 2026', 1),
(14, 'Focaccia', 1),
(15, 'Hojaldre Invertido', 1),
(16, 'Concha', 1),
(17, 'Pan de Muerto 2025', 1),
(18, 'Pan de Muerto Choco 2025', 1),
(19, 'Pan Elote', 1),
(20, 'Pan Plátano', 1);

-- 5. Insumos Por Receta
INSERT INTO receta_ingredientes (receta_id, ingrediente_id, cantidad_requerida) VALUES
-- 1. Masa Baguette
(1, 1, 10500), (1, 2, 4500), (1, 7, 360), (1, 8, 60), (1, 18, 4500), (1, 9, 9300), (1, 4, 150), (1, 5, 75), (1, 22, 90), (1, 23, 50),
-- 2. Masa Centeno
(2, 1, 500), (2, 3, 500), (2, 7, 18), (2, 24, 250), (2, 11, 250), (2, 18, 800), (2, 25, 300), (2, 26, 150), (2, 8, 6),
-- 3. Brioche
(3, 1, 5500), (3, 6, 990), (3, 7, 55), (3, 9, 990), (3, 12, 990), (3, 14, 990), (3, 15, 990), (3, 8, 247.5), (3, 21, 55),
-- 4. Pizza
(4, 1, 7500), (4, 10, 6800), (4, 19, 11280), (4, 17, 300), (4, 7, 380),
-- 5. Biga
(5, 1, 7500), (5, 10, 3750), (5, 8, 30),
-- 6. Brioche Caja
(6, 1, 5250), (6, 6, 1000), (6, 12, 1000), (6, 14, 1200), (6, 8, 100), (6, 15, 900), (6, 7, 40), (6, 9, 600),
-- 7. Masa Baguette Cacao
(7, 1, 700), (7, 2, 300), (7, 7, 24), (7, 8, 5), (7, 9, 680), (7, 18, 200), (7, 27, 80), (7, 29, 250), (7, 30, 120),
-- 8. Muffin Inglés
(8, 1, 3825), (8, 6, 230), (8, 7, 76), (8, 8, 76), (8, 21, 38), (8, 12, 2300), (8, 15, 460),
-- 9. Pan Blanco
(9, 1, 1400), (9, 7, 28), (9, 6, 112), (9, 21, 14), (9, 9, 644), (9, 17, 112), (9, 14, 112), (9, 8, 20),
-- 10. Masa Croissant
(10, 1, 204), (10, 2, 476), (10, 6, 108), (10, 7, 19), (10, 13, 17), (10, 8, 22), (10, 21, 7), (10, 14, 34), (10, 15, 120), (10, 9, 170), (10, 20, 296.5), (10, 16, 400),
-- 11. Poolish
(11, 1, 136), (11, 10, 156), (11, 8, 3.5),
-- 12. Hojaldre Simple
(12, 1, 50), (12, 2, 325), (12, 15, 30), (12, 7, 7), (12, 9, 190), (12, 16, 240),
-- 13. Rosca 2026
(13, 1, 1000), (13, 6, 190), (13, 41, 400), (13, 15, 270), (13, 8, 40), (13, 21, 10), (13, 7, 12), (13, 13, 50), (13, 14, 200), (13, 38, 10),
-- 14. Focaccia
(14, 1, 500), (14, 7, 9), (14, 8, 9), (14, 10, 390), (14, 17, 10),
-- 15. Hojaldre Invertido
(15, 1, 500), (15, 2, 830), (15, 9, 300), (15, 37, 300), (15, 16, 1000),
-- 16. Concha
(16, 1, 1000), (16, 6, 190), (16, 12, 200), (16, 15, 250), (16, 8, 60), (16, 21, 10), (16, 7, 12), (16, 13, 50), (16, 14, 200), (16, 38, 10),
-- 17. Pan de Muerto 2025
(17, 1, 2000), (17, 6, 380), (17, 12, 400), (17, 15, 500), (17, 39, 2), (17, 40, 20), (17, 42, 28), (17, 8, 100), (17, 21, 20), (17, 13, 100), (17, 14, 400),
-- 18. Pan de Muerto Choco 2025 (Levadura ajustada a 140g)
(18, 1, 1800), (18, 28, 150), (18, 6, 380), (18, 12, 400), (18, 15, 500), (18, 39, 2), (18, 40, 20), (18, 42, 28), (18, 8, 140), (18, 21, 20), (18, 13, 100), (18, 14, 400),
-- 19. Pan Elote
(19, 31, 6000), (19, 14, 4000), (19, 35, 110), (19, 15, 1800), (19, 34, 100), (19, 33, 7000),
-- 20. Pan Plátano
(20, 2, 3333), (20, 14, 3333), (20, 6, 3333), (20, 17, 3333), (20, 32, 5000), (20, 36, 67), (20, 35, 67);

-- 6. Actualizar las secuencias de ID de PostgreSQL
SELECT setval('ingredientes_id_seq', (SELECT MAX(id) FROM ingredientes));
SELECT setval('recetas_id_seq', (SELECT MAX(id) FROM recetas));
SELECT setval('receta_ingredientes_id_seq', (SELECT MAX(id) FROM receta_ingredientes));
`;

async function runSeed() {
  try {
    console.log('Conectando a la base de datos...');
    await pool.query(sql);
    console.log('¡Base de datos limpia y estructurada con éxito!');
  } catch (err) {
    console.error('Error al poblar la base de datos:', err);
  } finally {
    await pool.end();
  }
}

runSeed();