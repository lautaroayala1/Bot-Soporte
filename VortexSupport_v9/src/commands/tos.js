// src/commands/tos.js
// Comando /tos para publicar el panel manualmente
// Y la lógica del botón tos_show_es / tos_show_en

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { TOS } = require('../utils/tos');
const { errorEmbed, successEmbed } = require('../utils/embeds');

// ── Genera el embed con el TOS completo ──────────────────────────────────────
function buildTOSEmbed(lang) {
  const data = TOS[lang] || TOS['es'];
  const color = lang === 'en' ? 0x5bc8f5 : 0x7c5af0;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 ${data.title}`)
    .setDescription(`*${data.lastUpdate}*\n\u200b`)
    .setFooter({ text: 'VortexGG Shop' })
    .setTimestamp();

  for (const section of data.sections) {
    embed.addFields({ name: section.title, value: section.body, inline: false });
  }

  return embed;
}

// ── Comando /tos ─────────────────────────────────────────────────────────────
const tosCommand = {
  data: new SlashCommandBuilder()
    .setName('tos')
    .setDescription('Publica el panel de Términos de Servicio (solo admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed('Sin permisos', 'Solo administradores.')], flags: MessageFlags.Ephemeral });
    }
    const { publishTOSPanel } = require('./setup');
    await publishTOSPanel(interaction.channel);
    return interaction.reply({ embeds: [successEmbed('TOS publicado', 'Panel de términos enviado.')], flags: MessageFlags.Ephemeral });
  },
};

// ── Handler del botón tos_show_es / tos_show_en ──────────────────────────────
async function handleTOSButton(interaction) {
  const lang = interaction.customId === 'tos_show_en' ? 'en' : 'es';
  const embed = buildTOSEmbed(lang);
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { tosCommand, handleTOSButton, buildTOSEmbed };
