// src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./database/database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Cargar eventos
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Validar .env
const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
const missing = required.filter(k => !process.env[k] || process.env[k].includes('tu_'));
if (missing.length) {
  console.warn(`⚠️  Variables faltantes en .env: ${missing.join(', ')}`);
}

// Inicializar DB y luego loguear
console.log('🔄 Iniciando base de datos...');
initDB()
  .then(() => {
    console.log('✅ Base de datos lista.');
    return client.login(process.env.DISCORD_TOKEN);
  })
  .catch(err => {
    console.error('❌ Error al iniciar:', err.message);
    process.exit(1);
  });

process.on('unhandledRejection', err => console.error('[UnhandledRejection]', err));
