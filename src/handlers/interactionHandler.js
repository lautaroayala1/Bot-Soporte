// src/handlers/interactionHandler.js
const { MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../database/database');
const intake = require('../intake/intakeManager');
const { createTicketFromIntake, sendStaffLog } = require('./ticketHandler');
const { generateTranscriptHTML, uploadTranscript } = require('../utils/transcript');
const { successEmbed, errorEmbed, logEmbed, warningEmbed } = require('../utils/embeds');
const { t } = require('../utils/i18n');

function isStaff(member) {
  return member.permissions.has('Administrator') ||
    member.roles.cache.has(process.env.STAFF_ROLE_ID || '1511845355396927528') ||
    (process.env.CEO_ROLE_ID && member.roles.cache.has(process.env.CEO_ROLE_ID));
}

// =============================================
// SELECT MENU — idioma en el panel principal
// =============================================
async function handleSelectMenu(interaction) {
  const { customId, values } = interaction;

  if (customId === 'panel_lang_replacement') {
    const lang = values[0];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return await launchIntake(interaction, lang, 'replacement');
  }
  if (customId === 'panel_lang_support') {
    const lang = values[0];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return await launchIntake(interaction, lang, 'support');
  }
  if (customId === 'panel_lang_guarantee') {
    const lang = values[0];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return await launchIntake(interaction, lang, 'guarantee');
  }

  if (customId === 'panel_lang_select') {
    const lang = values[0];
    const { StringSelectMenuBuilder } = require('discord.js');
    const typeOptions = lang === 'es'
      ? [
          { label: '📦 Reemplazo',       description: 'Tu producto dejó de funcionar',   value: `replacement_${lang}` },
          { label: '⚙️ Soporte Técnico', description: 'Tenés un problema técnico',       value: `support_${lang}`     },
          { label: '🛡️ Garantía',        description: 'Aplicar garantía de compra',      value: `guarantee_${lang}`   },
        ]
      : [
          { label: '📦 Replacement',     description: 'Your product stopped working',    value: `replacement_${lang}` },
          { label: '⚙️ Technical Support', description: 'You have a technical issue',   value: `support_${lang}`     },
          { label: '🛡️ Guarantee',       description: 'Apply purchase guarantee',        value: `guarantee_${lang}`   },
        ];

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('panel_type_select')
        .setPlaceholder(lang === 'es' ? 'Seleccioná el tipo de soporte...' : 'Select support type...')
        .addOptions(typeOptions)
    );

    const embed = new EmbedBuilder()
      .setColor(0x7c5af0)
      .setDescription(lang === 'es' ? '¿Qué tipo de soporte necesitás?' : 'What type of support do you need?');

    return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  }

  if (customId === 'panel_type_select') {
    const [ticketType, lang] = values[0].split('_');
    await interaction.deferUpdate();
    return await launchIntake(interaction, lang, ticketType);
  }

  if (customId.startsWith('intake_purchase_type_')) {
    return await intake.handlePurchaseTypeSelect(interaction);
  }
}

// =============================================
// LANZAR INTAKE
// =============================================
async function launchIntake(interaction, lang, ticketType) {
  const { guild, member } = interaction;

  if (intake.hasSession(member.id)) {
    const session = intake.getSession(member.id);
    const ch = guild.channels.cache.get(session.channelId);
    const msg = lang === 'es'
      ? `⚠️ Ya tenés un proceso abierto${ch ? ` en ${ch}` : ''}. Completalo antes de abrir otro.`
      : `⚠️ You already have an open process${ch ? ` in ${ch}` : ''}. Complete it before opening another.`;
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg });
    }
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }

  const { channel } = await intake.startIntake(guild, member, lang, ticketType);

  const msg = lang === 'es'
    ? `✅ Te abrí un canal privado: ${channel}. Respondé las preguntas para continuar.`
    : `✅ I opened a private channel for you: ${channel}. Answer the questions to continue.`;

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content: msg });
  }
  return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
}

// =============================================
// BOTONES
// =============================================
async function handleButton(interaction) {
  const { customId, guild, member, channel } = interaction;

  // TOS buttons
  if (customId === 'tos_show_es' || customId === 'tos_show_en') {
    const { handleTOSButton } = require('../commands/tos');
    return await handleTOSButton(interaction);
  }

  // Intake: confirmar abrir ticket
  if (customId.startsWith('intake_confirm_')) {
    return await intake.handleConfirm(interaction, createTicketFromIntake);
  }
  // Intake: cancelar
  if (customId.startsWith('intake_cancel_')) {
    return await intake.handleCancel(interaction);
  }

  // ---- Botones del ticket (solo staff) ----
  if (!isStaff(member)) {
    return interaction.reply({ embeds: [errorEmbed('Sin permisos', 'Solo el staff puede usar estos botones.')], flags: MessageFlags.Ephemeral });
  }

  // ── CLAIM ────────────────────────────────────────────────────────────────
  if (customId === 'ticket_claim') {
    const ticket = db.getTicketByChannel(channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });
    if (ticket.status === 'claimed') {
      return interaction.reply({ embeds: [warningEmbed('Ya reclamado', t('es', 'err_already_claimed', ticket.claimed_by))], flags: MessageFlags.Ephemeral });
    }
    db.claimTicket(ticket.id, member.id, member.user.username);
    db.logAction({ ticketId: ticket.id, action: 'Ticket reclamado', performedBy: member.user.username, performedById: member.id });

    await sendStaffLog(guild, logEmbed({
      action: 'Ticket reclamado',
      fields: [
        { name: '🎫 Ticket', value: String(ticket.ticket_number) },
        { name: '👤 Staff',  value: member.user.username },
      ],
    }));

    // Actualizar campo "Atendido por" en el embed del ticket
    try {
      const msgs = await channel.messages.fetch({ limit: 10 });
      const botMsg = msgs.find(m => m.author.bot && m.embeds.length > 0);
      if (botMsg) {
        const embed = EmbedBuilder.from(botMsg.embeds[0]);
        const fields = embed.data.fields || [];
        const idx = fields.findIndex(f =>
          f.name.includes('Assigned') || f.name.includes('Asignado') || f.name.includes('Atendido')
        );
        if (idx !== -1) fields[idx].value = `🔒 ${member.user.username}`;
        embed.setFields(fields);
        await botMsg.edit({ embeds: [embed] });
      }
    } catch (_) {}

    return interaction.reply({ embeds: [successEmbed('Ticket reclamado', `🔒 Tomado por **${member.user.username}**`)] });
  }

  // ── UNCLAIM ───────────────────────────────────────────────────────────────
  if (customId === 'ticket_unclaim') {
    const ticket = db.getTicketByChannel(channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });

    db.unclaimTicket?.(ticket.id);  // solo si existe en la DB
    db.logAction({ ticketId: ticket.id, action: 'Ticket liberado', performedBy: member.user.username, performedById: member.id });

    // Actualizar campo "Atendido por" en el embed
    try {
      const msgs = await channel.messages.fetch({ limit: 10 });
      const botMsg = msgs.find(m => m.author.bot && m.embeds.length > 0);
      if (botMsg) {
        const embed = EmbedBuilder.from(botMsg.embeds[0]);
        const fields = embed.data.fields || [];
        const idx = fields.findIndex(f =>
          f.name.includes('Assigned') || f.name.includes('Asignado') || f.name.includes('Atendido')
        );
        if (idx !== -1) fields[idx].value = t('es', 'ticket_unassigned');
        embed.setFields(fields);
        await botMsg.edit({ embeds: [embed] });
      }
    } catch (_) {}

    return interaction.reply({ embeds: [successEmbed('Ticket liberado', `🔓 Liberado por **${member.user.username}**`)] });
  }

  // ── CLOSE ─────────────────────────────────────────────────────────────────
  if (customId === 'ticket_close') {
    const ticket = db.getTicketByChannel(channel.id);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Error', t('es', 'err_no_ticket'))], flags: MessageFlags.Ephemeral });

    if (ticket.status === 'claimed' && ticket.claimed_by_id && ticket.claimed_by_id !== member.id && !member.permissions.has('Administrator')) {
      return interaction.reply({ embeds: [errorEmbed('Sin permisos', t('es', 'err_only_claimer', ticket.claimed_by))], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    await closeTicketFlow(interaction, ticket, channel, guild, member);
  }
}

// =============================================
// CIERRE DE TICKET (compartido con /close)
// =============================================
async function closeTicketFlow(interaction, ticket, channel, guild, member) {
  const messages = await db.getTicketMessages(channel);
  let transcriptUrl = null;

  try {
    const { filePath, hash, ticketName } = generateTranscriptHTML({
      ticket,
      forms: db.getTicketForms(ticket.id),
      messages,
      staffUsername: member.user.username,
    });

    // Subir al servidor Railway y obtener URL pública
    transcriptUrl = await uploadTranscript(filePath, hash);

    // También enviar al canal de transcripts interno (sin adjunto, solo el link)
    if (transcriptUrl) {
      const tChId = process.env.TRANSCRIPTS_CHANNEL_ID;
      if (tChId) {
        try {
          const tCh = await guild.channels.fetch(tChId);
          if (tCh) {
            await tCh.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x7c5af0)
                  .setTitle('📄 Transcript')
                  .setURL(transcriptUrl)
                  .addFields(
                    { name: '🎫 Ticket',   value: ticketName,                           inline: true },
                    { name: '👤 Cliente',  value: ticket.discord_username || 'N/A',     inline: true },
                    { name: '🔒 Mod',      value: member.user.username,                 inline: true },
                    { name: '🔗 Ver transcript', value: `[Ver online](${transcriptUrl})`, inline: false },
                  )
                  .setTimestamp(),
              ],
            });
          }
        } catch (e) { console.error('[Transcript channel send]', e.message); }
      }
    }
  } catch (e) {
    console.error('[Transcript]', e);
  }

  const closedTicket = db.closeTicket(ticket.id, member.id, member.user.username);
  db.logAction({
    ticketId:      ticket.id,
    action:        'Ticket cerrado',
    performedBy:   member.user.username,
    performedById: member.id,
    details:       `${closedTicket?.duration_minutes || 0} min`,
  });

  await sendStaffLog(guild, logEmbed({
    action: 'Ticket cerrado',
    fields: [
      { name: '🎫 Ticket',    value: String(ticket.ticket_number) },
      { name: '👤 Staff',     value: member.user.username },
      { name: '⏱️ Duración', value: `${closedTicket?.duration_minutes || 0} minutos` },
      ...(transcriptUrl ? [{ name: '🔗 Transcript', value: transcriptUrl }] : []),
    ],
  }));

  // ── DM al cliente con el historial (estilo imagen enviada) ─────────────────
  try {
    const clientId = ticket.discord_id || ticket.discordId;
    const clientMember = clientId ? await guild.members.fetch(clientId).catch(() => null) : null;

    if (clientMember) {
      const ticketPrefix = { replacement: 'replacement', support: 'support', guarantee: 'guarantee' };
      const ticketNum = `${ticketPrefix[ticket.ticket_type]}-${ticket.ticket_number}`;
      const closedAt = new Date().toLocaleString('es-AR', {
        day: '2-digit', month: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const totalMessages = messages.length;

      const dmEmbed = new EmbedBuilder()
        .setColor(0x7c5af0)
        .setTitle(`🗂️ Historial — Ticket #${ticket.ticket_number}`)
        .setDescription(
          `Tu ticket **#${ticket.ticket_number}** fue cerrado por ${member}.\n` +
          (transcriptUrl
            ? `🔗 [Ver transcript online](${transcriptUrl})\n📁 También podés abrirlo en tu navegador.`
            : '📁 El transcript está siendo procesado.') +
          `\n¿Necesitás más ayuda? Abrí un nuevo ticket en el servidor.`
        )
        .addFields(
          { name: '🎫 Ticket',    value: `#${ticket.ticket_number}`, inline: true },
          { name: '💬 Mensajes',  value: String(totalMessages),       inline: true },
          { name: '📅 Cerrado',   value: closedAt,                    inline: true },
        )
        .setFooter({ text: 'VortexGG Shop • Gracias por elegirnos 💜' })
        .setTimestamp();

      await clientMember.send({ embeds: [dmEmbed] }).catch(() => {
        // Si el cliente tiene DMs cerrados, silenciar error
        console.log(`[Transcript] No se pudo enviar DM a ${clientMember.user.tag}`);
      });
    }
  } catch (e) {
    console.error('[DM cliente]', e.message);
  }

  if (interaction.editReply) {
    await interaction.editReply({
      embeds: [successEmbed('Ticket cerrado', 'El canal se eliminará en 5 segundos.')],
    });
  }
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

module.exports = { handleSelectMenu, handleButton, closeTicketFlow };
