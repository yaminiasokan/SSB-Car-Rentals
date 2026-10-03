/**
 * SIMULATED payment gateway — no real money is ever processed and no card data is stored.
 * Replace `simulateGateway` with Razorpay / Stripe / PayU calls for production.
 *
 * Demo triggers for testing failures:
 *   • Card number ending in 0000        → declined
 *   • UPI ID containing "fail"          → declined
 *   • Net banking option "Test Bank (Fail)" → declined
 */
const AppError = require('../utils/AppError');

const fieldError = (field, msg) => new AppError(msg, 422, { fields: { [field]: msg } });
const cardBrand = (n) => (/^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'Amex' : /^(6|8)/.test(n) ? 'RuPay' : 'Card');

function simulateGateway(method, d = {}) {
  switch (method) {
    case 'UPI': {
      const upi = String(d.upiId || '').trim();
      if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upi)) throw fieldError('upiId', 'Enter a valid UPI ID, for example name@okbank.');
      if (/fail/i.test(upi)) return { ok: false, reason: 'Your bank declined the UPI request. No money was taken — try another UPI ID or payment method.' };
      return { ok: true, details: { upiId: upi.replace(/^(.{2}).*(@.*)$/, '$1***$2') } };
    }
    case 'Credit Card':
    case 'Debit Card': {
      const number = String(d.cardNumber || '').replace(/\s+/g, '');
      if (!/^\d{16}$/.test(number)) throw fieldError('cardNumber', 'Enter the 16-digit card number.');
      if (!String(d.cardName || '').trim()) throw fieldError('cardName', 'Enter the name on the card.');
      const m = String(d.expiry || '').match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/);
      if (!m) throw fieldError('expiry', 'Enter the expiry as MM/YY.');
      const expires = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59, 59);
      if (expires < new Date()) throw fieldError('expiry', 'This card has expired.');
      if (!/^\d{3,4}$/.test(String(d.cvv || ''))) throw fieldError('cvv', 'Enter the 3 or 4 digit CVV.');
      if (number.endsWith('0000')) return { ok: false, reason: 'Card declined: insufficient funds (simulated). No money was taken.' };
      return { ok: true, details: { last4: number.slice(-4), brand: cardBrand(number) } };
    }
    case 'Net Banking': {
      if (!String(d.bank || '').trim()) throw fieldError('bank', 'Choose your bank.');
      if (/fail/i.test(d.bank)) return { ok: false, reason: 'The bank could not complete the transfer. No money was taken.' };
      return { ok: true, details: { bank: String(d.bank).slice(0, 60) } };
    }
    case 'Cash on Pickup':
      return { ok: true, pending: true, details: {} };
    default:
      throw fieldError('method', 'Choose a payment method.');
  }
}

module.exports = { simulateGateway };
