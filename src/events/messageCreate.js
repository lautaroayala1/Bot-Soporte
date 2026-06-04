// src/events/messageCreate.js
// Escucha mensajes del cliente en el canal de intake
const { handleMessage } = require('../intake/intakeManager');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    await handleMessage(message);
  },
};
