export function formatRecipientList(recipient, fallback = '') {
  let recipientList = recipient

  if (typeof recipientList === 'string') {
    try {
      recipientList = JSON.parse(recipientList)
    } catch (_) {
      return recipientList.trim() || fallback
    }
  }

  if (!Array.isArray(recipientList)) return fallback

  const recipients = recipientList.map(item => {
    if (typeof item === 'string') return item.trim()

    const name = String(item?.name || '').trim()
    const address = String(item?.address || item?.email || '').trim()

    if (name && address) return `${name} <${address}>`
    return address || name
  }).filter(Boolean)

  return recipients.join(', ') || fallback
}

export function getEmailListContact(email) {
  if (Number(email?.type) !== 1) return email?.name || ''
  return formatRecipientList(email?.recipient, email?.toEmail)
}
