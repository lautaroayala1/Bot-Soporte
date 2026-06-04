// src/utils/setupConfig.js
// Configuración completa del servidor que aplica /setup

const { PermissionFlagsBits } = require('discord.js');

// ── IDs fijos (los mismos de ticketHandler) ──
const CEO_USER_ID   = '1511845432018469086';
const STAFF_ROLE_ID_FIXED = '1511845355396927528';

/**
 * Estructura del servidor a crear con /setup
 * Categorías → Canales → Roles → Permisos
 */
const SERVER_STRUCTURE = {
  roles: [
    {
      key: 'owner',
      name: '👑 Owner',
      color: 0xf0c05a,
      hoist: true,
      position: 100,
      permissions: [PermissionFlagsBits.Administrator],
      mentionable: false,
    },
    {
      key: 'staff',
      name: '🛡️ Staff',
      color: 0x7c5af0,
      hoist: true,
      position: 90,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseApplicationCommands,
      ],
      mentionable: true,
    },
    {
      key: 'client',
      name: '🛒 Cliente',
      color: 0x3ddc97,
      hoist: false,
      position: 10,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.UseApplicationCommands,
      ],
      mentionable: false,
    },
    {
      key: 'verified',
      name: '✅ Verificado',
      color: 0x5bc8f5,
      hoist: false,
      position: 5,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.UseApplicationCommands, // necesario para abrir tickets
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
      mentionable: false,
    },
  ],

  categories: [
    // ─── INFORMACIÓN ───────────────────────────────────────
    {
      key: 'cat_info',
      name: '📋 INFORMACIÓN',
      channels: [
        {
          key: 'ch_rules',
          name: '📜・reglas',
          type: 'text',
          topic: 'Reglas del servidor',
          readonly: true,   // clientes solo leen
        },
        {
          key: 'ch_tos',
          name: '📄・términos-de-servicio',
          type: 'text',
          topic: 'Términos y condiciones de Vortex Shop',
          readonly: true,
        },
        {
          key: 'ch_announcements',
          name: '📢・anuncios',
          type: 'text',
          topic: 'Anuncios oficiales de Vortex Shop',
          readonly: true,
        },
      ],
    },

    // ─── SOPORTE ────────────────────────────────────────────
    {
      key: 'cat_support_panel',
      name: '🎫 SOPORTE',
      channels: [
        {
          key: 'ch_panel',
          name: '🎫・abrir-ticket',
          type: 'text',
          topic: 'Abrí tu ticket de soporte aquí',
          readonly: true,   // clientes solo interactúan con el select
        },
      ],
    },

    // ─── TICKETS ────────────────────────────────────────────
    {
      key: 'cat_replacements',
      name: '📦 REEMPLAZOS',
      staffOnly: true,
      channels: [],
    },
    {
      key: 'cat_support',
      name: '⚙️ SOPORTE TÉCNICO',
      staffOnly: true,
      channels: [],
    },
    {
      key: 'cat_guarantees',
      name: '🛡️ GARANTÍAS',
      staffOnly: true,
      channels: [],
    },
    {
      key: 'cat_intake',
      name: '🔄 INTAKE',
      staffOnly: true,
      channels: [],
    },

    // ─── STAFF ──────────────────────────────────────────────
    {
      key: 'cat_staff',
      name: '👮 STAFF',
      staffOnly: true,
      channels: [
        {
          key: 'ch_staff_general',
          name: '💬・staff-general',
          type: 'text',
          topic: 'Canal de comunicación interna del staff',
          readonly: false,
        },
        {
          key: 'ch_logs',
          name: '📝・logs-staff',
          type: 'text',
          topic: 'Registro automático de acciones del bot',
          readonly: false,
          botOnly: true,
        },
        {
          key: 'ch_transcripts',
          name: '📚・transcripts',
          type: 'text',
          topic: 'Transcripts de tickets cerrados',
          readonly: false,
          botOnly: true,
        },
      ],
    },
  ],
};

module.exports = { SERVER_STRUCTURE, CEO_USER_ID, STAFF_ROLE_ID_FIXED };
