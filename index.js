import express from 'express';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const CONTADOR_FILE = './contador.json';
const USUARIOS_FILE = './usuarios.json';
const BANEADOS_FILE = './baneados.json';

// Funciones auxiliares
function leerContador() {
  try {
    return JSON.parse(fs.readFileSync(CONTADOR_FILE)).contador || 1;
  } catch {
    return 1;
  }
}
function guardarContador(valor) {
  fs.writeFileSync(CONTADOR_FILE, JSON.stringify({ contador: valor }, null, 2));
}
function leerUsuarios() {
  try {
    return JSON.parse(fs.readFileSync(USUARIOS_FILE));
  } catch {
    return [];
  }
}
function guardarUsuarios(lista) {
  fs.writeFileSync(USUARIOS_FILE, JSON.stringify(lista, null, 2));
}
function leerBaneados() {
  try {
    return JSON.parse(fs.readFileSync(BANEADOS_FILE));
  } catch {
    return [];
  }
}
function guardarBaneados(lista) {
  fs.writeFileSync(BANEADOS_FILE, JSON.stringify(lista, null, 2));
}

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('🚀 API Astral en línea');
});

// Generar nuevo ID
app.get('/nuevo-usuario', (req, res) => {
  let contador = leerContador();
  const nuevoID = `astraluser${contador}`;
  guardarContador(contador + 1);
  res.json({ id: nuevoID });
});

// Registrar usuario
app.post('/registrar-usuario', (req, res) => {
  const { id, nombre } = req.body;
  if (!id || !nombre) return res.status(400).json({ error: 'Faltan datos' });

  const usuarios = leerUsuarios();
  usuarios.push({ id, nombre, fecha: new Date().toISOString() });
  guardarUsuarios(usuarios);
  res.json({ success: true });
});

// Ver todos los usuarios
app.get('/usuarios', (req, res) => {
  res.json(leerUsuarios());
});

// Baneo
app.post('/ban', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta el ID' });
  const baneados = leerBaneados();
  if (!baneados.includes(id)) {
    baneados.push(id);
    guardarBaneados(baneados);
  }
  res.json({ success: true });
});

function leerBaneados() {
  try {
    return JSON.parse(fs.readFileSync('./baneados.json'));
  } catch {
    return [];
  }
}

function guardarBaneados(lista) {
  fs.writeFileSync('./baneados.json', JSON.stringify(lista, null, 2));
}

// Desbanear
app.post('/unban', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta el ID' });
  const baneados = leerBaneados().filter(user => user !== id);
  guardarBaneados(baneados);
  res.json({ success: true });
});

// Verificar si está baneado
app.post('/check-banned', (req, res) => {
  const { id } = req.body;
  const baneados = leerBaneados();
  res.json({ banned: baneados.includes(id) });
});

app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT}`);
});
