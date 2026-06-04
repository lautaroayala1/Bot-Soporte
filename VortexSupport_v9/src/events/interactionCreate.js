// src/events/interactionCreate.js
const { MessageFlags } = require('discord.js');
const { handleSelectMenu, handleButton } = require('../handlers/interactionHandler');
const commands = require('../commands/index');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = commands.find(c => c.data.name === interaction.commandName);
        if (cmd) await cmd.execute(interaction);
        return;
      }
      if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
        return;
      }
      if (interaction.isButton()) {
        await handleButton(interaction);
        return;
      }
    } catch (err) {
      console.error('[InteractionCreate]', err);
      const payload = { content: '❌ Error inesperado. Contactá a un administrador.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
