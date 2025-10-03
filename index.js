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
  const { error } = await supabase.from("usuarios").insert([usuario])
  if (error) console.error("Error guardando usuario:", error.message)
  return !error
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

// ...[todas tus rutas de usuarios, tienda, amigos, etc. igual que antes]...

// --- SISTEMA DE MENSAJERÍA ENTRE AMIGOS ---

// Enviar mensaje a un amigo
app.post("/amigos/mensaje", async (req, res) => {
  const { de, para, texto, token } = req.body;
  if (!de || !para || !texto || !token) return res.status(400).json({ error: "Datos requeridos" });
  // Opcional: verifica que sean amigos
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
  // Solo mensajes entre ambos
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
  // Opcional: incluir nombre del remitente
  for (const msg of data) {
    const { data: userData } = await supabase.from("usuarios").select("nombre").eq("id", msg.de).single();
    msg.de_nombre = userData?.nombre || msg.de;
  }
  res.json(data || []);
});

// ...[resto de tus endpoints de usuarios, tienda, amigos, etc. igual que antes]...

app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT} y conectada a Supabase`)
})
