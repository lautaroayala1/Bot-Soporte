# ⚡ VortexSupport — Bot de Soporte Discord

Sistema completo de tickets para tiendas de cuentas digitales. Incluye verificación automática con SellAuth, historial de reemplazos, estadísticas del staff y transcripts HTML.

---

## 📋 Requisitos

- **Node.js** v18 o superior
- **npm** v8+
- Una aplicación de Discord (bot creado en el [Portal de Desarrolladores](https://discord.com/developers/applications))
- *(Opcional)* API Key de SellAuth para verificación automática

---

## 🚀 Instalación

```bash
# 1. Entra al directorio
cd VortexSupport

# 2. Instala dependencias
npm install

# 3. Crea el archivo de configuración
cp .env.example .env
```

Luego edita el archivo `.env` con tus datos (ver sección de configuración).

---

## ⚙️ Configuración — `.env`

| Variable | Descripción |
|---|---|
| `DISCORD_TOKEN` | Token del bot (Portal de Desarrolladores) |
| `CLIENT_ID` | ID de la aplicación (Pestaña "General Information") |
| `GUILD_ID` | ID de tu servidor de Discord |
| `PANEL_CHANNEL_ID` | Canal donde se publica el panel de tickets |
| `LOGS_CHANNEL_ID` | Canal privado `#staff-logs` |
| `TRANSCRIPTS_CHANNEL_ID` | Canal `#transcripts` |
| `CATEGORY_REPLACEMENTS` | ID de la categoría 📦 REEMPLAZOS |
| `CATEGORY_SUPPORT` | ID de la categoría ⚙️ SOPORTE |
| `CATEGORY_GUARANTEES` | ID de la categoría 🛡️ GARANTÍAS |
| `STAFF_ROLE_ID` | ID del rol de Staff |
| `SELLAUTH_API_KEY` | API Key de SellAuth (opcional) |
| `SELLAUTH_STORE_ID` | ID de tu tienda en SellAuth (opcional) |
| `MAX_REPLACEMENTS` | Límite de reemplazos por cliente (default: 3) |

### ¿Cómo obtener IDs en Discord?
Activa el **Modo Desarrollador** en Ajustes → Avanzado, luego haz clic derecho sobre cualquier canal, rol o servidor para copiar su ID.

---

## 🏗️ Estructura del servidor recomendada

```
📂 SOPORTE
  ├── 📦 REEMPLAZOS      ← categoría (CATEGORY_REPLACEMENTS)
  ├── ⚙️ SOPORTE          ← categoría (CATEGORY_SUPPORT)
  └── 🛡️ GARANTÍAS        ← categoría (CATEGORY_GUARANTEES)

📂 STAFF
  ├── #panel-tickets     ← donde se publica el panel (PANEL_CHANNEL_ID)
  ├── #staff-logs        ← logs privados (LOGS_CHANNEL_ID)
  └── #transcripts       ← archivos HTML (TRANSCRIPTS_CHANNEL_ID)
```

---

## ▶️ Iniciar el bot

```bash
# Paso 1: Registrar los comandos slash (solo la primera vez o cuando añadas nuevos)
npm run deploy

# Paso 2: Iniciar el bot
npm start

# Alternativa para desarrollo (con hot reload)
npm run dev
```

---

## 🎛️ Comandos disponibles

| Comando | Descripción | Requiere |
|---|---|---|
| `/panel` | Publica el panel de tickets en el canal actual | Admin |
| `/claim` | Reclama el ticket del canal actual | Staff |
| `/unclaim` | Libera el ticket actual | Staff (quien lo reclamó) |
| `/close` | Cierra el ticket y genera el transcript | Staff |
| `/replacement delivered` | Marca el reemplazo como entregado | Staff |
| `/replacement denied` | Deniega el reemplazo | Staff |
| `/verify <email> <producto>` | Verifica manualmente una compra | Staff |
| `/stats [usuario]` | Muestra estadísticas de un miembro del staff | Staff |
| `/topstaff` | Leaderboard del staff | Staff |
| `/adduser <usuario>` | Agrega un usuario al ticket | Staff |
| `/removeuser <usuario>` | Remueve un usuario del ticket | Staff |

---

## 🔄 Flujo completo de un ticket

```
Cliente entra al servidor
        ↓
Usa el menú desplegable en #panel-tickets
        ↓
Completa el formulario modal
        ↓
[Solo reemplazos] Verificación automática con SellAuth
        ↓
Canal creado (ej: replacement-1521)
        ↓
Staff hace /claim
        ↓
Resuelve el problema
        ↓
[Reemplazos] /replacement delivered o /replacement denied
        ↓
/close → genera transcript HTML → sube a #transcripts
        ↓
Canal eliminado automáticamente
```

---

## 🗄️ Base de datos

SQLite en `data/vortex.db`. Tablas:

| Tabla | Descripción |
|---|---|
| `users` | Usuarios de Discord |
| `tickets` | Todos los tickets |
| `ticket_forms` | Campos de los formularios |
| `replacement_history` | Historial de reemplazos por email |
| `staff_stats` | Estadísticas del staff |
| `ticket_claims` | Registro de claims |
| `ticket_logs` | Log completo de acciones |
| `ticket_counters` | Contadores de tickets por tipo |

---

## 🛡️ Anti-abuso

Si un cliente supera `MAX_REPLACEMENTS` reemplazos entregados con el mismo email:
1. El ticket se crea igualmente
2. Se envía una alerta con `@Staff` en el canal del ticket
3. Se registra en `#staff-logs`
4. Se requiere revisión manual antes de proceder

---

## 🌐 SellAuth

Si no configurás la API Key, el bot opera en **modo simulación**: verifica automáticamente emails de dominios comunes (gmail, hotmail, outlook, yahoo).

Para activar la verificación real:
1. Entra a tu panel de SellAuth
2. Ve a Settings → API
3. Copia tu API Key y Store ID al `.env`

---

## 📄 Transcripts HTML

Al cerrar un ticket se genera un archivo `.html` con:
- Información completa del ticket (cliente, email, producto, tipo, moderador)
- Fecha de apertura, cierre y duración
- Todos los mensajes con avatares, embeds y adjuntos
- Diseño oscuro profesional con branding VortexGG

El archivo se sube automáticamente a `#transcripts`.

---

## ❓ Problemas comunes

**El bot no responde a comandos**
→ Ejecutá `npm run deploy` para registrar los comandos y esperá unos minutos.

**Error "Missing Permissions"**
→ Asegurate de que el bot tenga los permisos: `Manage Channels`, `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`.

**SellAuth no verifica**
→ Verificá que `SELLAUTH_API_KEY` y `SELLAUTH_STORE_ID` sean correctos. Revisá los logs con `console.error`.

---

*VortexSupport v1.0.0 — Sistema de soporte automatizado para tiendas de cuentas digitales*
