// Bygger en länk som öppnar Swish-appen med mottagare, belopp och meddelande ifyllt
export function swishUrl(phone, amount, message) {
  const payee = String(phone || '').replace(/[^\d+]/g, '').replace(/^\+46/, '0')
  const data = {
    version: 1,
    payee: { value: payee },
    amount: { value: Math.round(amount) },
    message: { value: message.slice(0, 50) }
  }
  return 'swish://payment?data=' + encodeURIComponent(JSON.stringify(data))
}
