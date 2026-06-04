// src/events/ready.js
module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`✅ VortexSupport online como ${client.user.tag}`);
    client.user.setPresence({
      status: 'online',
      activities: [{ name: 'tickets de soporte', type: 3 }], // WATCHING
    });
  },
};
