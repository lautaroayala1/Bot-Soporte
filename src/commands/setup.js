// src/commands/setup.js
const { MessageFlags,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { SERVER_STRUCTURE, CEO_USER_ID, STAFF_ROLE_ID_FIXED } = require('../utils/setupConfig');
const { successEmbed, errorEmbed } = require('../utils/embeds');

// Map para guardar los IDs creados: key → id
// Se persiste en memoria durante la sesión (suficiente para /setup)
const setupResult = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configura el servidor completo: categorías, canales, roles y permisos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed('Sin permisos', 'Solo administradores pueden usar /setup.')], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const log   = [];

    try {
      // ── FASE 1: ROLES ────────────────────────────────────
      await interaction.editReply({ embeds: [progressEmbed('⚙️ Creando roles...', 10)] });

      for (const roleDef of SERVER_STRUCTURE.roles) {
        // Buscar si ya existe
        let role = guild.roles.cache.find(r => r.name === roleDef.name);
        if (!role) {
          role = await guild.roles.create({
            name:        roleDef.name,
            color:       roleDef.color,
            hoist:       roleDef.hoist,
            permissions: roleDef.permissions,
            mentionable: roleDef.mentionable,
            reason:      'VortexSupport /setup',
          });
          log.push(`✅ Rol creado: **${roleDef.name}**`);
        } else {
          log.push(`♻️ Rol existente: **${roleDef.name}**`);
        }
        setupResult[roleDef.key] = role.id;
      }

      // Asignar rol Owner al CEO
      try {
        const ceoMember = await guild.members.fetch(CEO_USER_ID);
        const ownerRole = guild.roles.cache.get(setupResult['owner']);
        if (ceoMember && ownerRole && !ceoMember.roles.cache.has(ownerRole.id)) {
          await ceoMember.roles.add(ownerRole);
          log.push(`👑 Rol Owner asignado a <@${CEO_USER_ID}>`);
        }
      } catch (e) { log.push(`⚠️ No se pudo asignar Owner al CEO: ${e.message}`); }

      // ── FASE 2: CATEGORÍAS Y CANALES ─────────────────────
      await interaction.editReply({ embeds: [progressEmbed('📁 Creando categorías y canales...', 40)] });

      const staffRoleObj = guild.roles.cache.get(setupResult['staff'])
        || guild.roles.cache.get(STAFF_ROLE_ID_FIXED);
      const clientRoleObj = guild.roles.cache.get(setupResult['client']);
      const everyoneRole  = guild.roles.everyone;

      for (const cat of SERVER_STRUCTURE.categories) {
        // Crear / encontrar categoría
        let category = guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name === cat.name
        );

        const catOverwrites = buildCategoryOverwrites(
          everyoneRole, staffRoleObj, clientRoleObj, cat.staffOnly
        );

        if (!category) {
          category = await guild.channels.create({
            name:                cat.name,
            type:                ChannelType.GuildCategory,
            permissionOverwrites: catOverwrites,
            reason:              'VortexSupport /setup',
          });
          log.push(`📁 Categoría creada: **${cat.name}**`);
        } else {
          await category.permissionOverwrites.set(catOverwrites);
          log.push(`♻️ Categoría actualizada: **${cat.name}**`);
        }
        setupResult[cat.key] = category.id;

        // Crear canales dentro de la categoría
        for (const chDef of cat.channels) {
          let channel = guild.channels.cache.find(
            c => c.name === chDef.name && c.parentId === category.id
          );

          const chOverwrites = buildChannelOverwrites(
            everyoneRole, staffRoleObj, clientRoleObj, chDef, cat.staffOnly
          );

          if (!channel) {
            channel = await guild.channels.create({
              name:                chDef.name,
              type:                ChannelType.GuildText,
              parent:              category.id,
              topic:               chDef.topic || '',
              permissionOverwrites: chOverwrites,
              reason:              'VortexSupport /setup',
            });
            log.push(`💬 Canal creado: **${chDef.name}**`);
          } else {
            await channel.permissionOverwrites.set(chOverwrites);
            log.push(`♻️ Canal actualizado: **${chDef.name}**`);
          }
          setupResult[chDef.key] = channel.id;
        }
      }

      // ── FASE 3: GUARDAR IDs EN .env (log al admin) ───────
      await interaction.editReply({ embeds: [progressEmbed('💾 Finalizando configuración...', 85)] });

      // ── FASE 4: AUTO-PUBLICAR PANEL DE TICKETS ───────────
      const panelChannel = guild.channels.cache.get(setupResult['ch_panel']);
      if (panelChannel) {
        await publishTicketPanel(panelChannel, guild);
        log.push(`🎫 Panel de tickets publicado en <#${panelChannel.id}>`);
      }

      // ── FASE 5: AUTO-PUBLICAR TOS ────────────────────────
      const tosChannel = guild.channels.cache.get(setupResult['ch_tos']);
      if (tosChannel) {
        await publishTOSPanel(tosChannel);
        log.push(`📄 Panel de TOS publicado en <#${tosChannel.id}>`);
      }

      // ── RESULTADO FINAL ───────────────────────────────────
      const envLines = buildEnvOutput();

      const resultEmbed = new EmbedBuilder()
        .setColor(0x3ddc97)
        .setTitle('✅ Setup completado')
        .setDescription(log.join('\n'))
        .addFields({
          name: '📋 Variables .env generadas',
          value: `\`\`\`env\n${envLines}\n\`\`\``,
        })
        .setFooter({ text: 'Copiá estas variables a tu .env y reiniciá el bot.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [resultEmbed] });

    } catch (err) {
      console.error('[Setup] Error:', err);
      return interaction.editReply({
        embeds: [errorEmbed('Error en /setup', `${err.message}\n\nRevisá que el bot tenga permisos de Administrador.`)],
      });
    }
  },
};

// ── HELPERS DE PERMISOS ───────────────────────────────────────────────────────

function buildCategoryOverwrites(everyoneRole, staffRole, clientRole, staffOnly) {
  const ows = [{ id: everyoneRole, deny: [PermissionFlagsBits.ViewChannel] }];

  if (staffRole) {
    ows.push({
      id: staffRole,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  if (!staffOnly && clientRole) {
    ows.push({
      id: clientRole,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  return ows;
}

function buildChannelOverwrites(everyoneRole, staffRole, clientRole, chDef, staffOnly) {
  const ows = [{ id: everyoneRole, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }];

  if (staffRole) {
    ows.push({
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

  if (!staffOnly && !chDef.botOnly && clientRole) {
    if (chDef.readonly) {
      // Solo lectura para clientes
      ows.push({
        id: clientRole,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny:  [PermissionFlagsBits.SendMessages],
      });
    } else {
      ows.push({
        id: clientRole,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.UseApplicationCommands,
        ],
      });
    }
  }

  return ows;
}

// ── PUBLICAR PANEL DE TICKETS ─────────────────────────────────────────────────

async function publishTicketPanel(channel, guild) {
  const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

  // Limpiar mensajes del bot anteriores
  const msgs = await channel.messages.fetch({ limit: 10 });
  const botMsgs = msgs.filter(m => m.author.bot);
  for (const m of botMsgs.values()) await m.delete().catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(0x7c5af0)
    .setTitle('⚡ Support System / Sistema de Soporte')
    .setDescription(
      '**Bienvenido al soporte de VortexGG / Welcome to VortexGG Support.**\n\n' +
      'Por favor seleccioná tu idioma para continuar.\n' +
      'Please select your language to continue.'
    )
    .setFooter({ text: 'VortexGG Support · Solo abrí un ticket si realmente lo necesitás.' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('panel_lang_select')
      .setPlaceholder('Select language / Seleccionar idioma')
      .addOptions([
        { label: '🇦🇷 Español', value: 'es', description: 'Continuar en español' },
        { label: '🇺🇸 English', value: 'en', description: 'Continue in English' },
      ])
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ── PUBLICAR PANEL DE TOS ─────────────────────────────────────────────────────

async function publishTOSPanel(channel) {
  const { TOS } = require('./tos');

  // Limpiar bot messages anteriores
  const msgs = await channel.messages.fetch({ limit: 10 });
  for (const m of msgs.filter(m => m.author.bot).values()) await m.delete().catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(0x7c5af0)
    .setTitle('📋 Términos del Servicio / Terms of Service')
    .setDescription(
      'Hacé clic en el botón de abajo para consultar los T.O.S completos de VortexGG.\n' +
      'Click the button below to view VortexGG\'s full T.O.S.\n\n' +
      '*Última vez modificado / Last modified: Abril 2026*'
    )
    .setFooter({ text: 'VortexGG Shop · Al comprar aceptás estos términos.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tos_show_es')
      .setLabel('Español')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tos_show_en')
      .setLabel('English')
      .setStyle(ButtonStyle.Primary),
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ── ENV OUTPUT ────────────────────────────────────────────────────────────────

function buildEnvOutput() {
  const lines = [
    `CATEGORY_REPLACEMENTS=${setupResult['cat_replacements'] || ''}`,
    `CATEGORY_SUPPORT=${setupResult['cat_support'] || ''}`,
    `CATEGORY_GUARANTEES=${setupResult['cat_guarantees'] || ''}`,
    `CATEGORY_INTAKE=${setupResult['cat_intake'] || ''}`,
    `PANEL_CHANNEL_ID=${setupResult['ch_panel'] || ''}`,
    `LOGS_CHANNEL_ID=${setupResult['ch_logs'] || ''}`,
    `TRANSCRIPTS_CHANNEL_ID=${setupResult['ch_transcripts'] || ''}`,
    `STAFF_ROLE_ID=${setupResult['staff'] || ''}`,
    `CLIENT_ROLE_ID=${setupResult['client'] || ''}`,
    `VERIFIED_ROLE_ID=${setupResult['verified'] || ''}`,
    `CEO_ROLE_ID=${setupResult['owner'] || ''}`,
  ];
  return lines.join('\n');
}

function progressEmbed(text, percent) {
  const filled = Math.round(percent / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return new EmbedBuilder()
    .setColor(0x7c5af0)
    .setTitle('⚙️ Configurando servidor...')
    .setDescription(`${text}\n\n\`[${bar}] ${percent}%\``);
}

// Export también publishTOSPanel para poder llamarlo desde /tos
module.exports.publishTOSPanel = publishTOSPanel;
