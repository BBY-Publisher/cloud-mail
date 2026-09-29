export function getCcAddresses(cc) {
  let recipients = cc

  if (typeof recipients === 'string') {
    try {
      recipients = JSON.parse(recipients)
    } catch (_) {
      return []
    }
  }

  if (!Array.isArray(recipients)) return []

  return recipients.map(recipient => {
    const address = typeof recipient === 'string' ? recipient : recipient?.address
    return typeof address === 'string' ? address.trim() : ''
  }).filter(Boolean)
}
