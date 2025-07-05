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
const SUPABASE_KEY = 'TU_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Archivos locales (solo para baneados)
const BANEADOS_FILE = './baneados.json';

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

// Verificar si un ID ya existe
app.post('/existe-id', async (req, res) => {
  const { id } = req.body;
  const { data } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .single();

  res.json({ existe: !!data });
});

// Registrar con ID personalizado
app.post('/registrar-usuario', async (req, res) => {
  const { id, nombre } = req.body;
  if (!id || !nombre) return res.status(400).json({ error: 'Faltan datos' });

  // Verificar si ese ID ya existe
  const { data } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .single();

  if (data) return res.status(409).json({ error: 'ID ya está en uso' });

  const success = await guardarUsuario({
    id,
    nombre,
    fecha: new Date().toISOString(),
    monedas: 0,     // si usas estrellas
    baneado: false  // estado inicial
  });

  success
    ? res.json({ success: true })
    : res.status(500).json({ error: 'Error al guardar en Supabase' });
});

app.get('/usuarios', async (req, res) => {
  const users = await leerUsuarios();
  res.json(users);
});

app.post('/ban', async (req, res) => {
  const { id } = req.body;
  const { error } = await supabase
    .from('usuarios')
    .update({ baneado: true })
    .eq('id', id);

  res.json({ success: !error });
});

app.post('/unban', async (req, res) => {
  const { id } = req.body;
  const { error } = await supabase
    .from('usuarios')
    .update({ baneado: false })
    .eq('id', id);

  res.json({ success: !error });
});

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

app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT} y conectada a Supabase`);
});
