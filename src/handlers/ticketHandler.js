// src/handlers/ticketHandler.js
const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const db = require('../database/database');
const { verifyPurchase } = require('../utils/sellauth');
const { t } = require('../utils/i18n');
const { logEmbed } = require('../utils/embeds');

// ── IDs desde .env ──────────────────────────────────────────────────────────
function getCEO()      { return process.env.CEO_USER_ID    || '1511845432018469086'; }
function getStaff()    { return process.env.STAFF_ROLE_ID  || '1511845355396927528'; }
function getCEORole()  { return process.env.CEO_ROLE_ID    || null; }

async function sendStaffLog(guild, embed) {
  const id = process.env.LOGS_CHANNEL_ID;
  if (!id || id.includes('id_')) return;
  try {
    const ch = await guild.channels.fetch(id);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (e) { console.error('[Log]', e.message); }
}

function isValidSnowflake(id) {
  return id && /^\d{17,20}$/.test(id);
}

/**
 * Construye los permissionOverwrites para el canal del ticket.
 */
async function buildOverwrites(guild, memberId) {
  await guild.roles.fetch();
  await guild.members.fetch(memberId).catch(() => {});

  const CEO_USER_ID   = getCEO();
  const STAFF_ROLE_ID = getStaff();
  const CEO_ROLE_ID   = getCEORole();

  await guild.members.fetch(CEO_USER_ID).catch(() => {});

  const everyoneRole = guild.roles.everyone;
  const staffRole    = guild.roles.cache.get(STAFF_ROLE_ID);
  const ceoRole      = CEO_ROLE_ID ? guild.roles.cache.get(CEO_ROLE_ID) : null;
  const memberObj    = guild.members.cache.get(memberId);
  const ceoMember    = guild.members.cache.get(CEO_USER_ID);

  const overwrites = [
    { id: everyoneRole, deny: [PermissionFlagsBits.ViewChannel] },
  ];

  if (memberObj) {
    overwrites.push({
      id: memberObj,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  if (staffRole) {
    overwrites.push({
      id: staffRole,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  if (ceoRole) {
    overwrites.push({
      id: ceoRole,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  if (ceoMember && ceoMember.id !== memberId) {
    overwrites.push({
      id: ceoMember,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  return overwrites;
}

/**
 * Borra todos los mensajes de un canal en lotes de 100.
 * Discord solo permite bulkDelete en mensajes < 14 días.
 */
async function purgeChannel(channel) {
  try {
    let fetched;
    do {
      fetched = await channel.messages.fetch({ limit: 100 });
      if (fetched.size === 0) break;
      // bulkDelete requiere al menos 2 mensajes
      if (fetched.size === 1) {
        await fetched.first().delete().catch(() => {});
      } else {
        await channel.bulkDelete(fetched, true).catch(async () => {
          // Si bulkDelete falla (mensajes viejos), borrar uno a uno
          for (const msg of fetched.values()) {
            await msg.delete().catch(() => {});
          }
        });
      }
    } while (fetched.size >= 2);
  } catch (err) {
    console.error('[purgeChannel]', err.message);
  }
}

/**
 * Convierte el canal de intake en el ticket definitivo:
 * - Lo renombra (replacement-N, support-N, guarantee-N)
 * - Lo mueve a la categoría correcta
 * - Aplica los permisos de ticket real (staff visible)
 * - Purga todos los mensajes del intake
 * - Envía el embed de ticket con los datos recopilados
 */
async function createTicketFromIntake(session, guild, member) {
  const { ticketType, lang, data, channelId } = session;

  const STAFF_ROLE_ID = getStaff();
  const CEO_USER_ID   = getCEO();

  // Categoría según tipo de ticket
  const categoryMap = {
    replacement: process.env.CATEGORY_REPLACEMENTS || process.env.TICKETS_CATEGORY_ID || '1511848587095572572',
    support:     process.env.CATEGORY_SUPPORT      || process.env.TICKETS_CATEGORY_ID || '1511848587095572572',
    guarantee:   process.env.CATEGORY_GUARANTEES   || process.env.TICKETS_CATEGORY_ID || '1511848587095572572',
  };
  const targetCategoryId = categoryMap[ticketType];

  db.upsertUser(member.id, member.user.username);

  // Verificar con SellAuth si es reemplazo
  let verificationStatus = t(lang, 'ticket_not_verified');
  if (ticketType === 'replacement' && data.purchaseMethod === 'sellauth') {
    try {
      const { found } = await verifyPurchase(data.invoiceOrTicket, data.accounts || '');
      verificationStatus = found ? t(lang, 'ticket_verified') : t(lang, 'ticket_not_verified');
    } catch (e) { console.error('[SellAuth] Error al verificar compra:', e.message); }
  }

  // Crear ticket en DB
  const { id: ticketId, number } = db.createTicket({
    type:            ticketType,
    channelId:       channelId, // ya existe el canal
    discordId:       member.id,
    discordUsername: member.user.username,
    email:           data.invoiceOrTicket || null,
    product:         data.accounts?.split('\n')[0]?.split(':')[0] || null,
  });

  db.saveTicketForm(ticketId, {
    purchase_method:   data.purchaseMethod,
    invoice_or_ticket: data.invoiceOrTicket || '',
    accounts:          data.accounts || '',
    proof:             data.proof || '',
    lang,
  });

  if (ticketType === 'replacement') {
    db.addReplacementRecord({
      email:         data.invoiceOrTicket || member.user.username,
      product:       data.accounts?.split('\n')[0] || 'N/A',
      discordId:     member.id,
      ticketId,
      staffId:       null,
      staffUsername: null,
    });
  }

  const prefixes = { replacement: 'replacement', support: 'support', guarantee: 'guarantee' };
  const ticketName = `${prefixes[ticketType]}-${number}`;

  // ── Obtener el canal intake existente ────────────────────────────────────
  const channel = await guild.channels.fetch(channelId);

  // ── Aplicar permisos de ticket real (staff ahora puede ver) ──────────────
  const permissionOverwrites = await buildOverwrites(guild, member.id);

  // ── Renombrar + mover a categoría + actualizar permisos ──────────────────
  await channel.edit({
    name: ticketName,
    permissionOverwrites,
    ...(isValidSnowflake(targetCategoryId) ? { parent: targetCategoryId } : {}),
    topic: `Ticket de ${member.user.username} — ${ticketType} — ${data.invoiceOrTicket || ''}`,
  });

  // ── Purgar todos los mensajes del intake ─────────────────────────────────
  await purgeChannel(channel);

  // ── Actualizar channelId en DB (ya era el mismo, pero por si acaso) ───────
  db.updateTicketChannel(ticketId, channel.id);

  console.log(`[Ticket] Convertido intake→ticket ticketId=${ticketId} canal=${channel.id} (${channel.name})`);

  // ── Construir embed de datos recopilados (estilo imagen enviada) ──────────
  const typeColors  = { replacement: 0x7c5af0, support: 0x5bc8f5, guarantee: 0xf0c05a };

  // Determinar estado del comprobante
  let proofState = '—';
  let proofMethod = '—';
  if (data.purchaseMethod === 'sellauth') {
    proofState  = verificationStatus;
    proofMethod = '🛒 SellAuth';
  } else if (data.purchaseMethod === 'ticket') {
    proofState  = verificationStatus;
    proofMethod = lang === 'es' ? '🎫 Ticket anterior' : '🎫 Previous ticket';
  } else if (data.purchaseMethod === 'coupon') {
    proofState  = lang === 'es' ? '✅ Válido' : '✅ Valid';
    proofMethod = lang === 'es' ? '🎟️ Cupón' : '🎟️ Coupon';
  }

  let embedFields;
  if (ticketType === 'support') {
    embedFields = [
      { name: lang === 'es' ? '👤 Cliente'  : '👤 Client',   value: `${member} (${member.user.username})`, inline: true  },
      { name: '\u200b',                                         value: '\u200b',                              inline: false },
      { name: lang === 'es' ? '💬 Consulta' : '💬 Question', value: (data.supportQuestion || data.invoiceOrTicket || '—').slice(0, 800), inline: false },
      { name: t(lang, 'ticket_assigned'),                       value: t(lang, 'ticket_unassigned'),          inline: true  },
    ];
  } else {
    // Campos en el orden de la imagen de referencia:
    // ID factura → Cuenta → Comprobante (Estado + Método) → Atendido por
    embedFields = [
      {
        name:   lang === 'es' ? `🧾 ID factura 1` : `🧾 Invoice ID 1`,
        value:  `\`${data.invoiceOrTicket || '—'}\``,
        inline: false,
      },
      {
        name:   lang === 'es' ? `👤 Cuenta 1` : `👤 Account 1`,
        value:  (data.accounts || '—').slice(0, 300),
        inline: false,
      },
      {
        name:   lang === 'es' ? `🧾 Comprobante 1` : `🧾 Proof 1`,
        value:  [
          `${lang === 'es' ? 'Estado' : 'Status'}: ${proofState}`,
          `${lang === 'es' ? 'Método' : 'Method'}: ${proofMethod}`,
        ].join('\n'),
        inline: false,
      },
      {
        name:   t(lang, 'ticket_assigned'),
        value:  t(lang, 'ticket_unassigned'),
        inline: true,
      },
    ];
  }

  const embed = new EmbedBuilder()
    .setColor(typeColors[ticketType] || 0x7c5af0)
    .setTitle(lang === 'es' ? '✅ Listo para revisar.' : '✅ Ready to review.')
    .addFields(embedFields)
    .setFooter({ text: `User ID: ${member.id} · ${new Date().toLocaleString('es-AR')}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close ticket').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim ticket').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_unclaim').setLabel('Unclaim ticket').setStyle(ButtonStyle.Primary),
  );

  // Mencionar staff + CEO al abrir
  const staffMention = `<@&${STAFF_ROLE_ID}>`;
  const ceoMention   = `<@${CEO_USER_ID}>`;

  await channel.send({
    content: `${member} | ${staffMention} | ${ceoMention}`,
    embeds:  [embed],
    components: [row],
  });

  // Reenviar comprobante si es imagen adjunta
  if (data.proofAttachmentUrl) {
    await channel.send({ content: `📎 **${lang === 'es' ? 'Comprobante' : 'Proof'}:** ${data.proofAttachmentUrl}` });
  }

  // Log
  db.logAction({
    ticketId,
    action:        'Ticket creado',
    performedBy:   member.user.username,
    performedById: member.id,
    details:       JSON.stringify({ ticketType, method: data.purchaseMethod }),
  });
  await sendStaffLog(guild, logEmbed({
    action: 'Ticket creado',
    fields: [
      { name: '🆔 ID',      value: String(number)              },
      { name: '📂 Tipo',    value: ticketType                   },
      { name: '👤 Cliente', value: member.user.username         },
      { name: '🛒 Método',  value: data.purchaseMethod          },
      { name: '📋 Invoice', value: data.invoiceOrTicket || '—'  },
    ],
  }));

  return channel;
}

module.exports = {
  createTicketFromIntake,
  sendStaffLog,
  get CEO_USER_ID()   { return getCEO(); },
  get STAFF_ROLE_ID() { return getStaff(); },
};
