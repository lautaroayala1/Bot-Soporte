// src/commands/index.js
const { MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../database/database');
const { generateTranscriptHTML } = require('../utils/transcript');
const { successEmbed, errorEmbed, statsEmbed, logEmbed, warningEmbed } = require('../utils/embeds');
const { sendStaffLog } = require('../handlers/ticketHandler');
const { closeTicketFlow } = require('../handlers/interactionHandler');
const { t } = require('../utils/i18n');

const STAFF_ROLE_ID_FIXED = '1511845355396927528';
function isStaff(member) {
  return member.permissions.has('Administrator') ||
    member.roles.cache.has(STAFF_ROLE_ID_FIXED) ||
    (process.env.STAFF_ROLE_ID && member.roles.cache.has(process.env.STAFF_ROLE_ID));
}

const commands = [

  // /panel
  {
    data: new SlashCommandBuilder().setName('panel').setDescription('Publica el panel de tickets (solo admins)'),
    async execute(interaction) {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ embeds: [errorEmbed('Sin permisos', 'Solo administradores pueden publicar el panel.')], flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c5af0)
        .setTitle('⚡ Support System / Sistema de Soporte')
        .setDescription(
          '**Bienvenido al soporte de VortexGG / Welcome to VortexGG Support.**\n\n' +
          'Por favor seleccioná tu idioma para continuar.\n' +
          'Please select your language to continue.'
        )
        .setImage(process.env.PANEL_BANNER_URL || null)
        .setFooter({ text: 'VortexGG Support · Solo abre un ticket si realmente lo necesitás.' })
        .setTimestamp();

      // Selector unificado: idioma (siguiente paso elige tipo)
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('panel_lang_select')
          .setPlaceholder('Select language / Seleccionar idioma')
          .addOptions([
            { label: '🇦🇷 Español', value: 'es', description: 'Continuar en español' },
            { label: '🇺🇸 English', value: 'en', description: 'Continue in English' },
          ])
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ embeds: [successEmbed('Panel publicado', 'El panel fue enviado.')], flags: MessageFlags.Ephemeral });
    },
  },

  // /claim
  {
    data: new SlashCommandBuilder().setName('claim').setDescription('Reclama el ticket actual'),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
      if (ticket.status === 'claimed') return interaction.reply({ embeds: [warningEmbed('Ya reclamado', t('es', 'err_already_claimed', ticket.claimed_by))], flags: MessageFlags.Ephemeral });

      db.claimTicket(ticket.id, interaction.member.id, interaction.member.user.username);
      db.logAction({ ticketId: ticket.id, action: 'Ticket reclamado', performedBy: interaction.member.user.username, performedById: interaction.member.id });
      await sendStaffLog(interaction.guild, logEmbed({ action: 'Ticket reclamado', fields: [{ name: '🎫 Ticket', value: String(ticket.ticket_number) }, { name: '👤 Staff', value: interaction.member.user.username }] }));
      return interaction.reply({ embeds: [successEmbed('Ticket reclamado', `🔒 Tomado por **${interaction.member.user.username}**`)] });
    },
  },

  // /unclaim
  {
    data: new SlashCommandBuilder().setName('unclaim').setDescription('Libera el ticket actual'),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
      if (ticket.claimed_by_id !== interaction.member.id && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ embeds: [errorEmbed('Sin permisos', 'Solo quien reclamó puede liberarlo.')], flags: MessageFlags.Ephemeral });
      }
      db.unclaimTicket(ticket.id);
      return interaction.reply({ embeds: [successEmbed('Ticket liberado', 'Disponible para reclamar.')] });
    },
  },

  // /close
  {
    data: new SlashCommandBuilder().setName('close').setDescription('Cierra el ticket y genera el transcript'),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
      if (ticket.status === 'claimed' && ticket.claimed_by_id && ticket.claimed_by_id !== interaction.member.id && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_only_claimer', ticket.claimed_by))], flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply();
      await closeTicketFlow(interaction, ticket, interaction.channel, interaction.guild, interaction.member);
    },
  },

  // /stats
  {
    data: new SlashCommandBuilder()
      .setName('stats').setDescription('Estadísticas del staff')
      .addUserOption(o => o.setName('usuario').setDescription('Miembro del staff').setRequired(false)),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const target = interaction.options.getUser('usuario') || interaction.user;
      const stats = db.getStaffStats(target.id);
      if (!stats) return interaction.reply({ embeds: [warningEmbed('Sin datos', `**${target.username}** no tiene estadísticas aún.`)], flags: MessageFlags.Ephemeral });
      return interaction.reply({ embeds: [statsEmbed(stats, target.username)] });
    },
  },

  // /topstaff
  {
    data: new SlashCommandBuilder().setName('topstaff').setDescription('Leaderboard del staff'),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const top = db.getTopStaff(10);
      if (!top.length) return interaction.reply({ embeds: [warningEmbed('Sin datos', 'No hay estadísticas aún.')], flags: MessageFlags.Ephemeral });
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((s, i) => `${medals[i] || `**${i + 1}.**`} **${s.discord_username}** — ${s.tickets_closed} tickets`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c5af0).setTitle('🏆 Top Staff').setDescription(lines).setTimestamp()] });
    },
  },

  // /replacement delivered | denied
  {
    data: new SlashCommandBuilder()
      .setName('replacement').setDescription('Gestiona el reemplazo del ticket')
      .addSubcommand(s => s.setName('delivered').setDescription('Marca como entregado'))
      .addSubcommand(s => s.setName('denied').setDescription('Deniega el reemplazo')),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
      if (ticket.ticket_type !== 'replacement') return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_wrong_type'))], flags: MessageFlags.Ephemeral });

      const sub = interaction.options.getSubcommand();
      const status = sub === 'delivered' ? 'delivered' : 'denied';
      db.updateReplacementStatus(ticket.id, status, interaction.member.id, interaction.member.user.username);
      db.logAction({ ticketId: ticket.id, action: sub === 'delivered' ? 'Reemplazo entregado' : 'Reemplazo denegado', performedBy: interaction.member.user.username, performedById: interaction.member.id });
      await sendStaffLog(interaction.guild, logEmbed({
        action: sub === 'delivered' ? 'Reemplazo entregado' : 'Reemplazo denegado',
        fields: [{ name: '📦 Producto', value: ticket.product || 'N/A' }, { name: '👤 Staff', value: interaction.member.user.username }],
      }));
      return sub === 'delivered'
        ? interaction.reply({ embeds: [successEmbed('Reemplazo entregado', `✅ Reemplazo de **${ticket.product || 'producto'}** marcado como entregado.`)] })
        : interaction.reply({ embeds: [errorEmbed('Reemplazo denegado', `❌ Reemplazo de **${ticket.product || 'producto'}** denegado.`)] });
    },
  },

  // /verify
  {
    data: new SlashCommandBuilder()
      .setName('verify').setDescription('Verifica una compra en SellAuth')
      .addStringOption(o => o.setName('invoice').setDescription('Invoice ID').setRequired(true))
      .addStringOption(o => o.setName('producto').setDescription('Producto').setRequired(false)),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const invoice = interaction.options.getString('invoice');
      const product = interaction.options.getString('producto') || '';
      const { verifyPurchase } = require('../utils/sellauth');
      const { found, order, simulated } = await verifyPurchase(invoice, product);
      const embed = found
        ? successEmbed('Compra verificada', `Invoice \`${invoice}\` encontrado${simulated ? ' *(simulación)*' : ''}.`)
        : errorEmbed('No encontrado', `No se encontró el invoice \`${invoice}\`.`);
      if (found && order?.id) embed.addFields({ name: 'Order ID', value: String(order.id), inline: true });
      return interaction.editReply({ embeds: [embed] });
    },
  },

  // /adduser
  {
    data: new SlashCommandBuilder()
      .setName('adduser').setDescription('Agrega un usuario al ticket')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true)),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
      const user = interaction.options.getUser('usuario');
      await interaction.channel.permissionOverwrites.create(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.reply({ embeds: [successEmbed('Usuario agregado', `${user} ahora puede ver este ticket.`)] });
    },
  },

  // /removeuser
  {
    data: new SlashCommandBuilder()
      .setName('removeuser').setDescription('Remueve un usuario del ticket')
      .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true)),
    async execute(interaction) {
      if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
      const ticket = db.getTicketByChannel(interaction.channel.id);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
      const user = interaction.options.getUser('usuario');
      await interaction.channel.permissionOverwrites.delete(user.id);
      return interaction.reply({ embeds: [successEmbed('Usuario removido', `${user} fue removido del ticket.`)] });
    },
  },

];

module.exports = commands;

// ─── EXTRAS AGREGADOS ─────────────────────────────────────────────────────────

// /note — nota interna visible solo en el ticket (staff)
commands.push({
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Agrega una nota interna al ticket')
    .addStringOption(o => o.setName('texto').setDescription('Contenido de la nota').setRequired(true)),
  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
    const ticket = db.getTicketByChannel(interaction.channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
    const text = interaction.options.getString('texto');
    db.logAction({ ticketId: ticket.id, action: 'Nota interna', performedBy: interaction.member.user.username, performedById: interaction.member.id, details: text });
    const embed = new EmbedBuilder()
      .setColor(0xf0c05a)
      .setTitle('📝 Nota Interna')
      .setDescription(text)
      .setFooter({ text: `Por ${interaction.member.user.username}` })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },
});

// /priority — cambia la prioridad del ticket
commands.push({
  data: new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Establece la prioridad del ticket')
    .addStringOption(o => o
      .setName('nivel')
      .setDescription('Nivel de prioridad')
      .setRequired(true)
      .addChoices(
        { name: '🔴 Alta', value: 'high' },
        { name: '🟡 Media', value: 'medium' },
        { name: '🟢 Baja', value: 'low' },
      )
    ),
  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
    const ticket = db.getTicketByChannel(interaction.channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
    const nivel = interaction.options.getString('nivel');
    const labels = { high: '🔴 Alta', medium: '🟡 Media', low: '🟢 Baja' };
    const colors = { high: 0xf05a5a, medium: 0xf0c05a, low: 0x3ddc97 };
    // Renombrar canal agregando prefijo de prioridad
    const baseName = interaction.channel.name.replace(/^(🔴|🟡|🟢)-/, '');
    const emoji = { high: '🔴', medium: '🟡', low: '🟢' }[nivel];
    await interaction.channel.setName(`${emoji}-${baseName}`).catch(() => {});
    db.logAction({ ticketId: ticket.id, action: 'Prioridad cambiada', performedBy: interaction.member.user.username, performedById: interaction.member.id, details: nivel });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(colors[nivel]).setTitle(`Prioridad: ${labels[nivel]}`).setDescription(`Ticket marcado como **${labels[nivel]}** por ${interaction.member}.`).setTimestamp()],
    });
  },
});

// /rename — renombra el canal del ticket
commands.push({
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Renombra el canal del ticket')
    .addStringOption(o => o.setName('nombre').setDescription('Nuevo nombre').setRequired(true)),
  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
    const ticket = db.getTicketByChannel(interaction.channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
    const newName = interaction.options.getString('nombre').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
    await interaction.channel.setName(newName);
    return interaction.reply({ embeds: [successEmbed('Canal renombrado', `Ahora se llama: \`${newName}\``)] });
  },
});

// /ping-staff — menciona al staff en el ticket actual
commands.push({
  data: new SlashCommandBuilder().setName('ping-staff').setDescription('Menciona al staff en este ticket'),
  async execute(interaction) {
    const ticket = db.getTicketByChannel(interaction.channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
    const { STAFF_ROLE_ID, CEO_USER_ID } = require('../handlers/ticketHandler');
    await interaction.reply({ content: `<@&${STAFF_ROLE_ID}> <@${CEO_USER_ID}> — Se necesita atención en este ticket.` });
  },
});

// /clientinfo — muestra el historial del cliente del ticket actual
commands.push({
  data: new SlashCommandBuilder()
    .setName('clientinfo')
    .setDescription('Muestra el historial del cliente del ticket actual'),
  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
    const ticket = db.getTicketByChannel(interaction.channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });

    const replacements = db.getReplacementHistory(ticket.email || ticket.discord_id);
    const totalTickets = db.query('SELECT COUNT(*) as c FROM tickets WHERE discord_id = ?', [ticket.discord_id]);
    const totalClosed  = db.query("SELECT COUNT(*) as c FROM tickets WHERE discord_id = ? AND status = 'closed'", [ticket.discord_id]);

    const delivered = replacements.filter(r => r.status === 'delivered').length;
    const denied    = replacements.filter(r => r.status === 'denied').length;

    const MAX = parseInt(process.env.MAX_REPLACEMENTS || '3');
    const abuso = delivered >= MAX ? '⚠️ **Límite de reemplazos alcanzado**' : `${delivered}/${MAX} reemplazos usados`;

    const embed = new EmbedBuilder()
      .setColor(0x5bc8f5)
      .setTitle(`👤 Info del cliente — ${ticket.discord_username}`)
      .addFields(
        { name: '🆔 Discord ID',        value: ticket.discord_id,                     inline: true  },
        { name: '📧 Email / Invoice',   value: ticket.email || '—',                   inline: true  },
        { name: '\u200b',               value: '\u200b',                               inline: false },
        { name: '🎫 Tickets totales',   value: String(totalTickets[0]?.c || 0),        inline: true  },
        { name: '✅ Tickets cerrados',  value: String(totalClosed[0]?.c || 0),         inline: true  },
        { name: '\u200b',               value: '\u200b',                               inline: false },
        { name: '📦 Reemplazos entregados', value: String(delivered),                 inline: true  },
        { name: '❌ Reemplazos denegados',  value: String(denied),                    inline: true  },
        { name: '⚠️ Anti-abuso',        value: abuso,                                 inline: false },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});

// /tickets — lista los tickets abiertos del servidor
commands.push({
  data: new SlashCommandBuilder().setName('tickets').setDescription('Lista todos los tickets actualmente abiertos'),
  async execute(interaction) {
    if (!isStaff(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_no_perms'))], flags: MessageFlags.Ephemeral });
    const open = db.query("SELECT * FROM tickets WHERE status != 'closed' ORDER BY opened_at DESC LIMIT 20");
    if (!open.length) return interaction.reply({ embeds: [successEmbed('Sin tickets abiertos', 'No hay tickets activos en este momento.')], flags: MessageFlags.Ephemeral });

    const typeEmoji = { replacement: '📦', support: '⚙️', guarantee: '🛡️' };
    const lines = open.map(tk => {
      const emoji  = typeEmoji[tk.ticket_type] || '🎫';
      const status = tk.status === 'claimed' ? `🔒 ${tk.claimed_by}` : '🟡 Sin asignar';
      return `${emoji} **${tk.ticket_type}-${tk.ticket_number}** — ${tk.discord_username} — ${status}`;
    }).join('\n');

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x7c5af0).setTitle(`📋 Tickets abiertos (${open.length})`).setDescription(lines).setTimestamp()],
      flags: MessageFlags.Ephemeral,
    });
  },
});

// ── /fixdb — limpia tickets huérfanos y sincroniza canales ───────────────────
commands.push({
  data: new SlashCommandBuilder()
    .setName('fixdb')
    .setDescription('Limpia tickets huérfanos de la DB (solo admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed('Sin permisos', 'Solo administradores.')], flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // 1. Borrar tickets sin channel_id
    const orphans = db.query('SELECT id FROM tickets WHERE channel_id IS NULL');
    let cleaned = 0;
    for (const t of orphans) {
      db.run('DELETE FROM ticket_forms WHERE ticket_id = ?', [t.id]);
      db.run('DELETE FROM replacement_history WHERE ticket_id = ?', [t.id]);
      db.run('DELETE FROM tickets WHERE id = ?', [t.id]);
      cleaned++;
    }

    // 2. Borrar tickets cuyo canal ya no existe en Discord
    const allOpen = db.query("SELECT id, channel_id FROM tickets WHERE status != 'closed' AND channel_id IS NOT NULL");
    let stale = 0;
    for (const tk of allOpen) {
      const exists = interaction.guild.channels.cache.has(tk.channel_id);
      if (!exists) {
        db.run("UPDATE tickets SET status = 'closed' WHERE id = ?", [tk.id]);
        stale++;
      }
    }

    return interaction.editReply({
      embeds: [successEmbed('DB limpiada', `🧹 ${cleaned} ticket(s) huérfano(s) eliminados.\n🔄 ${stale} ticket(s) sin canal marcados como cerrados.`)],
    });
  },
});

// ── /setup y /tos ─────────────────────────────────────────────────────────────
const setupCmd = require('./setup');
const { tosCommand } = require('./tos');
commands.push(setupCmd);
commands.push(tosCommand);
