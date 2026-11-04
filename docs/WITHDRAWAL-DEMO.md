# Withdrawal display and fee-flow preview

The client withdrawal details open in a centered, scrollable modal with focus trapping and background scroll locking. The record ID is omitted. Wallet addresses and references display shortened values; copy buttons copy the complete stored value.

New withdrawals entered through the admin form receive a `WR-` UUID reference automatically. This is an internal record reference, not a blockchain transaction hash. Existing references are preserved. No database migration is required for this display change.

Admin → Withdrawals → **Withdrawal fee flow → Open demo** previews a separate simulation:

- Select up to five demo tokens from the ten available assets.
- Choose Slow, Medium, or Fast using fictional credits without monetary value.
- Select a token and inspect a locally generated QR containing plain demo text.
- Copy a deliberately invalid destination such as `DEMO-ONLY-ETH-NOT-A-WALLET-00000000`.
- Simulate submission, pending state, and admin approval.

The demo is admin-only. It makes no payment or database requests, does not accelerate transactions, and resets on refresh. It does not use real wallet addresses. Client withdrawal records never depend on completing this preview.

Checks: production build, withdrawal component render tests, offline customer-email tests, component lint, and browser walkthrough of priority/token/QR/pending/approval/close at desktop and mobile sizes. Physical scanning with a phone has not been tested.
