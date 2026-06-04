// src/utils/embeds.js
const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary: 0x7c5af0,
  success: 0x3ddc97,
  error: 0xf05a5a,
  warning: 0xf0c05a,
  info: 0x5bc8f5,
  neutral: 0x2a2d38,
};

function ticketEmbed({ type, ticketName, client, product, status, claimedBy }) {
  const typeConfig = {
    replacement: { emoji: '📦', label: 'Ticket de Reemplazo', color: COLORS.primary },
    support: { emoji: '⚙️', label: 'Ticket de Soporte Técnico', color: COLORS.info },
    guarantee: { emoji: '🛡️', label: 'Ticket de Garantía', color: COLORS.warning },
  };

  const cfg = typeConfig[type] || typeConfig.support;

  return new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(`${cfg.emoji} ${cfg.label}`)
    .addFields(
      { name: '👤 Cliente', value: client || 'N/A', inline: true },
      { name: '📦 Producto', value: product || 'N/A', inline: true },
      { name: '📊 Estado', value: status || '🟡 Pendiente', inline: true },
      { name: '🔒 Asignado', value: claimedBy || 'Sin asignar', inline: true },
    )
    .setFooter({ text: `VortexGG Support · ${ticketName}` })
    .setTimestamp();
}

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`✅ ${title}`)
    .setDescription(description || null)
    .setTimestamp();
}

function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(`❌ ${title}`)
    .setDescription(description || null)
    .setTimestamp();
}

function warningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description || null)
    .setTimestamp();
}

function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description || null)
    .setTimestamp();
}

function logEmbed({ action, fields }) {
  const actionColors = {
    'Ticket creado': COLORS.success,
    'Ticket reclamado': COLORS.primary,
    'Ticket liberado': COLORS.warning,
    'Ticket cerrado': COLORS.neutral,
    'Reemplazo entregado': COLORS.success,
    'Reemplazo denegado': COLORS.error,
    'Límite excedido': COLORS.error,
  };

  const embed = new EmbedBuilder()
    .setColor(actionColors[action] || COLORS.neutral)
    .setTitle(`📋 ${action}`)
    .setTimestamp();

  if (fields && fields.length) {
    embed.addFields(fields.map(f => ({ name: f.name, value: String(f.value || 'N/A'), inline: f.inline ?? true })));
  }

  return embed;
}

function statsEmbed(stats, username) {
  const avgTime = stats.tickets_closed > 0
    ? Math.round(stats.total_duration_minutes / stats.tickets_closed)
    : 0;

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`📊 Estadísticas — ${username}`)
    .addFields(
      { name: '🎫 Tickets cerrados', value: `**${stats.tickets_closed}**`, inline: true },
      { name: '📦 Reemplazos', value: `**${stats.replacements_done}**`, inline: true },
      { name: '⚙️ Soportes', value: `**${stats.support_cases}**`, inline: true },
      { name: '🛡️ Garantías', value: `**${stats.guarantees_done}**`, inline: true },
      { name: '⏱️ Tiempo promedio', value: `**${avgTime} minutos**`, inline: true },
    )
    .setTimestamp();
}

module.exports = { ticketEmbed, successEmbed, errorEmbed, warningEmbed, infoEmbed, logEmbed, statsEmbed };
