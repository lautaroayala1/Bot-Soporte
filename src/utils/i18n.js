// src/utils/i18n.js
// Textos bilingüe para todo el bot

const texts = {
  es: {
    // Panel
    panel_title: 'Sistema de Soporte / Support System',
    panel_desc: '**Bienvenido al soporte de VortexGG.**\nPor favor seleccioná tu idioma preferido para continuar.\n\nPlease select your preferred language to continue.',
    panel_select_placeholder: 'Seleccionar idioma / Select language',
    panel_lang_es: '🇦🇷 Español',
    panel_lang_en: '🇺🇸 English',

    // Intake - pasos
    intake_welcome: (user) => `👋 Hola **${user}**, voy a ayudarte a preparar tu ticket antes de enviarlo al staff.\n\nVoy a hacerte unas preguntas. Tenés **5 minutos** por respuesta.`,
    intake_type_q: '¿Cómo realizaste tu compra?',
    intake_type_sellauth: '🛒 Por SellAuth (tienda web)',
    intake_type_ticket: '🎫 Por ticket anterior de Discord',
    intake_invoice_q: '📋 Enviame el **Invoice ID** de tu compra.\nLo encontrás en el correo de compra o en el panel de SellAuth → *My Orders*.',
    intake_invoice_example: 'Ejemplo: `94fbc5b0079f5-0000012514230`',
    intake_ticket_q: '🎫 Enviame el **número de ticket** de tu compra anterior.\nEjemplo: `replacement-1521`',
    intake_accounts_q: (invoiceId) => `✅ Invoice recibido: \`${invoiceId}\`\n\nAhora enviame las **cuentas que no funcionan**.\nFormato: \`correo:contraseña\` o solo \`correo\` si es FA.\n\nTambién podés escribir el nombre del servicio (ej: **Netflix**, **Disney**) o \`todas\` para añadir todas las cuentas del invoice.`,
    intake_proof_q: '📸 Enviame el **comprobante de pago** (captura de pantalla o link).\nSi no tenés, escribí `no tengo`.',
    intake_summary_title: '📋 Resumen de tu solicitud',
    intake_summary_ready: '✅ Todo listo. Cuando estés listo, presioná el botón para enviar tu ticket al staff.',
    intake_open_btn: '🎫 Abrir Ticket',
    intake_cancel_btn: '❌ Cancelar',
    intake_timeout: '⏰ Tiempo agotado. El proceso fue cancelado. Podés volver a intentarlo desde el panel.',
    intake_cancelled: '❌ Proceso cancelado.',
    intake_already_open: '⚠️ Ya tenés un proceso de intake abierto. Revisá tu canal temporal.',
    ticket_created: (channel) => `✅ Tu ticket fue creado en ${channel}. El staff te atenderá pronto.`,

    // Ticket
    ticket_initial_title: (type) => ({
      replacement: '📦 Ticket de Reemplazo',
      support: '⚙️ Ticket de Soporte',
      guarantee: '🛡️ Ticket de Garantía',
    })[type] || '🎫 Ticket',
    ticket_client: 'Cliente',
    ticket_product: 'Producto / Servicio',
    ticket_purchase_method: 'Método de compra',
    ticket_invoice: 'Invoice ID / Ticket',
    ticket_accounts: 'Cuentas con problema',
    ticket_proof: 'Comprobante',
    ticket_status: 'Estado',
    ticket_assigned: 'Asignado',
    ticket_unassigned: 'Sin asignar',
    ticket_verified: '✅ Compra verificada',
    ticket_not_verified: '❌ Sin verificar — revisar manual',
    ticket_footer: 'VortexGG Support',

    // Errores
    err_no_ticket: 'Este canal no es un ticket.',
    err_no_perms: 'No tenés permisos para usar este comando.',
    err_already_claimed: (who) => `Este ticket ya fue reclamado por **${who}**.`,
    err_only_claimer: (who) => `Solo **${who}** puede cerrar este ticket.`,
    err_wrong_type: 'Este comando solo aplica en tickets de reemplazo.',
  },

  en: {
    panel_title: 'Support System / Sistema de Soporte',
    panel_desc: '**Welcome to VortexGG Support.**\nPlease select your preferred language to continue.\n\nPor favor seleccioná tu idioma preferido para continuar.',
    panel_select_placeholder: 'Select language / Seleccionar idioma',
    panel_lang_es: '🇦🇷 Español',
    panel_lang_en: '🇺🇸 English',

    intake_welcome: (user) => `👋 Hi **${user}**, I'll help you prepare your ticket before sending it to staff.\n\nI'll ask you a few questions. You have **5 minutes** per answer.`,
    intake_type_q: 'How did you make your purchase?',
    intake_type_sellauth: '🛒 Through SellAuth (web store)',
    intake_type_ticket: '🎫 Through a previous Discord ticket',
    intake_invoice_q: '📋 Send me the **Invoice ID** of your purchase.\nYou can find it in your purchase email or in SellAuth → *My Orders*.',
    intake_invoice_example: 'Example: `94fbc5b0079f5-0000012514230`',
    intake_ticket_q: '🎫 Send me the **ticket number** of your previous purchase.\nExample: `replacement-1521`',
    intake_accounts_q: (invoiceId) => `✅ Invoice received: \`${invoiceId}\`\n\nNow send me the **accounts that are not working**.\nFormat: \`email:password\` or just \`email\` if it's 2FA.\n\nYou can also type the service name (e.g. **Netflix**, **Disney**) or \`all\` to include all accounts from the invoice.`,
    intake_proof_q: '📸 Send me the **proof of payment** (screenshot or link).\nIf you don\'t have one, type `I don\'t have it`.',
    intake_summary_title: '📋 Summary of your request',
    intake_summary_ready: '✅ All set. When you\'re ready, press the button to submit your ticket to staff.',
    intake_open_btn: '🎫 Open Ticket',
    intake_cancel_btn: '❌ Cancel',
    intake_timeout: '⏰ Timed out. The process was cancelled. You can try again from the panel.',
    intake_cancelled: '❌ Process cancelled.',
    intake_already_open: '⚠️ You already have an open intake process. Check your temporary channel.',
    ticket_created: (channel) => `✅ Your ticket was created in ${channel}. Staff will assist you soon.`,

    ticket_initial_title: (type) => ({
      replacement: '📦 Replacement Ticket',
      support: '⚙️ Support Ticket',
      guarantee: '🛡️ Guarantee Ticket',
    })[type] || '🎫 Ticket',
    ticket_client: 'Client',
    ticket_product: 'Product / Service',
    ticket_purchase_method: 'Purchase method',
    ticket_invoice: 'Invoice ID / Ticket',
    ticket_accounts: 'Accounts with issues',
    ticket_proof: 'Proof of payment',
    ticket_status: 'Status',
    ticket_assigned: 'Assigned',
    ticket_unassigned: 'Unassigned',
    ticket_verified: '✅ Purchase verified',
    ticket_not_verified: '❌ Unverified — manual review',
    ticket_footer: 'VortexGG Support',

    err_no_ticket: 'This channel is not a ticket.',
    err_no_perms: 'You do not have permission to use this command.',
    err_already_claimed: (who) => `This ticket was already claimed by **${who}**.`,
    err_only_claimer: (who) => `Only **${who}** can close this ticket.`,
    err_wrong_type: 'This command only applies to replacement tickets.',
  },
};

function t(lang, key, ...args) {
  const locale = texts[lang] || texts['es'];
  const val = locale[key];
  if (typeof val === 'function') return val(...args);
  return val || key;
}

module.exports = { t, texts };
