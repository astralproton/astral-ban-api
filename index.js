import express from "express"
import cors from "cors"
import fs from "fs"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { createClient } from "@supabase/supabase-js"

const app = express()
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "https://astralproton.github.io/astral/",
      "https://astralproton.github.io/astral",
      "https://astralproton.github.io/astral/index.html",
      "https://astralproton.github.io/",
      "https://astralproton.github.io",
      "https://astral-90of.onrender.com",
      "https://module-flask.github.io",
      "https://module-flask.github.io/astral",
      "https://astrallol.github.io/astral/",
      "https://astrallol.github.io",
      "https://astralbackup.github.io",
      "https://ciololxdd.github.io"
    ],
    credentials: true,
  }),
)
app.use(express.json())

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "astral-secret-key-2024"

// Conexión con Supabase
const SUPABASE_URL = "https://szojjdcfphaawixewnkm.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6b2pqZGNmcGhhYXdpeGV3bmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MjUyNjMsImV4cCI6MjA2NzEwMTI2M30.EPRv9BOmT_iARe_D1tXBzLjJOP_92xLIOzv3ePLlSeg"
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Archivos locales (para baneados)
const BANEADOS_FILE = "./baneados.json"

function leerBaneados() {
  try {
    return JSON.parse(fs.readFileSync(BANEADOS_FILE))
  } catch {
    return []
  }
}

function guardarBaneados(lista) {
  fs.writeFileSync(BANEADOS_FILE, JSON.stringify(lista, null, 2))
}

async function leerUsuarios() {
  const { data } = await supabase.from("usuarios").select("*").order("fecha", { ascending: false })
  return data || []
}

async function guardarUsuario(usuario) {
  // Insert user, then ensure a sequential `numero` is assigned if not provided
  const { data, error } = await supabase.from("usuarios").insert([usuario]).select().single();
  if (error) {
    console.error("Error guardando usuario:", error.message)
    return false
  }

  try {
    // If the inserted user does not have a numero, compute next and set it
    if (!data.numero) {
      const { data: lastRows, error: lastErr } = await supabase.from('usuarios').select('numero').order('numero', { ascending: false }).limit(1);
      if (lastErr) console.warn('Could not read last numero', lastErr.message);
      const lastNum = Array.isArray(lastRows) && lastRows.length ? (lastRows[0].numero || 0) : 0;
      const nextNum = (lastNum || 0) + 1;
      const { error: updErr } = await supabase.from('usuarios').update({ numero: nextNum }).eq('id', data.id);
      if (updErr) {
        console.warn('Could not update usuario numero:', updErr.message);
      }
    }
  } catch (e) {
    console.warn('Error ensuring numero on user insert', e);
  }

  return true
}

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" })
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" })
  }
}

// Middleware para roles
function requireRole(roles) {
  return (req, res, next) => {
    const userRol = req.user.rol;
    if (!roles.includes(userRol)) {
      return res.status(403).json({ error: "No tienes permisos suficientes" });
    }
    next();
  };
}

// Rutas
app.get("/", (req, res) => {
  res.send("🚀 API Astral conectada a Supabase con autenticación y roles")
})

// Registro de usuario con contraseña
app.post("/register", async (req, res) => {
  try {
    const { username, name, password } = req.body
    if (!username || !name || !password) {
      return res.status(400).json({ error: "Todos los campos son requeridos" })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" })
    }
    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabase.from("usuarios").select("id").eq("id", username).maybeSingle()
    if (existingUser) {
      return res.status(409).json({ error: "El nombre de usuario ya está en uso" })
    }
    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10)
    // Crear usuario (rol por defecto: usuario)
    const success = await guardarUsuario({
      id: username,
      nombre: name,
      password: hashedPassword,
      fecha: new Date().toISOString(),
      baneado: false,
      coins: 0,
      avatar: null,
      bio: null,
      edad: null,
      apellido: null,
      genero: null,
      insignia: null,
      rol: "usuario"
    })
    if (success) {
      // Generar token JWT
      const token = jwt.sign({ userId: username, name: name, rol: "usuario" }, JWT_SECRET, { expiresIn: "7d" })
      res.json({
        success: true,
        token,
        user: { id: username, name: name, rol: "usuario" },
      })
    } else {
      res.status(500).json({ error: "Error al crear la cuenta" })
    }
  } catch (error) {
    console.error("Error en registro:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Login de usuario
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: "Usuario y contraseña son requeridos" })
    }
    // Buscar usuario
    const { data: user, error } = await supabase
      .from("usuarios")
      .select("id, nombre, password, baneado, rol")
      .eq("id", username)
      .single()
    if (error || !user) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" })
    }
    // Verificar si está baneado
    if (user.baneado) {
      return res.status(403).json({ error: "Tu cuenta ha sido suspendida" })
    }
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" })
    }
    // Generar token JWT con rol
    const token = jwt.sign({ userId: user.id, name: user.nombre, rol: user.rol || "usuario" }, JWT_SECRET, { expiresIn: "7d" })
    // Actualizar last_seen
    await supabase.from("usuarios").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
    console.log(`Updated last_seen for user ${user.id} on login`);
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.nombre, rol: user.rol || "usuario" },
    })
  } catch (error) {
    console.error("Error en login:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Verificar token (para mantener sesión)
app.get("/verify-token", verifyToken, (req, res) => {
  res.json({
    valid: true,
    user: { id: req.user.userId, name: req.user.name, rol: req.user.rol },
  })
})

// Cambiar rol de usuario (solo Dueño y Admin Senior)
app.post("/usuarios/:id/rol", verifyToken, requireRole(["owner", "admin_senior"]), async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;
  const rolesValidos = ["owner", "admin_senior", "admin_bajo_custodia", "admin", "amigo", "usuario"];
  if (!rolesValidos.includes(rol)) return res.status(400).json({ error: "Rol inválido" });
  const { error } = await supabase.from("usuarios").update({ rol }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Verificar si un ID ya existe
app.post("/existe-id", async (req, res) => {
  const { id } = req.body
  const { data, error } = await supabase.from("usuarios").select("id").eq("id", id).maybeSingle()
  if (error) return res.status(500).json({ error: "Error verificando ID" })
  res.json({ existe: !!data })
})

// Registrar usuario con ID personalizado (MANTENIDO para compatibilidad)
app.post("/registrar-usuario", async (req, res) => {
  const { id, nombre } = req.body
  if (!id || !nombre) return res.status(400).json({ error: "Faltan datos" })
  const { data, error } = await supabase.from("usuarios").select("id").eq("id", id).maybeSingle()
  if (error) return res.status(500).json({ error: "Error verificando ID" })
  if (data) return res.status(409).json({ error: "ID ya está en uso" })
  const success = await guardarUsuario({
    id,
    nombre,
    fecha: new Date().toISOString(),
    baneado: false,
    coins: 0,
    avatar: null,
    bio: null,
    edad: null,
    apellido: null,
    genero: null,
    insignia: null,
    rol: "usuario"
  })
  success ? res.json({ success: true }) : res.status(500).json({ error: "Error al guardar en Supabase" })
})

// Obtener lista de usuarios
app.get("/usuarios", async (req, res) => {
  const users = await leerUsuarios()
  res.json(users)
})

// Obtener usuario por ID (para perfil público)
app.get("/usuarios/:id", async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase.from("usuarios").select("*").eq("id", id).single()
  if (error || !data) return res.status(404).json({ error: "Usuario no encontrado" })
  res.json(data)
})

// Actualizar perfil de usuario (incluye insignia y titular)
app.patch("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, avatar, bio, edad, apellido, genero, insignia, titular } = req.body;
  const { error } = await supabase.from("usuarios").update({
    nombre, avatar, bio, edad, apellido, genero, insignia, titular
  }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
})

// Banear usuario (solo Admin o superior)
app.post("/ban", verifyToken, requireRole(["owner", "admin_senior", "admin"]), async (req, res) => {
  const { id } = req.body
  const { error } = await supabase.from("usuarios").update({ baneado: true }).eq("id", id)
  res.json({ success: !error })
})

// Desbanear usuario (solo Admin o superior)
app.post("/unban", verifyToken, requireRole(["owner", "admin_senior", "admin"]), async (req, res) => {
  const { id } = req.body
  const { error } = await supabase.from("usuarios").update({ baneado: false }).eq("id", id)
  res.json({ success: !error })
})

// Verificar si un usuario está baneado
app.post("/check-banned", async (req, res) => {
  const { id } = req.body
  const { data, error } = await supabase.from("usuarios").select("baneado").eq("id", id).single()
  if (error || !data) return res.json({ banned: false })
  res.json({ banned: data.baneado === true })
})

// Obtener monedas del usuario
app.get("/api/user/coins", async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) {
      return res.status(400).json({ error: "userId es requerido" })
    }
    const { data, error } = await supabase.from("usuarios").select("coins").eq("id", userId).single()
    if (error || !data) {
      return res.json({ coins: 0 })
    }
    res.json({ coins: data.coins || 0 })
  } catch (error) {
    console.error("Error obteniendo monedas:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Actualizar monedas del usuario (solo Admin o superior)
// ...existing code...
// Transferir monedas entre usuarios (requiere token del donante)
app.post("/api/user/coins/transfer", verifyToken, async (req, res) => {
  try {
    const { fromUserId, toUserId, amount, message } = req.body;
    const amt = parseInt(amount, 10);
    if (!fromUserId || !toUserId || !Number.isInteger(amt) || amt <= 0) {
      return res.status(400).json({ error: "fromUserId, toUserId y amount positivos son requeridos" });
    }
    // solo el propio usuario puede iniciar la transferencia (o admins en caso)
    if (req.user.userId !== fromUserId && !["owner","admin_senior","admin"].includes(req.user.rol)) {
      return res.status(403).json({ error: "No autorizado para transferir desde este usuario" });
    }

    // Leer sender y receiver
    const { data: sender, error: sErr } = await supabase.from("usuarios").select("coins").eq("id", fromUserId).single();
    const { data: receiver, error: rErr } = await supabase.from("usuarios").select("coins").eq("id", toUserId).maybeSingle();

    if (sErr || !sender) return res.status(404).json({ error: "Donante no encontrado" });
    if (sender.coins === null || sender.coins === undefined) sender.coins = 0;
    if (sender.coins < amt) return res.status(400).json({ error: "Fondos insuficientes" });

    // Actualizar balances (no es transacción atómica, pero suficiente para uso normal)
    const newSender = Math.max(0, sender.coins - amt);
    const { error: updS } = await supabase.from("usuarios").update({ coins: newSender, updated_at: new Date().toISOString() }).eq("id", fromUserId);
    if (updS) {
      console.error("Error actualizando donante:", updS);
      return res.status(500).json({ error: "Error actualizando donante" });
    }

    // Si no existe receptor, no crear cuenta aquí; devolver error si no existe
    if (!receiver) {
      // revertir donante
      await supabase.from("usuarios").update({ coins: sender.coins }).eq("id", fromUserId);
      return res.status(404).json({ error: "Usuario receptor no encontrado" });
    }
    const newReceiver = (receiver.coins || 0) + amt;
    const { error: updR } = await supabase.from("usuarios").update({ coins: newReceiver, updated_at: new Date().toISOString() }).eq("id", toUserId);
    if (updR) {
      // intentar revertir sender (best-effort)
      await supabase.from("usuarios").update({ coins: sender.coins }).eq("id", fromUserId);
      console.error("Error actualizando receptor:", updR);
      return res.status(500).json({ error: "Error actualizando receptor" });
    }

    // Guardar notificación al receptor (incluye mensaje opcional del donante)
    const note = {
      user_id: toUserId,
      from_user: fromUserId,
      type: "donation",
      amount: amt,
      // si client envía 'message', lo guardamos y lo mostramos en la notificación
      message: message && String(message).trim().slice(0, 2000) ? String(message).trim().slice(0, 2000) : `${fromUserId} te ha donado ${amt} monedas`,
      read: false,
      created_at: new Date().toISOString()
    };
    await supabase.from("notificaciones").insert([note]);

    res.json({ success: true, coins: newSender });
  } catch (err) {
    console.error("/api/user/coins/transfer error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
// ...existing code...

// Obtener datos de la tienda del usuario
app.get("/api/user/shop", async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) {
      return res.status(400).json({ error: "userId es requerido" })
    }
    const { data, error } = await supabase.from("user_shop_data").select("shop_data").eq("user_id", userId).single()
    if (error || !data) {
      const { error: insertError } = await supabase.from("user_shop_data").insert([
        {
          user_id: userId,
          shop_data: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      if (insertError) {
        console.error("Error creando datos de tienda:", insertError)
      }
      return res.json({ shopData: {} })
    }
    res.json({ shopData: data.shop_data || {} })
  } catch (error) {
    console.error("Error obteniendo datos de tienda:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// Actualizar datos de la tienda del usuario (solo Admin Senior o superior)
app.post("/api/user/shop", verifyToken, requireRole(["owner", "admin_senior"]), async (req, res) => {
  try {
    const { userId, shopData } = req.body
    if (!userId || !shopData) {
      return res.status(400).json({ error: "userId y shopData son requeridos" })
    }
    const { data: existingData } = await supabase.from("user_shop_data").select("id").eq("user_id", userId).single()
    if (existingData) {
      const { error } = await supabase
        .from("user_shop_data")
        .update({
          shop_data: shopData,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
      if (error) {
        console.error("Error actualizando datos de tienda:", error)
        return res.status(500).json({ error: "Error actualizando datos de tienda" })
      }
    } else {
      const { error } = await supabase.from("user_shop_data").insert([
        {
          user_id: userId,
          shop_data: shopData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      if (error) {
        console.error("Error creando datos de tienda:", error)
        return res.status(500).json({ error: "Error creando datos de tienda" })
      }
    }
    res.json({ success: true })
  } catch (error) {
    console.error("Error guardando datos de tienda:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

// --- SISTEMA DE AMIGOS ---
// Enviar solicitud de amistad
app.post("/amigos/solicitar", async (req, res) => {
  const { de, para, mensaje = "" } = req.body;
  if (!de || !para || de === para) return res.status(400).json({ error: "Datos inválidos" });
  // Verifica si ya existe una solicitud pendiente o amistad
  const { data: existente } = await supabase
    .from("amigos")
    .select("*")
    .or(`and(de.eq.${de},para.eq.${para}),and(de.eq.${para},para.eq.${de})`)
    .in("estado", ["pendiente", "aceptado"])
    .maybeSingle();
  if (existente) return res.status(409).json({ error: "Ya existe una solicitud o amistad" });
  const { error } = await supabase.from("amigos").insert([{ de, para, estado: "pendiente", mensaje, fecha: new Date().toISOString() }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Listar solicitudes recibidas
app.get("/amigos/solicitudes/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("amigos")
    .select("*")
    .eq("para", userId)
    .eq("estado", "pendiente");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Listar amigos (aceptados)
app.get("/amigos/lista/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("amigos")
    .select("*")
    .or(`de.eq.${userId},para.eq.${userId}`)
    .eq("estado", "aceptado");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Aceptar/rechazar solicitud
app.post("/amigos/responder", async (req, res) => {
  const { id, aceptar } = req.body;
  if (!id) return res.status(400).json({ error: "ID requerido" });
  const { error } = await supabase
    .from("amigos")
    .update({ estado: aceptar ? "aceptado" : "rechazado" })
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Eliminar amigo
app.post("/amigos/eliminar", async (req, res) => {
  const { userId, amigoId } = req.body;
  if (!userId || !amigoId) return res.status(400).json({ error: "Datos requeridos" });
  const { error } = await supabase
    .from("amigos")
    .delete()
    .or(`and(de.eq.${userId},para.eq.${amigoId}),and(de.eq.${amigoId},para.eq.${userId})`)
    .eq("estado", "aceptado");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- SISTEMA DE MENSAJERÍA ENTRE AMIGOS ---

// Enviar mensaje a un amigo
app.post("/amigos/mensaje", async (req, res) => {
  const { de, para, texto, token } = req.body;
  if (!de || !para || !texto || !token) return res.status(400).json({ error: "Datos requeridos" });
  // Verifica que sean amigos
  const { data: amistad } = await supabase
    .from("amigos")
    .select("*")
    .or(`and(de.eq.${de},para.eq.${para}),and(de.eq.${para},para.eq.${de})`)
    .eq("estado", "aceptado")
    .maybeSingle();
  if (!amistad) return res.status(403).json({ error: "No son amigos" });
  // Insertar mensaje
  const { error } = await supabase.from("mensajes").insert([{
    de, para, texto, fecha: new Date().toISOString(), leido: false
  }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Obtener mensajes entre dos usuarios (chat)
app.get("/amigos/mensajes/:amigoId", async (req, res) => {
  const userId = req.query.user || req.headers["x-user-id"];
  const { amigoId } = req.params;
  if (!userId || !amigoId) return res.status(400).json({ error: "Datos requeridos" });
  const { data, error } = await supabase
    .from("mensajes")
    .select("*")
    .or(`and(de.eq.${userId},para.eq.${amigoId}),and(de.eq.${amigoId},para.eq.${userId})`)
    .order("fecha", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  // Marcar como leídos los mensajes recibidos
  await supabase.from("mensajes")
    .update({ leido: true })
    .eq("para", userId)
    .eq("de", amigoId)
    .eq("leido", false);
  res.json(data || []);
});

// Obtener mensajes nuevos (no leídos) para notificaciones
app.get("/amigos/mensajes/nuevos", async (req, res) => {
  const userId = req.query.user;
  if (!userId) return res.status(400).json({ error: "user es requerido" });
  const { data, error } = await supabase
    .from("mensajes")
    .select("*")
    .eq("para", userId)
    .eq("leido", false)
    .order("fecha", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  // Incluir nombre del remitente
  for (const msg of data) {
    const { data: userData } = await supabase.from("usuarios").select("nombre").eq("id", msg.de).single();
    msg.de_nombre = userData?.nombre || msg.de;
  }
  res.json(data || []);
});

app.post("/ban", verifyToken, requireRole(["owner", "admin_senior", "admin"]), async (req, res) => {
  const { id, motivo } = req.body;
  const { error } = await supabase.from("usuarios").update({ baneado: true, motivo_ban: motivo || null }).eq("id", id);
  res.json({ success: !error });
});

// Poner advertencia (solo admin)
app.post("/usuarios/:id/advertencia", verifyToken, requireRole(["owner", "admin_senior", "admin"]), async (req, res) => {
  const { id } = req.params;
  const { advertencia } = req.body;
  const { error } = await supabase.from("usuarios").update({ advertencia }).eq("id", id);
  res.json({ success: !error });
});

// Limpiar advertencia (cuando el usuario la acepta)
app.post("/usuarios/:id/limpiar-advertencia", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("usuarios").update({ advertencia: null }).eq("id", id);
  res.json({ success: !error });
});

// Solicitar relación
app.post("/relaciones/solicitar", async (req, res) => {
  const { de, para, tipo } = req.body;
  if (!de || !para || !tipo || de === para) return res.status(400).json({ error: "Datos inválidos" });
  // Verifica si ya existe una relación pendiente o aceptada
  const { data: existente } = await supabase
    .from("relaciones")
    .select("*")
    .or(`and(de.eq.${de},para.eq.${para}),and(de.eq.${para},para.eq.${de})`)
    .in("estado", ["pendiente", "aceptada"])
    .maybeSingle();
  if (existente) return res.status(409).json({ error: "Ya existe una relación o solicitud" });
  const { error } = await supabase.from("relaciones").insert([{ de, para, tipo, estado: "pendiente", fecha: new Date().toISOString() }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Listar solicitudes recibidas
app.get("/relaciones/solicitudes/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("relaciones")
    .select("*")
    .eq("para", userId)
    .eq("estado", "pendiente");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Listar relaciones aceptadas
app.get("/relaciones/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("relaciones")
    .select("*")
    .or(`de.eq.${userId},para.eq.${userId}`)
    .eq("estado", "aceptada");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Aceptar/rechazar relación
app.post("/relaciones/responder", async (req, res) => {
  const { id, aceptar } = req.body;
  if (!id) return res.status(400).json({ error: "ID requerido" });
  const { error } = await supabase
    .from("relaciones")
    .update({ estado: aceptar ? "aceptada" : "rechazada" })
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- MODIFICAR verify-token para auto-unban y chequeo ---
app.get("/verify-token", verifyToken, async (req, res) => {
  try {
    // intento de auto-unban si expiró
    await autoUnbanIfExpired(req.user.userId);

    // volver a leer usuario para estado actualizado
    const { data: user, error } = await supabase.from('usuarios').select('id, nombre, baneado, ban_until, rol, numero').eq('id', req.user.userId).single();
    if (error || !user) return res.status(401).json({ valid: false });
    if (user.baneado) {
      const remaining = user.ban_until ? Math.max(0, new Date(user.ban_until) - new Date()) : null;
      return res.status(403).json({ valid: false, banned: true, remainingMs: remaining || null });
    }
    // If the user does not yet have a sequential `numero`, assign one now.
    if (!user.numero) {
      try {
        const { data: lastRows, error: lastErr } = await supabase.from('usuarios').select('numero').order('numero', { ascending: false }).limit(1);
        if (lastErr) console.warn('Could not read last numero', lastErr.message);
        const lastNum = Array.isArray(lastRows) && lastRows.length ? (lastRows[0].numero || 0) : 0;
        const nextNum = (lastNum || 0) + 1;
        const { error: updErr } = await supabase.from('usuarios').update({ numero: nextNum }).eq('id', user.id);
        if (updErr) console.warn('Could not update user numero on verify-token', updErr.message);
        // update local user object for response
        user.numero = nextNum;
      } catch (e) {
        console.warn('assign numero on verify failed', e);
      }
    }
    // Actualizar last_seen en cada verificación
    await supabase.from("usuarios").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
    console.log(`Updated last_seen for user ${user.id} on verify-token`);
    res.json({
      valid: true,
      user: { id: user.id, name: user.nombre, rol: user.rol || 'usuario' },
    })
  } catch (err) {
    console.error('verify-token error', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
})

// --- EXTENDER endpoint /ban para soportar baneo temporal ---
// Reemplaza o agrega esta versión (ya tienes /ban; esta versión acepta durationMinutes o until)
app.post("/ban", verifyToken, requireRole(["owner", "admin_senior", "admin"]), async (req, res) => {
  try {
    const { id, motivo, durationMinutes, until } = req.body;
    if (!id) return res.status(400).json({ error: "id requerido" });

    let ban_until = null;
    if (until) {
      // aceptar fecha ISO o timestamp
      const d = new Date(until);
      if (!isNaN(d.getTime())) ban_until = d.toISOString();
    } else if (durationMinutes) {
      const mins = parseInt(durationMinutes, 10);
      if (!isNaN(mins) && mins > 0) {
        ban_until = new Date(Date.now() + mins * 60 * 1000).toISOString();
      }
    }

    const updateObj = { baneado: true, motivo_ban: motivo || null };
    if (ban_until) updateObj.ban_until = ban_until;

    const { error } = await supabase.from("usuarios").update(updateObj).eq("id", id);
    if (error) {
      console.error('Error banning user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // If request includes a notice payload, create a site notice that clients can fetch
    try{
      const { notice_message, notice_type, notice_expires_at } = req.body;
      if (notice_message && String(notice_message).trim().length){
        const noticeObj = {
          message: String(notice_message).slice(0,1000),
          type: (notice_type && ['info','warning','critical'].includes(String(notice_type))) ? String(notice_type) : 'info',
          created_by: req.user && req.user.userId ? req.user.userId : null,
          target_user: id || null,
          expires_at: notice_expires_at || null,
          active: true
        };
        const { error: noticeErr } = await supabase.from('notices').insert([noticeObj]);
        if (noticeErr) console.warn('Failed to create notice for ban:', noticeErr);
      }
    }catch(e){ console.warn('notice insert failed', e); }

    res.json({ success: true, ban_until: ban_until || null });
  } catch (err) {
    console.error('/ban error', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
})

// Create a site notice (info/warning/critical)
app.post('/api/anuncios', verifyToken, requireRole(['owner','admin_senior','admin']), async (req, res) => {
  try{
    const { title, message, type = 'info', expires_at = null } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ error: 'message is required' });
    const mType = ['info','warning','critical'].includes(String(type)) ? String(type) : 'info';
    const insertObj = { 
      title: title ? String(title).slice(0,500) : 'Sin título',
      message: String(message).slice(0,1000), 
      type: mType, 
      created_by: req.user && req.user.userId ? req.user.userId : null, 
      expires_at: expires_at || null, 
      active: true 
    };
    const { data, error } = await supabase.from('anuncios').insert([insertObj]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, notice: data });
  }catch(e){ console.error('create notice error', e); res.status(500).json({ error: 'Error interno del servidor' }); }
});

// List active notices (for clients). Returns notices not expired and active.
app.get('/api/anuncios', async (req, res) => {
  try{
    const { data, error } = await supabase.from('anuncios').select('*').eq('active', true).order('created_at', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: error.message });
    const now = new Date().toISOString();
    const filtered = (data || []).filter(n => (!n.expires_at || n.expires_at > now));
    res.json(filtered);
  }catch(e){ console.error('list notices error', e); res.status(500).json({ error: 'Error interno del servidor' }); }
});

// --- EXTENDER /unban para limpiar ban_until y motivo ---
app.post("/unban", verifyToken, requireRole(["owner", "admin_senior", "admin"]), async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id requerido" });
    const { error } = await supabase.from("usuarios").update({ baneado: false, ban_until: null, motivo_ban: null }).eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('/unban error', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ajustar monedas por delta (solo propio usuario o admin)
app.post("/api/user/coins/adjust", verifyToken, async (req, res) => {
  try {
    const { userId, delta } = req.body;
    if (!userId || typeof delta !== "number") return res.status(400).json({ error: "userId y delta son requeridos" });

    // Permitir si el token pertenece al usuario o si es admin/owner/admin_senior
    if (req.user.userId !== userId && !["owner", "admin_senior", "admin"].includes(req.user.rol)) {
      return res.status(403).json({ error: "No tienes permisos para modificar esas monedas" });
    }

    // Leer valor actual
    const { data, error: selectErr } = await supabase.from("usuarios").select("coins").eq("id", userId).single();
    if (selectErr) return res.status(500).json({ error: selectErr.message });

    const current = (data && typeof data.coins === "number") ? data.coins : 0;
    const newCoins = Math.max(0, current + delta);

    const { error: updateErr } = await supabase.from("usuarios").update({ coins: newCoins, updated_at: new Date().toISOString() }).eq("id", userId);
    if (updateErr) return res.status(500).json({ error: updateErr.message });

    res.json({ success: true, coins: newCoins });
  } catch (err) {
    console.error("/api/user/coins/adjust error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

  // Compra de tienda: deducir monedas y guardar en user_shop_data (usuario propio o admin)
app.post("/api/user/shop/purchase", verifyToken, async (req, res) => {
  try {
    const { userId, type, itemId, price } = req.body;
    if (!userId || !type || !itemId || typeof price !== "number") {
      return res.status(400).json({ error: "userId, type, itemId y price son requeridos" });
    }

    // solo propio usuario o admins pueden forzar compra
    if (req.user.userId !== userId && !["owner", "admin_senior", "admin"].includes(req.user.rol)) {
      return res.status(403).json({ error: "No tienes permiso para comprar a nombre de este usuario" });
    }

    // leer monedas actuales
    const { data: userRow, error: userErr } = await supabase
      .from("usuarios")
      .select("coins")
      .eq("id", userId)
      .single();
    if (userErr) {
      console.error("Error leyendo usuario para compra:", userErr);
      return res.status(500).json({ error: "Error leyendo usuario" });
    }
    const currentCoins = Number(userRow?.coins || 0);
    if (currentCoins < price) {
      return res.status(400).json({ error: "No tienes suficientes monedas" });
    }

    // leer datos de tienda del usuario (si no existe, se crea más abajo)
    const { data: shopRow, error: shopErr } = await supabase
      .from("user_shop_data")
      .select("id, shop_data")
      .eq("user_id", userId)
      .maybeSingle();
    if (shopErr) {
      console.error("Error leyendo user_shop_data:", shopErr);
      return res.status(500).json({ error: "Error leyendo datos de tienda" });
    }
    const shopData = shopRow?.shop_data || {};

    // estructura: shopData.themes / .badges / .games -> arrays
    shopData[type] = Array.isArray(shopData[type]) ? shopData[type] : [];

    if (shopData[type].includes(itemId)) {
      return res.status(409).json({ error: "Item ya adquirido" });
    }

    // deducir monedas y actualizar usuario
    const newCoins = Math.max(0, currentCoins - price);
    const { error: updateUserErr } = await supabase
      .from("usuarios")
      .update({ coins: newCoins, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateUserErr) {
      console.error("Error actualizando monedas:", updateUserErr);
      return res.status(500).json({ error: "Error actualizando monedas" });
    }

    // agregar item a shopData y guardar (insertar o actualizar)
    shopData[type].push(itemId);
    if (shopRow && shopRow.id) {
      const { error: updShopErr } = await supabase
        .from("user_shop_data")
        .update({ shop_data: shopData, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (updShopErr) {
        console.error("Error actualizando user_shop_data:", updShopErr);
        // intentar revertir monedas (best-effort)
        await supabase.from("usuarios").update({ coins: currentCoins }).eq("id", userId);
        return res.status(500).json({ error: "Error guardando compra" });
      }
    } else {
      const { error: insShopErr } = await supabase
        .from("user_shop_data")
        .insert([{ user_id: userId, shop_data: shopData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      if (insShopErr) {
        console.error("Error insertando user_shop_data:", insShopErr);
        await supabase.from("usuarios").update({ coins: currentCoins }).eq("id", userId);
        return res.status(500).json({ error: "Error guardando compra" });
      }
    }

    res.json({ success: true, coins: newCoins, shopData });
  } catch (err) {
    console.error("/api/user/shop/purchase error", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Transferir monedas entre usuarios (requiere token del donante)
app.post("/api/user/coins/transfer", verifyToken, async (req, res) => {
  try {
    const { fromUserId, toUserId, amount } = req.body;
    const amt = parseInt(amount, 10);
    if (!fromUserId || !toUserId || !Number.isInteger(amt) || amt <= 0) {
      return res.status(400).json({ error: "fromUserId, toUserId y amount positivos son requeridos" });
    }
    // solo el propio usuario puede iniciar la transferencia (o admins en caso)
    if (req.user.userId !== fromUserId && !["owner","admin_senior","admin"].includes(req.user.rol)) {
      return res.status(403).json({ error: "No autorizado para transferir desde este usuario" });
    }

    // Leer sender y receiver
    const { data: sender, error: sErr } = await supabase.from("usuarios").select("coins").eq("id", fromUserId).single();
    const { data: receiver, error: rErr } = await supabase.from("usuarios").select("coins").eq("id", toUserId).maybeSingle();

    if (sErr || !sender) return res.status(404).json({ error: "Donante no encontrado" });
    if (sender.coins === null || sender.coins === undefined) sender.coins = 0;
    if (sender.coins < amt) return res.status(400).json({ error: "Fondos insuficientes" });

    // Actualizar balances (no es transacción atómica, pero suficiente para uso normal)
    const newSender = Math.max(0, sender.coins - amt);
    const { error: updS } = await supabase.from("usuarios").update({ coins: newSender, updated_at: new Date().toISOString() }).eq("id", fromUserId);
    if (updS) {
      console.error("Error actualizando donante:", updS);
      return res.status(500).json({ error: "Error actualizando donante" });
    }

    // Si no existe receptor, no crear cuenta aquí; devolver error si no existe
    if (!receiver) {
      // revertir donante
      await supabase.from("usuarios").update({ coins: sender.coins }).eq("id", fromUserId);
      return res.status(404).json({ error: "Usuario receptor no encontrado" });
    }
    const newReceiver = (receiver.coins || 0) + amt;
    const { error: updR } = await supabase.from("usuarios").update({ coins: newReceiver, updated_at: new Date().toISOString() }).eq("id", toUserId);
    if (updR) {
      // intentar revertir sender (best-effort)
      await supabase.from("usuarios").update({ coins: sender.coins }).eq("id", fromUserId);
      console.error("Error actualizando receptor:", updR);
      return res.status(500).json({ error: "Error actualizando receptor" });
    }

    // Guardar notificación al receptor
    const note = {
      user_id: toUserId,
      from_user: fromUserId,
      type: "donation",
      amount: amt,
      message: `${fromUserId} te ha donado ${amt} monedas`,
      read: false,
      created_at: new Date().toISOString()
    };
    await supabase.from("notificaciones").insert([note]);

    res.json({ success: true, coins: newSender });
  } catch (err) {
    console.error("/api/user/coins/transfer error", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Obtener notificaciones de un usuario (lectura)
app.get("/api/notifications/:userId", verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "userId requerido" });
    if (req.user.userId !== userId && !["owner","admin_senior","admin"].includes(req.user.rol)) {
      return res.status(403).json({ error: "No autorizado" });
    }
    const { data, error } = await supabase.from("notificaciones").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ notifications: data || [] });
  } catch (err) {
    console.error("/api/notifications error", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Marcar notificación como leída
app.post("/api/notifications/mark-read", verifyToken, async (req, res) => {
  try {
    const { id, userId } = req.body;
    if (!id || !userId) return res.status(400).json({ error: "id y userId requeridos" });
    if (req.user.userId !== userId && !["owner","admin_senior","admin"].includes(req.user.rol)) {
      return res.status(403).json({ error: "No autorizado" });
    }
    const { error } = await supabase.from("notificaciones").update({ read: true }).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error("/api/notifications/mark-read error", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// ...existing code...

// Replace existing /report-user handler with this improved version
app.post("/report-user", verifyToken, async (req, res) => {
  try {
    const { reportedId, reason } = req.body;
    const reporterId = req.user.userId;

    if (!reportedId || !reason || String(reason).trim().length === 0) {
      return res.status(400).json({ error: "ID del usuario reportado y motivo son requeridos" });
    }

    if (reporterId === reportedId) {
      return res.status(400).json({ error: "No puedes reportarte a ti mismo" });
    }

    // Verificar existencia del usuario reportado (opcional)
    const { data: reportedUser, error: checkErr } = await supabase
      .from("usuarios")
      .select("id, nombre")
      .eq("id", reportedId)
      .maybeSingle();

    if (checkErr) {
      console.error("Error verificando usuario reportado:", checkErr);
      return res.status(500).json({ error: "Error verificando usuario reportado" });
    }
    if (!reportedUser) {
      return res.status(404).json({ error: "Usuario reportado no encontrado" });
    }

    // Inserta reporte en tabla 'report-user' con campos que existen
    const insertObj = {
      reporter_id: reporterId,
      reason: String(reason).trim().slice(0, 2000),
      status: "pending"
    };

    const { data, error: insertErr } = await supabase
      .from("report-user")
      .insert([insertObj])
      .select()
      .single();

    if (insertErr) {
      console.error("Error guardando reporte:", insertErr);
      return res.status(500).json({ error: "Error guardando reporte" });
    }

    res.json({ success: true, report: data });
  } catch (err) {
    console.error("Error en reporte de usuario:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ...existing code...

// Nueva ruta: obtener reportes creados por el usuario (reporter) — requiere token
app.get("/reports/mine", verifyToken, async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const { data, error } = await supabase
      .from("user_reports")
      .select(`
        *,
        reported:reported_id(id, nombre),
        reviewer:reviewed_by(id, nombre)
      `)
      .eq("reporter_id", reporterId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error obteniendo reportes del usuario:", error);
      return res.status(500).json({ error: "Error obteniendo reportes" });
    }
    res.json(data || []);
  } catch (err) {
    console.error("Error en /reports/mine:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ...existing code...
// Nuevo endpoint: reportar bug de juego
app.post('/report-bug', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let reporter = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        reporter = decoded.userId || null;
      } catch (e) {
        // token inválido -> reporter queda null
      }
    }
    const { gameId, description, steps, screenshot } = req.body;
    if (!description || !description.trim()) return res.status(400).json({ error: 'description required' });

    const insertObj = {
      game_id: gameId || null,
      reporter_id: reporter,
      description: String(description).slice(0, 4000),
      steps: steps ? String(steps).slice(0, 4000) : null,
      screenshot_url: screenshot || null,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { error, data } = await supabase.from('bug_reports').insert([insertObj]).select().single();
    if (error) {
      console.error('Error inserting bug report:', error);
      return res.status(500).json({ error: 'Error saving report' });
    }
    res.json({ success: true, id: data.id, report: data });
  } catch (err) {
    console.error('/report-bug error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ...existing code...

// Utilidades para la tabla 'astralgeneral'
async function readMaintenanceFlag() {
  // intenta leer la fila singleton (id = 1)
  const { data, error } = await supabase.from('astralgeneral').select('maintenance, message, maintenance_until, updated_at').eq('id', 1).maybeSingle();
  if (error) {
    console.error('Error leyendo astralgeneral:', error);
    return { maintenance: false };
  }
  return data || { maintenance: false, message: null, maintenance_until: null };
}

// Endpoint público: obtener estado de mantenimiento
app.get('/maintenance', async (req, res) => {
  try {
    const info = await readMaintenanceFlag();
    res.json({
      maintenance: !!info.maintenance,
      message: info.message || null,
      until: info.maintenance_until || null,
      updated_at: info.updated_at || null
    });
  } catch (e) {
    console.error('/maintenance error', e);
    res.status(500).json({ maintenance: false, error: 'Error interno' });
  }
});

// Endpoint administrativo: activar/desactivar mantenimiento
// Requiere token y rol owner/admin_senior (o admin)
app.post('/maintenance', verifyToken, requireRole(['owner','admin_senior','admin']), async (req, res) => {
  try {
    const { enabled, message, until } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) es requerido' });

    // Construir objeto con id singleton = 1
    const row = {
      id: 1,
      maintenance: enabled,
      message: message || null,
      maintenance_until: until || null,
      updated_at: new Date().toISOString()
    };

    // Upsert (insert/update) en Supabase
    const { error } = await supabase.from('astralgeneral').upsert([row], { onConflict: 'id' });
    if (error) {
      console.error('/maintenance upsert error', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, maintenance: enabled, message: row.message, until: row.maintenance_until });
  } catch (err) {
    console.error('/maintenance error', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get("/api/game-alerts/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const { data, error } = await supabase
    .from("game_alerts")
    .select("*")
    .eq("game_id", gameId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ alerts: data || [] });
});

app.post("/api/game-alerts", verifyToken, requireRole(["owner","admin_senior","admin"]), async (req, res) => {
  const { game_id, alert_type, message, min_age } = req.body;
  if (!game_id || !alert_type || !message) return res.status(400).json({ error: "Faltan datos" });
  const { error } = await supabase.from("game_alerts").insert([{
    game_id, alert_type, message, min_age: min_age || null, created_at: new Date().toISOString()
  }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Logout: marcar como offline (no necesario con last_seen, pero opcional)
app.post("/logout", verifyToken, async (req, res) => {
  // Opcional: no hacer nada, ya que offline se calcula por last_seen
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT} y conectada a Supabase`)
})
