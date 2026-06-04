// src/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { initDB } = require('./database/database');
const commands = require('./commands/index');

async function deploy() {
  await initDB();
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const body = commands.map(c => c.data.toJSON());

  console.log('🔄 Registrando comandos slash...');
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body });
  console.log(`✅ ${body.length} comandos registrados:`);
  body.forEach(c => console.log(`   /${c.name}`));
}

deploy().catch(err => { console.error('❌', err); process.exit(1); });
