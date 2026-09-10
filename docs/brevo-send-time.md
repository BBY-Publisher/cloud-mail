# Brevo send time correction

New imports and webhook backfills use a validated send timestamp: content `date`,
then the earliest valid `sent` event, then the matching list record's `date`.
Provider dates must include a timezone. Storage uses UTC; clients display local
time. Open/delivery dates and the current time are never substituted for send time.
Missing send metadata causes the import to report an error for later retry.

Inbox, sent, and admin lists order by normalized time plus email ID. New clients
send both `emailId` and `cursorTime` when loading the next page. Polling still uses
the monotonically increasing ID to discover newly inserted records. Time indexes
are added by the existing initialization/upgrade route (`dbInit.v3_9DB`); running
the upgrade repeatedly is safe. Sorting also works before those indexes exist.

## Correct existing emails

After deploying the Worker and the frontend, sign in as a super administrator,
open **All mail**, and select **Correct Brevo send times** (the history icon in Vue).
Choose the original send-date range in Brevo, up to 30 days; leave it empty to use
Brevo's default last-30-days lookup. Date filters apply to the provider lookup,
not the potentially incorrect local timestamps.

The action scans existing Brevo sent records in batches of 10, changing only
`create_time`. It neither creates emails nor updates their content, ownership,
delivery status, or read state. Matching requires the provider message ID and,
when available, recipient. Errors retain the original timestamp and appear by
local email ID. If the body has expired but valid matching list metadata remains,
the send timestamp can still be recovered.

For older records, run again with their original send-date range. Unavailable
provider history cannot be reconstructed; those records remain unchanged.
Repeating the action is safe. Stop takes effect after the current batch; leaving
the view also stops further batches. Refresh other open lists after correction.

The same operation is available to super administrators through
`POST /api/allEmail/repairBrevoTime` with a JSON body:

```json
{"afterEmailId": 0, "startDate": "2026-07-01", "endDate": "2026-07-30"}
```

Continue with the returned `nextEmailId` as `afterEmailId` while `hasMore` is true.
The response includes `processed`, `updated`, `skipped`, and `errors`. To retry
failed rows, restart at 0 with the appropriate date range. Concurrent timestamp
changes are protected by comparing the original value before writing.

This change does not enable scheduled synchronization.
