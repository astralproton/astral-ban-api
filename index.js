import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Conexión con Supabase
const SUPABASE_URL = 'https://szojjdcfphaawixewnkm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6b2pqZGNmcGhhYXdpeGV3bmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MjUyNjMsImV4cCI6MjA2NzEwMTI2M30.EPRv9BOmT_iARe_D1tXBzLjJOP_92xLIOzv3ePLlSeg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Archivos locales (para contador y baneos)
const CONTADOR_FILE = './contador.json';
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
async function leerUsuarios() {
  const { data } = await supabase
    .from('usuarios')
    .select('*')
    .order('fecha', { ascending: false });
  return data || [];
}
async function guardarUsuario(usuario) {
  const { error } = await supabase
    .from('usuarios')
    .insert([usuario]);
  return !error;
}

// Rutas
app.get('/', (req, res) => {
  res.send('🚀 API Astral conectada a Supabase');
});

app.get('/nuevo-usuario', (req, res) => {
  let contador = leerContador();
  const nuevoID = `astraluser${contador}`;
  guardarContador(contador + 1);
  res.json({ id: nuevoID });
});

app.post('/registrar-usuario', async (req, res) => {
  const { id, nombre } = req.body;
  if (!id || !nombre) return res.status(400).json({ error: 'Faltan datos' });

  const success = await guardarUsuario({
    id,
    nombre,
    fecha: new Date().toISOString()
  });

  success
    ? res.json({ success: true })
    : res.status(500).json({ error: 'Error al guardar en Supabase' });
});

app.get('/usuarios', async (req, res) => {
  const users = await leerUsuarios();
  res.json(users);
});

// Banear un usuario desde Supabase
app.post('/ban', async (req, res) => {
  const { id } = req.body;
  const { error } = await supabase
    .from('usuarios')
    .update({ baneado: true })
    .eq('id', id);

  res.json({ success: !error });
});

// Desbanear
app.post('/unban', async (req, res) => {
  const { id } = req.body;
  const { error } = await supabase
    .from('usuarios')
    .update({ baneado: false })
    .eq('id', id);

  res.json({ success: !error });
});

// Verificar si un usuario está baneado
app.post('/check-banned', async (req, res) => {
  const { id } = req.body;
  const { data, error } = await supabase
    .from('usuarios')
    .select('baneado')
    .eq('id', id)
    .single();

  if (error || !data) return res.json({ banned: false });
  res.json({ banned: data.baneado === true });
});

app.post('/monedas', async (req, res) => {
  const { id } = req.body;
  const { data, error } = await supabase
    .from('usuarios')
    .select('monedas')
    .eq('id', id)
    .single();
  if (error || !data) return res.json({ monedas: 0 });
  res.json({ monedas: data.monedas });
});

app.post('/set-monedas', async (req, res) => {
  const { id, monedas } = req.body;
  const { error } = await supabase
    .from('usuarios')
    .update({ monedas })
    .eq('id', id);
  res.json({ success: !error });
});


app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT} y conectada a Supabase`);
});
