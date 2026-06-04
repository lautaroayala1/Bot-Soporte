// src/utils/sellauth.js
const axios = require('axios');

const SELLAUTH_API_KEY = process.env.SELLAUTH_API_KEY;
const SELLAUTH_STORE_ID = process.env.SELLAUTH_STORE_ID;
const BASE_URL = 'https://api.sellauth.com/v1';

/**
 * Verifica si existe una compra en SellAuth por email y producto.
 * Retorna { found: true/false, order: {...} | null }
 */
async function verifyPurchase(email, product) {
  if (!SELLAUTH_API_KEY || SELLAUTH_API_KEY === 'tu_sellauth_api_key') {
    // Modo demo sin API key real
    console.warn('[SellAuth] API Key no configurada. Usando modo simulación.');
    return simulateVerification(email, product);
  }

  try {
    const response = await axios.get(`${BASE_URL}/shops/${SELLAUTH_STORE_ID}/orders`, {
      headers: {
        Authorization: `Bearer ${SELLAUTH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      params: {
        email: email,
        limit: 50,
      },
      timeout: 8000,
    });

    const orders = response.data?.data || response.data || [];

    // Buscar por email y producto (búsqueda flexible)
    const productLower = product.toLowerCase().trim();
    const found = orders.find(order => {
      const orderEmail = (order.email || order.customer_email || '').toLowerCase();
      const orderProduct = (order.product_name || order.product?.name || order.title || '').toLowerCase();
      return orderEmail === email.toLowerCase() && orderProduct.includes(productLower);
    });

    if (found) {
      return { found: true, order: found };
    }

    return { found: false, order: null };
  } catch (error) {
    console.error('[SellAuth] Error al verificar compra:', error.message);
    // En caso de error de API, dejamos pasar para revisión manual
    return { found: false, order: null, error: error.message };
  }
}

/**
 * Modo simulación cuando no hay API key configurada
 */
function simulateVerification(email, product) {
  // Simula verificación: cualquier email con @gmail.com o @hotmail.com pasa
  const validDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  const found = validDomains.includes(domain);

  return {
    found,
    order: found ? {
      id: 'SIM-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
      email,
      product_name: product,
      simulated: true,
    } : null,
    simulated: true,
  };
}

module.exports = { verifyPurchase };
