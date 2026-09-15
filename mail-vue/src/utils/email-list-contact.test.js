import assert from 'node:assert/strict'
import test from 'node:test'

import {formatEmailContact, formatRecipientList, getEmailListContact} from './email-list-contact.js'

const email = {
  type: 0,
  name: 'Cloud Mail',
  sendEmail: 'sender@example.com',
  recipient: JSON.stringify([{name: 'Client', address: 'recipient@example.com'}]),
  toEmail: 'recipient@example.com',
}

test('getEmailListContact displays sender then recipient in the inbox', () => {
  assert.equal(
    getEmailListContact(email, 'email'),
    'Cloud Mail (sender@example.com) / Client (recipient@example.com)',
  )
})

test('getEmailListContact displays recipient then sender in sent mail', () => {
  assert.equal(getEmailListContact({
    ...email,
    recipient: JSON.stringify([
      {name: 'Client', address: 'recipient@example.com'},
      {name: '', address: 'other@example.com'},
    ]),
  }, 'send'), 'Client (recipient@example.com), other@example.com / Cloud Mail (sender@example.com)')
})

test('getEmailListContact only displays the sender in all mail', () => {
  assert.equal(getEmailListContact(email, 'all-email'), 'Cloud Mail (sender@example.com)')
})

test('getEmailListContact follows message direction in starred mail', () => {
  assert.equal(
    getEmailListContact({...email, type: 1}, 'star'),
    'Client (recipient@example.com) / Cloud Mail (sender@example.com)',
  )
  assert.equal(
    getEmailListContact({...email, type: 0}, 'star'),
    'Cloud Mail (sender@example.com) / Client (recipient@example.com)',
  )
})

test('formatEmailContact adds the email in parentheses only for a real alias', () => {
  assert.equal(formatEmailContact('Alice', 'alice@example.com'), 'alice@example.com')
  assert.equal(formatEmailContact('Support', 'alice@example.com'), 'Support (alice@example.com)')
  assert.equal(formatEmailContact('', 'alice@example.com'), 'alice@example.com')
})

test('formatRecipientList displays every recipient with available names', () => {
  const recipient = JSON.stringify([
    {name: 'Alice', address: 'alice@example.com'},
    {name: '', address: 'bob@example.com'},
  ])

  assert.equal(
    formatRecipientList(recipient, 'fallback@example.com'),
    'alice@example.com, bob@example.com',
  )
})

test('formatRecipientList falls back when the recipient list is empty or missing', () => {
  assert.equal(formatRecipientList('[]', 'fallback@example.com'), 'fallback@example.com')
  assert.equal(formatRecipientList(null, 'fallback@example.com'), 'fallback@example.com')
})

test('formatRecipientList preserves a legacy plain-text recipient', () => {
  assert.equal(formatRecipientList('legacy@example.com'), 'legacy@example.com')
})
