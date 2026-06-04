// src/utils/transcript.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Genera un archivo HTML profesional con el transcript del ticket
 */
function generateTranscriptHTML({ ticket, forms, messages, staffUsername }) {
  const typeLabels = {
    replacement: '📦 Reemplazo',
    support: '⚙️ Soporte Técnico',
    guarantee: '🛡️ Garantía',
  };

  const openedAt = new Date(ticket.opened_at);
  const closedAt = ticket.closed_at ? new Date(ticket.closed_at) : new Date();
  const duration = ticket.duration_minutes || Math.round((closedAt - openedAt) / 60000);

  const formattedMessages = messages.map(msg => {
    const time = new Date(msg.createdTimestamp).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const isBot = msg.author.bot;
    const avatarUrl = msg.author.displayAvatarURL({ size: 32, extension: 'png' });
    const embeds = msg.embeds.map(e => `
      <div class="embed">
        ${e.title ? `<div class="embed-title">${escapeHTML(e.title)}</div>` : ''}
        ${e.description ? `<div class="embed-desc">${escapeHTML(e.description).replace(/\n/g, '<br>')}</div>` : ''}
        ${e.fields.map(f => `
          <div class="embed-field">
            <span class="field-name">${escapeHTML(f.name)}</span>
            <span class="field-value">${escapeHTML(f.value)}</span>
          </div>
        `).join('')}
      </div>
    `).join('');

    const attachments = [...msg.attachments.values()].map(att =>
      att.contentType?.startsWith('image/')
        ? `<img class="attachment-img" src="${att.url}" alt="attachment" loading="lazy">`
        : `<a class="attachment-link" href="${att.url}" target="_blank">📎 ${escapeHTML(att.name)}</a>`
    ).join('');

    return `
      <div class="message ${isBot ? 'bot-message' : ''}">
        <img class="avatar" src="${avatarUrl}" alt="avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <div class="msg-content">
          <div class="msg-header">
            <span class="username ${isBot ? 'bot-tag' : ''}">${escapeHTML(msg.author.displayName || msg.author.username)}</span>
            ${isBot ? '<span class="badge-bot">BOT</span>' : ''}
            <span class="timestamp">${time}</span>
          </div>
          ${msg.content ? `<div class="msg-text">${escapeHTML(msg.content).replace(/\n/g, '<br>')}</div>` : ''}
          ${embeds}
          ${attachments}
        </div>
      </div>
    `;
  }).join('');

  const ticketPrefix = { replacement: 'replacement', support: 'support', guarantee: 'guarantee' };
  const ticketName = `${ticketPrefix[ticket.ticket_type]}-${ticket.ticket_number}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript — ${ticketName} | VortexGG</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@400;600;700;800&display=swap');

    :root {
      --bg: #0e0f13;
      --bg2: #16181f;
      --bg3: #1e2028;
      --border: #2a2d38;
      --accent: #7c5af0;
      --accent2: #5bc8f5;
      --green: #3ddc97;
      --red: #f05a5a;
      --yellow: #f0c05a;
      --text: #e4e6f0;
      --muted: #6b7280;
      --bot-bg: #1a1c25;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
    }

    .header {
      background: linear-gradient(135deg, #1a1333 0%, #0e0f13 50%, #0d1a2e 100%);
      border-bottom: 1px solid var(--border);
      padding: 32px 48px;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .logo-wrap {
      background: var(--accent);
      width: 56px; height: 56px;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
      flex-shrink: 0;
      box-shadow: 0 0 24px rgba(124,90,240,0.4);
    }
    .header-info h1 {
      font-size: 22px; font-weight: 800;
      background: linear-gradient(90deg, #fff, var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .header-info p { color: var(--muted); font-size: 13px; margin-top: 4px; }

    .meta-section {
      padding: 32px 48px;
      border-bottom: 1px solid var(--border);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .meta-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .meta-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
      color: var(--muted); margin-bottom: 6px; font-family: 'JetBrains Mono', monospace;
    }
    .meta-value {
      font-size: 15px; font-weight: 600; color: var(--text);
    }
    .meta-value.accent { color: var(--accent2); }
    .meta-value.green { color: var(--green); }
    .meta-value.red { color: var(--red); }

    .section-title {
      font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 2px;
      color: var(--muted);
      display: flex; align-items: center; gap: 8px;
    }
    .section-title::after {
      content: ''; flex: 1;
      height: 1px; background: var(--border);
    }

    .messages-section {
      padding: 32px 48px;
    }
    .messages-list {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .message {
      display: flex;
      gap: 16px;
      padding: 8px 12px;
      border-radius: 8px;
      transition: background 0.1s;
    }
    .message:hover { background: rgba(255,255,255,0.03); }
    .bot-message { background: rgba(124,90,240,0.04); }

    .avatar {
      width: 36px; height: 36px;
      border-radius: 50%; flex-shrink: 0;
      margin-top: 2px;
      border: 2px solid var(--border);
    }
    .msg-content { flex: 1; min-width: 0; }
    .msg-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 4px;
    }
    .username {
      font-weight: 700; font-size: 14px; color: var(--text);
    }
    .bot-tag { color: var(--accent); }
    .badge-bot {
      background: var(--accent);
      color: #fff;
      font-size: 9px; font-weight: 700;
      padding: 1px 5px; border-radius: 4px;
      letter-spacing: 0.5px;
      font-family: 'JetBrains Mono', monospace;
    }
    .timestamp {
      font-size: 11px; color: var(--muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .msg-text {
      font-size: 14px; line-height: 1.6;
      color: #c9ccd6;
      word-break: break-word;
    }

    .embed {
      border-left: 3px solid var(--accent);
      background: var(--bg3);
      border-radius: 0 8px 8px 0;
      padding: 12px 14px;
      margin-top: 6px;
      max-width: 480px;
    }
    .embed-title {
      font-weight: 700; font-size: 14px; color: var(--text);
      margin-bottom: 6px;
    }
    .embed-desc {
      font-size: 13px; color: #c9ccd6; line-height: 1.5;
    }
    .embed-field {
      margin-top: 8px;
    }
    .field-name {
      display: block; font-size: 12px; font-weight: 700;
      color: var(--text); margin-bottom: 2px;
    }
    .field-value {
      font-size: 13px; color: #c9ccd6;
    }

    .attachment-img {
      max-width: 320px; border-radius: 8px; margin-top: 6px;
      border: 1px solid var(--border);
    }
    .attachment-link {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--accent2);
      text-decoration: none; margin-top: 4px;
    }

    .footer {
      border-top: 1px solid var(--border);
      padding: 24px 48px;
      display: flex; justify-content: space-between; align-items: center;
      color: var(--muted); font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
    }
    .footer-brand { color: var(--accent); font-weight: 700; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border-radius: 99px;
      font-size: 12px; font-weight: 700;
    }
    .status-closed { background: rgba(61,220,151,0.15); color: var(--green); }

    @media (max-width: 600px) {
      .header, .meta-section, .messages-section, .footer { padding: 20px; }
      .meta-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>

<div class="header">
  <div class="logo-wrap">⚡</div>
  <div class="header-info">
    <h1>VortexGG — Transcript de Ticket</h1>
    <p>${ticketName} &nbsp;·&nbsp; ${typeLabels[ticket.ticket_type]} &nbsp;·&nbsp;
      <span class="status-badge status-closed">● Cerrado</span>
    </p>
  </div>
</div>

<div class="meta-section">
  <p class="section-title">Información del Ticket</p>
  <div class="meta-grid">
    <div class="meta-card">
      <div class="meta-label">Cliente</div>
      <div class="meta-value">${escapeHTML(ticket.discord_username || 'N/A')}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Email</div>
      <div class="meta-value accent">${escapeHTML(ticket.email || 'N/A')}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Producto</div>
      <div class="meta-value">${escapeHTML(ticket.product || 'N/A')}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Tipo de Ticket</div>
      <div class="meta-value">${typeLabels[ticket.ticket_type]}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Moderador</div>
      <div class="meta-value accent">${escapeHTML(staffUsername || ticket.claimed_by || 'Sin asignar')}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Apertura</div>
      <div class="meta-value">${openedAt.toLocaleString('es-AR')}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Cierre</div>
      <div class="meta-value">${closedAt.toLocaleString('es-AR')}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Duración</div>
      <div class="meta-value green">${duration} minutos</div>
    </div>
  </div>
</div>

<div class="messages-section">
  <p class="section-title">Conversación (${messages.length} mensajes)</p>
  <div class="messages-list">
    ${formattedMessages || '<p style="color:var(--muted);padding:20px 0">Sin mensajes registrados.</p>'}
  </div>
</div>

<div class="footer">
  <span><span class="footer-brand">VortexGG</span> — Sistema de Soporte Automatizado</span>
  <span>Generado: ${new Date().toLocaleString('es-AR')}</span>
</div>

</body>
</html>`;

  // Guardar en disco con hash único para la URL
  const hash = crypto.randomBytes(20).toString('hex');
  const tmpDir = path.join(__dirname, '../../transcripts');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const fileName = `${hash}.html`;
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, html, 'utf8');

  return { filePath, hash, ticketName };
}

/**
 * Sube el transcript al servidor Railway y devuelve la URL pública.
 * El servidor Railway debe tener el endpoint POST /upload que guarda el HTML
 * y lo sirve en GET /t/:hash
 */
async function uploadTranscript(filePath, hash) {
  let TRANSCRIPT_SERVER = process.env.TRANSCRIPT_SERVER_URL || 'https://bot-soporte-production-5c87.up.railway.app';
  if (!TRANSCRIPT_SERVER.startsWith('http://') && !TRANSCRIPT_SERVER.startsWith('https://')) {
    TRANSCRIPT_SERVER = 'https://' + TRANSCRIPT_SERVER;
  }
  TRANSCRIPT_SERVER = TRANSCRIPT_SERVER.replace(/\/$/, '');

  try {
    const fs = require('fs');
    const htmlContent = fs.readFileSync(filePath, 'utf8');

    const response = await fetch(`${TRANSCRIPT_SERVER}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash, html: htmlContent }),
    });

    if (!response.ok) {
      throw new Error(`Upload falló: HTTP ${response.status}`);
    }

    return `${TRANSCRIPT_SERVER}/t/${hash}`;
  } catch (err) {
    console.error('[Transcript] Error al subir:', err.message);
    return null;
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { generateTranscriptHTML, uploadTranscript };
