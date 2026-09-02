# Security Policy

## Supported version

Security fixes currently target the latest `0.1.x` code on `main`.

## Reporting a vulnerability

Do not publish exploitable SSRF, request-smuggling, credential-leak, or data-exposure details in a public issue before a fix is available. Prefer GitHub's private vulnerability reporting / security-advisory flow for this repository when available.

Useful reports include the affected commit, reproducible input, observed destination/request behavior, and why the existing URL/IP validation or data-minimization boundary is bypassed.

## Security boundary

The scanner is designed to fetch only public HTTP(S) destinations. Every redirect destination is validated, private/reserved IP ranges are rejected, and the production transport pins the connection to a validated IP to reduce DNS-rebinding / TOCTOU risk.

No claim is made that these controls eliminate every network-layer risk. See `docs/THREAT_MODEL.md` for the current assumptions and residual risks.
