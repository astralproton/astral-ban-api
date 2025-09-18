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
      "https://astralproton.github.io/astral",
      "https://v0.dev",
    ],
    credentials: true,
  }),
)
app.use(express.json())

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "astral-secret-key-2024"

// Conexión con Supabase
const SUPABASE_URL = "https://szojjdcfphaawixewnkm.supabase.co"
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6b2pqZGNmcGhhYXdpeGV3bmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MjUyNjMsImV4cCI6MjA2NzEwMTI2M30.EPRv9BOmT_iARe_D1tXBzLjJOP_92xLIOzv3ePLlSeg"
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

// Rutas
app.get("/", (req, res) => {
  res.send("🚀 API Astral conectada a Supabase con autenticación")
})

// NUEVOS ENDPOINTS DE AUTENTICACIÓN

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

    // Crear usuario
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
    })

    if (success) {
      // Generar token JWT
      const token = jwt.sign({ userId: username, name: name }, JWT_SECRET, { expiresIn: "7d" })

      res.json({
        success: true,
        token,
        user: { id: username, name: name },
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
      .select("id, nombre, password, baneado")
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

    // Generar token JWT
    const token = jwt.sign({ userId: user.id, name: user.nombre }, JWT_SECRET, { expiresIn: "7d" })

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.nombre },
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
    user: { id: req.user.userId, name: req.user.name },
  })
})

// ENDPOINTS EXISTENTES (mantenidos)

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
  })

  success ? res.json({ success: true }) : res.status(500).json({ error: "Error al guardar en Supabase" })
})

// Obtener lista de usuarios
app.get("/usuarios", async (req, res) => {
  const users = await leerUsuarios()
  res.json(users)
})

// Actualizar perfil de usuario (NUEVO)
app.patch("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, avatar, bio, edad, apellido, genero } = req.body;
  const { error } = await supabase.from("usuarios").update({
    nombre, avatar, bio, edad, apellido, genero
  }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
})

// Banear usuario
app.post("/ban", async (req, res) => {
  const { id } = req.body
  const { error } = await supabase.from("usuarios").update({ baneado: true }).eq("id", id)

  res.json({ success: !error })
})

// Desbanear usuario
app.post("/unban", async (req, res) => {
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

// Actualizar monedas del usuario
app.post("/api/user/coins", async (req, res) => {
  try {
    const { userId, coins } = req.body

    if (!userId || coins === undefined) {
      return res.status(400).json({ error: "userId y coins son requeridos" })
    }

    if (typeof coins !== "number" || coins < 0) {
      return res.status(400).json({ error: "coins debe ser un número positivo" })
    }

    const { error } = await supabase
      .from("usuarios")
      .update({
        coins: coins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (error) {
      console.error("Error actualizando monedas:", error)
      return res.status(500).json({ error: "Error actualizando monedas" })
    }

    res.json({ success: true, coins: coins })
  } catch (error) {
    console.error("Error actualizando monedas:", error)
    res.status(500).json({ error: "Error interno del servidor" })
  }
})

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

// Actualizar datos de la tienda del usuario
app.post("/api/user/shop", async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`🚀 API Astral corriendo en puerto ${PORT} y conectada a Supabase`)
})
