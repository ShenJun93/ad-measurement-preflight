# Contributing

Keep changes small, testable, and inside the scanner's current scope.

## Before opening a pull request

1. Use Node.js 24+.
2. Add or update a focused `node:test` test for behavior changes.
3. Run `npm run verify` and include the result in the PR description.
4. Preserve the SSRF and privacy boundaries: no private-network fetching, no raw page-body output, no URL query-string telemetry, and no client-side CAPI secret handling.
5. Do not broaden the project into a generic ad-tech suite without an issue that explains the concrete user problem and why it belongs in this repository.

Documentation and reproducible bug reports are welcome even when no code change is proposed.
