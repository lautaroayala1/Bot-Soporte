// src/intake/intakeManager.js
// Gestiona el flujo de preguntas ANTES de abrir el ticket al staff.
// - Replacement / Guarantee: flujo completo (método → invoice → cuentas → comprobante)
// - Support: solo pregunta la duda, luego abre el ticket directamente

const { MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const { t } = require('../utils/i18n');

// Map de sesiones activas: discord_id -> session
const activeSessions = new Map();

const INTAKE_TIMEOUT = 5 * 60 * 1000; // 5 minutos por paso

// ================================
// INICIAR INTAKE
// ================================
async function startIntake(guild, member, lang, ticketType) {
  if (activeSessions.has(member.id)) {
    const existing = activeSessions.get(member.id);
    const ch = guild.channels.cache.get(existing.channelId);
    return { alreadyOpen: true, channel: ch };
  }

  const channelName = `intake-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user'}`;

  const permissionOverwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  const channelOptions = {
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites,
    topic: `Intake temporal para ${member.user.tag} — ${ticketType}`,
  };
  const intakeCat = process.env.CATEGORY_INTAKE;
  if (intakeCat && /^\d{17,20}$/.test(intakeCat)) channelOptions.parent = intakeCat;

  const channel = await guild.channels.create(channelOptions);

  const session = {
    channelId: channel.id,
    memberId: member.id,
    memberTag: member.user.tag,
    memberUsername: member.user.username,
    lang,
    ticketType,
    step: ticketType === 'support' ? 'support_question' : 'purchase_type',
    data: {
      purchaseMethod: ticketType === 'support' ? 'support' : null,
      invoiceOrTicket: null,
      accounts: null,
      proof: null,
      proofAttachmentUrl: null,
      supportQuestion: null, // solo para support
    },
    timeout: null,
  };

  activeSessions.set(member.id, session);

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x7c5af0)
    .setDescription(t(lang, 'intake_welcome', member.user.username));

  await channel.send({ content: `${member}`, embeds: [welcomeEmbed] });

  // Soporte: saltar directo a preguntar la duda
  if (ticketType === 'support') {
    await askSupportQuestion(channel, session);
  } else {
    await askPurchaseType(channel, session);
  }

  return { alreadyOpen: false, channel };
}

// ================================
// SOPORTE: Preguntar la duda
// ================================
async function askSupportQuestion(channel, session) {
  const { lang } = session;
  const question = lang === 'es'
    ? '💬 **¿Cuál es tu consulta o problema?**\n\nExplicá con detalle qué necesitás y un staff te va a atender.'
    : '💬 **What is your question or issue?**\n\nExplain in detail what you need and a staff member will assist you.';

  const embed = new EmbedBuilder().setColor(0x5bc8f5).setDescription(question);
  await channel.send({ embeds: [embed] });
  session.step = 'support_question';
  resetTimeout(channel, session);
}

// ================================
// PASO 1: Tipo de compra (replacement/guarantee)
// ================================
async function askPurchaseType(channel, session) {
  const { lang } = session;

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`intake_purchase_type_${session.memberId}`)
      .setPlaceholder(t(lang, 'intake_type_q'))
      .addOptions([
        { label: t(lang, 'intake_type_sellauth'), value: 'sellauth', emoji: '🛒' },
        { label: t(lang, 'intake_type_ticket'), value: 'ticket', emoji: '🎫' },
      ])
  );

  const embed = new EmbedBuilder()
    .setColor(0x5bc8f5)
    .setDescription(`**${t(lang, 'intake_type_q')}**`);

  const msg = await channel.send({ embeds: [embed], components: [row] });
  session.step = 'purchase_type';
  session.lastBotMsgId = msg.id;
  resetTimeout(channel, session);
}

// ================================
// PASO 2: Invoice ID o Ticket Number
// ================================
async function askInvoiceOrTicket(channel, session) {
  const { lang, data } = session;
  const questionKey = data.purchaseMethod === 'sellauth' ? 'intake_invoice_q' : 'intake_ticket_q';
  const exampleKey  = data.purchaseMethod === 'sellauth' ? 'intake_invoice_example' : null;
  const desc = t(lang, questionKey) + (exampleKey ? `\n\n${t(lang, exampleKey)}` : '');
  const embed = new EmbedBuilder().setColor(0x5bc8f5).setDescription(desc);
  await channel.send({ embeds: [embed] });
  session.step = 'invoice';
  resetTimeout(channel, session);
}

// ================================
// PASO 3: Cuentas con problema
// ================================
async function askAccounts(channel, session) {
  const { lang, data } = session;
  const embed = new EmbedBuilder()
    .setColor(0x5bc8f5)
    .setDescription(t(lang, 'intake_accounts_q', data.invoiceOrTicket || '—'));
  await channel.send({ embeds: [embed] });
  session.step = 'accounts';
  resetTimeout(channel, session);
}

// ================================
// PASO 4: Comprobante
// ================================
async function askProof(channel, session) {
  const { lang } = session;
  const embed = new EmbedBuilder().setColor(0x5bc8f5).setDescription(t(lang, 'intake_proof_q'));
  await channel.send({ embeds: [embed] });
  session.step = 'proof';
  resetTimeout(channel, session);
}

// ================================
// RESUMEN + botón confirmar
// ================================
async function showSummary(channel, session) {
  const { lang, data, ticketType } = session;

  const typeLabel = {
    replacement: lang === 'es' ? '📦 Reemplazo'  : '📦 Replacement',
    support:     lang === 'es' ? '⚙️ Soporte'    : '⚙️ Support',
    guarantee:   lang === 'es' ? '🛡️ Garantía'   : '🛡️ Guarantee',
  }[ticketType] || ticketType;

  let embedFields;
  if (ticketType === 'support') {
    embedFields = [
      { name: lang === 'es' ? '📂 Tipo' : '📂 Type', value: typeLabel, inline: true },
      { name: lang === 'es' ? '💬 Consulta' : '💬 Question', value: data.supportQuestion?.slice(0, 500) || '—', inline: false },
    ];
  } else {
    const methodLabel = data.purchaseMethod === 'sellauth'
      ? '🛒 SellAuth'
      : (lang === 'es' ? '🎫 Ticket anterior' : '🎫 Previous ticket');
    embedFields = [
      { name: lang === 'es' ? '📂 Tipo'    : '📂 Type',    value: typeLabel,                                  inline: true  },
      { name: lang === 'es' ? '🛒 Método'  : '🛒 Method',  value: methodLabel,                                inline: true  },
      { name: lang === 'es' ? '📋 Invoice' : '📋 Invoice', value: `\`${data.invoiceOrTicket}\``,              inline: false },
      { name: lang === 'es' ? '⚠️ Cuentas' : '⚠️ Accounts', value: data.accounts?.slice(0, 500) || '—',      inline: false },
      { name: lang === 'es' ? '🧾 Comprobante' : '🧾 Proof', value: data.proof?.slice(0, 200) || '—',        inline: false },
    ];
  }

  const embed = new EmbedBuilder()
    .setColor(0x3ddc97)
    .setTitle(t(lang, 'intake_summary_title'))
    .addFields(embedFields)
    .setDescription(`\n${t(lang, 'intake_summary_ready')}`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`intake_confirm_${session.memberId}`)
      .setLabel(t(lang, 'intake_open_btn'))
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎫'),
    new ButtonBuilder()
      .setCustomId(`intake_cancel_${session.memberId}`)
      .setLabel(t(lang, 'intake_cancel_btn'))
      .setStyle(ButtonStyle.Danger),
  );

  await channel.send({ embeds: [embed], components: [row] });
  session.step = 'summary';

  clearTimeout(session.timeout);
  session.timeout = setTimeout(async () => {
    await timeoutSession(channel, session);
  }, 10 * 60 * 1000);
}

// ================================
// PROCESAR MENSAJE DEL USUARIO
// ================================
async function handleMessage(message) {
  const session = activeSessions.get(message.author.id);
  if (!session) return;
  if (message.channel.id !== session.channelId) return;
  if (message.author.bot) return;

  resetTimeout(message.channel, session);
  const content = message.content.trim();

  // Soporte: recibir la pregunta y mostrar resumen directo
  if (session.step === 'support_question') {
    session.data.supportQuestion = content;
    // Para support no hay invoice/cuentas/comprobante; rellenar con defaults
    session.data.invoiceOrTicket = content.slice(0, 100); // usar la pregunta como "referencia"
    session.data.accounts = '—';
    session.data.proof = '—';
    clearTimeout(session.timeout);
    await showSummary(message.channel, session);
    return;
  }

  if (session.step === 'invoice') {
    session.data.invoiceOrTicket = content;
    await askAccounts(message.channel, session);
    return;
  }

  if (session.step === 'accounts') {
    session.data.accounts = content;
    await askProof(message.channel, session);
    return;
  }

  if (session.step === 'proof') {
    if (message.attachments.size > 0) {
      const att = message.attachments.first();
      session.data.proof = att.url;
      session.data.proofAttachmentUrl = att.url;
    } else {
      session.data.proof = content;
    }
    clearTimeout(session.timeout);
    await showSummary(message.channel, session);
    return;
  }
}

// ================================
// SELECT MENU (paso 1 — tipo compra)
// ================================
async function handlePurchaseTypeSelect(interaction) {
  const memberId = interaction.user.id;
  const session = activeSessions.get(memberId);
  if (!session) return interaction.reply({ content: '❌ Sesión expirada.', flags: MessageFlags.Ephemeral });
  if (interaction.channel.id !== session.channelId) return;

  session.data.purchaseMethod = interaction.values[0];
  await interaction.update({ components: [] });
  await askInvoiceOrTicket(interaction.channel, session);
}

// ================================
// CONFIRMAR → CONVERTIR INTAKE EN TICKET REAL
// El canal de intake NO se borra: se renombra, mueve y se limpian sus mensajes
// dentro de createTicketFn (ticketHandler.createTicketFromIntake).
// ================================
async function handleConfirm(interaction, createTicketFn) {
  const memberId = interaction.user.id;
  const session = activeSessions.get(memberId);
  if (!session) return interaction.reply({ content: '❌ Sesión expirada.', flags: MessageFlags.Ephemeral });

  clearTimeout(session.timeout);

  // Quitar botones del resumen antes de procesar
  await interaction.update({ components: [] });

  // Mensaje de espera (visible brevemente; será borrado junto con los demás mensajes del intake)
  const processingEmbed = new EmbedBuilder()
    .setColor(0x7c5af0)
    .setDescription(session.lang === 'es' ? '⏳ Preparando tu ticket...' : '⏳ Setting up your ticket...');
  await interaction.channel.send({ embeds: [processingEmbed] });

  try {
    // createTicketFn: renombra el canal, lo mueve, purga mensajes y envía el embed final
    await createTicketFn(session, interaction.guild, interaction.member);
    // Limpiar sesión — el canal ya fue transformado en ticket real
    activeSessions.delete(memberId);
  } catch (err) {
    console.error('[Intake] Error convirtiendo ticket:', err);
    await interaction.channel.send({ content: '❌ Error al crear el ticket. Contactá a un administrador.' });
  }
}

// ================================
// CANCELAR
// ================================
async function handleCancel(interaction) {
  const memberId = interaction.user.id;
  const session = activeSessions.get(memberId);
  if (!session) return;

  clearTimeout(session.timeout);
  activeSessions.delete(memberId);

  await interaction.update({ components: [] });
  const embed = new EmbedBuilder().setColor(0xf05a5a).setDescription(t(session.lang, 'intake_cancelled'));
  await interaction.channel.send({ embeds: [embed] });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 4000);
}

// ================================
// TIMEOUT
// ================================
async function timeoutSession(channel, session) {
  activeSessions.delete(session.memberId);
  const embed = new EmbedBuilder().setColor(0xf0c05a).setDescription(t(session.lang, 'intake_timeout'));
  await channel.send({ embeds: [embed] }).catch(() => {});
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

function resetTimeout(channel, session) {
  clearTimeout(session.timeout);
  session.timeout = setTimeout(() => timeoutSession(channel, session), INTAKE_TIMEOUT);
}

function getSession(memberId) { return activeSessions.get(memberId); }
function hasSession(memberId) { return activeSessions.has(memberId); }

module.exports = {
  startIntake,
  handleMessage,
  handlePurchaseTypeSelect,
  handleConfirm,
  handleCancel,
  getSession,
  hasSession,
};
