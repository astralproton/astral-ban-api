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

// Archivos locales (para baneados)
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
  const { error } = await supabase.from('usuarios').insert([usuario]);
  if (error) console.error('Error guardando usuario:', error.message);
  return !error;
}

// Rutas
app.get('/', (req, res) => {
  res.send('🚀 API Astral conectada a Supabase');
});

// Verificar si un ID ya existe
app.post('/existe-id', async (req, res) => {
  const { id } = req.body;
  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Error verificando ID' });
  res.json({ existe: !!data });
});

// Registrar usuario con ID personalizado
// Registrar usuario con ID personalizado (MODIFICADO)
app.post('/registrar-usuario', async (req, res) => {
  const { id, nombre } = req.body;
  if (!id || !nombre) return res.status(400).json({ error: 'Faltan datos' });
  
  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .maybeSingle();
    
  if (error) return res.status(500).json({ error: 'Error verificando ID' });
  if (data) return res.status(409).json({ error: 'ID ya está en uso' });
  
  const success = await guardarUsuario({
    id,
    nombre,
    fecha: new Date().toISOString(),
    baneado: false,
  });
  
  success
    ? res.json({ success: true })
    : res.status(500).json({ error: 'Error al guardar en Supabase' });
});

// Obtener lista de usuarios
app.get('/usuarios', async (req, res) => {
  const users = await leerUsuarios();
  res.json(users);
});

// Banear usuario
app.post('/ban', async (req, res) => {
  const { id } = req.body;
  const { error } = await supabase
    .from('usuarios')
    .update({ baneado: true })
    .eq('id', id);

  res.json({ success: !error });
});

// Desbanear usuario
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

app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT} y conectada a Supabase`);
});
