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

// Obtener monedas del usuario
app.get('/api/user/coins', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('coins')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Si el usuario no existe, devolver 0 monedas
      return res.json({ coins: 0 });
    }

    res.json({ coins: data.coins || 0 });
  } catch (error) {
    console.error('Error obteniendo monedas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar monedas del usuario
app.post('/api/user/coins', async (req, res) => {
  try {
    const { userId, coins } = req.body;
    
    if (!userId || coins === undefined) {
      return res.status(400).json({ error: 'userId y coins son requeridos' });
    }

    if (typeof coins !== 'number' || coins < 0) {
      return res.status(400).json({ error: 'coins debe ser un número positivo' });
    }

    const { error } = await supabase
      .from('usuarios')
      .update({ 
        coins: coins,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error actualizando monedas:', error);
      return res.status(500).json({ error: 'Error actualizando monedas' });
    }

    res.json({ success: true, coins: coins });
  } catch (error) {
    console.error('Error actualizando monedas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener datos de la tienda del usuario
app.get('/api/user/shop', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const { data, error } = await supabase
      .from('user_shop_data')
      .select('shop_data')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Si el usuario no existe, crear registro vacío
      const { error: insertError } = await supabase
        .from('user_shop_data')
        .insert([{
          user_id: userId,
          shop_data: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error('Error creando datos de tienda:', insertError);
      }

      return res.json({ shopData: {} });
    }

    res.json({ shopData: data.shop_data || {} });
  } catch (error) {
    console.error('Error obteniendo datos de tienda:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar datos de la tienda del usuario
app.post('/api/user/shop', async (req, res) => {
  try {
    const { userId, shopData } = req.body;
    
    if (!userId || !shopData) {
      return res.status(400).json({ error: 'userId y shopData son requeridos' });
    }

    // Intentar actualizar primero
    const { data: existingData } = await supabase
      .from('user_shop_data')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingData) {
      // Usuario existe, actualizar
      const { error } = await supabase
        .from('user_shop_data')
        .update({ 
          shop_data: shopData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error actualizando datos de tienda:', error);
        return res.status(500).json({ error: 'Error actualizando datos de tienda' });
      }
    } else {
      // Usuario no existe, crear
      const { error } = await supabase
        .from('user_shop_data')
        .insert([{
          user_id: userId,
          shop_data: shopData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error creando datos de tienda:', error);
        return res.status(500).json({ error: 'Error creando datos de tienda' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error guardando datos de tienda:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT} y conectada a Supabase`);
});
