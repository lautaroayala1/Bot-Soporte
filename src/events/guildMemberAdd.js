// src/events/guildMemberAdd.js
// Asigna el rol "Verificado" a todo miembro que ingrese al servidor

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const roleId = process.env.VERIFIED_ROLE_ID;
      if (!roleId || roleId.includes('id_')) {
        console.warn('[GuildMemberAdd] VERIFIED_ROLE_ID no configurado en .env — ejecutá /setup primero.');
        return;
      }

      const role = member.guild.roles.cache.get(roleId);
      if (!role) {
        console.warn(`[GuildMemberAdd] Rol Verificado (${roleId}) no encontrado en el servidor.`);
        return;
      }

      await member.roles.add(role, 'Auto-verificado al ingresar');
      console.log(`[GuildMemberAdd] Rol Verificado asignado a ${member.user.tag}`);
    } catch (err) {
      console.error('[GuildMemberAdd] Error asignando rol Verificado:', err.message);
    }
  },
};
