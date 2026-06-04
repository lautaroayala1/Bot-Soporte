// src/database/database.js
const path = require('path');
const fs = require('fs');

// ---- Carga de sql.js ----
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../../data/vortex.db');
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// sql.js es asíncrono al inicializar, pero luego es síncrono.
// Usamos un patrón de inicialización lazy con promesa.
let _db = null;
let _initPromise = null;

function initDB() {
  if (_initPromise) return _initPromise;
  _initPromise = initSqlJs().then(SQL => {
    // Cargar DB existente o crear nueva
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      _db = new SQL.Database(fileBuffer);
    } else {
      _db = new SQL.Database();
    }

    // Optimizaciones
    _db.run('PRAGMA foreign_keys = ON;');

    // Crear tablas
    _db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE NOT NULL,
        discord_username TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        product TEXT NOT NULL,
        sellauth_order_id TEXT,
        purchase_date TEXT,
        verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number INTEGER NOT NULL,
        ticket_type TEXT NOT NULL,
        channel_id TEXT UNIQUE,
        discord_id TEXT NOT NULL,
        discord_username TEXT,
        email TEXT,
        product TEXT,
        status TEXT DEFAULT 'open',
        claimed_by TEXT,
        claimed_by_id TEXT,
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        duration_minutes INTEGER
      );

      CREATE TABLE IF NOT EXISTS ticket_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        field_value TEXT
      );

      CREATE TABLE IF NOT EXISTS replacement_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        product TEXT NOT NULL,
        discord_id TEXT,
        ticket_id INTEGER,
        staff_id TEXT,
        staff_username TEXT,
        status TEXT DEFAULT 'pending',
        delivery_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS staff_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE NOT NULL,
        discord_username TEXT,
        tickets_closed INTEGER DEFAULT 0,
        replacements_done INTEGER DEFAULT 0,
        support_cases INTEGER DEFAULT 0,
        guarantees_done INTEGER DEFAULT 0,
        total_duration_minutes INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        staff_id TEXT NOT NULL,
        staff_username TEXT,
        claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER,
        action TEXT NOT NULL,
        performed_by TEXT,
        performed_by_id TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_counters (
        type TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0
      );

      INSERT OR IGNORE INTO ticket_counters (type, count) VALUES ('replacement', 0);
      INSERT OR IGNORE INTO ticket_counters (type, count) VALUES ('support', 0);
      INSERT OR IGNORE INTO ticket_counters (type, count) VALUES ('guarantee', 0);
    `);

    // Limpiar tickets huérfanos (sin channel_id) que quedaron de errores previos
    const orphans = _db.exec("SELECT COUNT(*) as c FROM tickets WHERE channel_id IS NULL");
    const orphanCount = orphans[0]?.values[0][0] || 0;
    if (orphanCount > 0) {
      _db.run("DELETE FROM ticket_forms WHERE ticket_id IN (SELECT id FROM tickets WHERE channel_id IS NULL)");
      _db.run("DELETE FROM replacement_history WHERE ticket_id IN (SELECT id FROM tickets WHERE channel_id IS NULL)");
      _db.run("DELETE FROM tickets WHERE channel_id IS NULL");
      console.log(`[DB] 🧹 Limpiados ${orphanCount} ticket(s) huérfano(s) sin channel_id.`);
    }

    persist();
    console.log('[DB] Base de datos inicializada en', DB_PATH);
    return _db;
  });
  return _initPromise;
}

/** Guarda la DB en disco (llamar después de cada escritura) */
function persist() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/** Obtiene la instancia de la DB (asegurarse de llamar initDB() antes) */
function getDB() {
  if (!_db) throw new Error('DB no inicializada. Llamá initDB() primero.');
  return _db;
}

// ================================
// HELPERS
// ================================

/** Ejecuta una query que devuelve filas. Retorna array de objetos. */
function query(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** Ejecuta una query que devuelve una sola fila. */
function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

/** Ejecuta una query de escritura (INSERT/UPDATE/DELETE). */
function run(sql, params = []) {
  const db = getDB();
  // sql.js: leer last_insert_rowid() INMEDIATAMENTE tras el run(),
  // antes de cualquier otra operación, para obtener el ID correcto.
  db.run(sql, params);
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  stmt.step();
  const rowid = stmt.getAsObject().id;
  stmt.free();
  persist();
  return { lastInsertRowid: rowid || null };
}

// ================================
// FUNCIONES DE NEGOCIO
// ================================

function getNextTicketNumber(type) {
  run('UPDATE ticket_counters SET count = count + 1 WHERE type = ?', [type]);
  const row = queryOne('SELECT count FROM ticket_counters WHERE type = ?', [type]);
  return row ? row.count : 1;
}

function createTicket({ type, channelId, discordId, discordUsername, email, product }) {
  const number = getNextTicketNumber(type);
  const result = run(
    'INSERT INTO tickets (ticket_number, ticket_type, channel_id, discord_id, discord_username, email, product) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [number, type, channelId, discordId, discordUsername, email || null, product || null]
  );
  return { id: result.lastInsertRowid, number };
}

function saveTicketForm(ticketId, fields) {
  for (const [name, value] of Object.entries(fields)) {
    run('INSERT INTO ticket_forms (ticket_id, field_name, field_value) VALUES (?, ?, ?)', [ticketId, name, value]);
  }
}

function getTicketByChannel(channelId) {
  return queryOne('SELECT * FROM tickets WHERE channel_id = ?', [channelId]);
}

function getTicketById(id) {
  return queryOne('SELECT * FROM tickets WHERE id = ?', [id]);
}

function getTicketForms(ticketId) {
  return query('SELECT * FROM ticket_forms WHERE ticket_id = ?', [ticketId]);
}

function updateTicketChannel(ticketId, channelId) {
  run('UPDATE tickets SET channel_id = ? WHERE id = ?', [channelId, ticketId]);
}

function claimTicket(ticketId, staffId, staffUsername) {
  run("UPDATE tickets SET status = 'claimed', claimed_by = ?, claimed_by_id = ? WHERE id = ?", [staffUsername, staffId, ticketId]);
  run('INSERT INTO ticket_claims (ticket_id, staff_id, staff_username) VALUES (?, ?, ?)', [ticketId, staffId, staffUsername]);
}

function unclaimTicket(ticketId) {
  run("UPDATE tickets SET status = 'open', claimed_by = NULL, claimed_by_id = NULL WHERE id = ?", [ticketId]);
}

function closeTicket(ticketId, staffId, staffUsername) {
  const ticket = getTicketById(ticketId);
  if (!ticket) return null;

  const now = new Date();
  const opened = new Date(ticket.opened_at);
  const durationMinutes = Math.round((now - opened) / 60000);

  run("UPDATE tickets SET status = 'closed', closed_at = datetime('now'), duration_minutes = ? WHERE id = ?", [durationMinutes, ticketId]);
  updateStaffStats(staffId, staffUsername, ticket.ticket_type, durationMinutes);

  return { ...ticket, duration_minutes: durationMinutes };
}

function updateStaffStats(staffId, staffUsername, ticketType, durationMinutes = 0) {
  const existing = queryOne('SELECT * FROM staff_stats WHERE discord_id = ?', [staffId]);
  if (!existing) {
    run(
      'INSERT INTO staff_stats (discord_id, discord_username, tickets_closed, replacements_done, support_cases, guarantees_done, total_duration_minutes) VALUES (?, ?, 1, ?, ?, ?, ?)',
      [staffId, staffUsername,
        ticketType === 'replacement' ? 1 : 0,
        ticketType === 'support' ? 1 : 0,
        ticketType === 'guarantee' ? 1 : 0,
        durationMinutes]
    );
  } else {
    run(
      `UPDATE staff_stats SET
        discord_username = ?,
        tickets_closed = tickets_closed + 1,
        replacements_done = replacements_done + ?,
        support_cases = support_cases + ?,
        guarantees_done = guarantees_done + ?,
        total_duration_minutes = total_duration_minutes + ?,
        updated_at = datetime('now')
      WHERE discord_id = ?`,
      [staffUsername,
        ticketType === 'replacement' ? 1 : 0,
        ticketType === 'support' ? 1 : 0,
        ticketType === 'guarantee' ? 1 : 0,
        durationMinutes,
        staffId]
    );
  }
}

function getStaffStats(discordId) {
  return queryOne('SELECT * FROM staff_stats WHERE discord_id = ?', [discordId]);
}

function getTopStaff(limit = 10) {
  return query('SELECT * FROM staff_stats ORDER BY tickets_closed DESC LIMIT ?', [limit]);
}

function logAction({ ticketId, action, performedBy, performedById, details }) {
  run(
    'INSERT INTO ticket_logs (ticket_id, action, performed_by, performed_by_id, details) VALUES (?, ?, ?, ?, ?)',
    [ticketId || null, action, performedBy || null, performedById || null, details || null]
  );
}

function getReplacementHistory(email) {
  return query('SELECT * FROM replacement_history WHERE email = ? ORDER BY created_at DESC', [email]);
}

function countReplacements(email) {
  const row = queryOne("SELECT COUNT(*) as count FROM replacement_history WHERE email = ? AND status = 'delivered'", [email]);
  return row ? row.count : 0;
}

function addReplacementRecord({ email, product, discordId, ticketId, staffId, staffUsername }) {
  return run(
    'INSERT INTO replacement_history (email, product, discord_id, ticket_id, staff_id, staff_username) VALUES (?, ?, ?, ?, ?, ?)',
    [email, product, discordId, ticketId, staffId, staffUsername]
  );
}

function updateReplacementStatus(ticketId, status, staffId, staffUsername) {
  run(
    "UPDATE replacement_history SET status = ?, staff_id = ?, staff_username = ?, delivery_date = datetime('now') WHERE ticket_id = ?",
    [status, staffId, staffUsername, ticketId]
  );
}

function upsertUser(discordId, discordUsername) {
  const existing = queryOne('SELECT * FROM users WHERE discord_id = ?', [discordId]);
  if (!existing) {
    run('INSERT INTO users (discord_id, discord_username) VALUES (?, ?)', [discordId, discordUsername]);
  } else {
    run("UPDATE users SET discord_username = ?, updated_at = datetime('now') WHERE discord_id = ?", [discordUsername, discordId]);
  }
  return queryOne('SELECT * FROM users WHERE discord_id = ?', [discordId]);
}

async function getTicketMessages(channel) {
  const messages = [];
  let lastId = null;
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const fetched = await channel.messages.fetch(options);
    if (fetched.size === 0) break;
    messages.unshift(...fetched.values());
    lastId = fetched.last().id;
    if (fetched.size < 100) break;
  }
  return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

module.exports = {
  initDB,
  getDB,
  run,
  query,
  queryOne,
  createTicket,
  saveTicketForm,
  getTicketByChannel,
  getTicketById,
  getTicketForms,
  updateTicketChannel,
  claimTicket,
  unclaimTicket,
  closeTicket,
  updateStaffStats,
  getStaffStats,
  getTopStaff,
  logAction,
  getReplacementHistory,
  countReplacements,
  addReplacementRecord,
  updateReplacementStatus,
  upsertUser,
  getTicketMessages,
};
