# Ad Measurement Preflight

Open-source preflight for ad measurement paths. The current checks focus on readiness signals relevant to OpenAI Ads / ChatGPT Ads: landing reachability, OAI-AdsBot access, `oppref` redirect preservation, and basic OpenAI Measurement Pixel setup.

**Live demo:** https://chatgpt-ads-tracking-checker.vercel.app/

> Independent project. Not affiliated with or endorsed by OpenAI.

## What it checks

- Public HTTP(S) reachability and redirect termination.
- SSRF-safe destination validation on every hop, with DNS-pinned connections to the validated public IP.
- `robots.txt` rules for `OAI-AdsBot`, with wildcard fallback.
- An OAI-AdsBot-like request simulation for obvious auth, WAF/CDN, CAPTCHA, rate-limit, and HTTP failures.
- Synthetic `oppref` preservation through redirects.
- Static OpenAI Measurement Pixel SDK/init evidence and obvious CSP-meta risk.
- Deterministic PASS/WARN/FAIL findings with remediation and an explainable 0–100 score.

## Important limits

This project does **not** impersonate or prove access by OpenAI's real crawler. Its crawler check is a simulation. It also does not execute a browser, so static Pixel checks cannot prove runtime SDK execution, consent behavior, network delivery, or conversion events.

The hosted scanner does not request CAPI secrets, return fetched page bodies, or return submitted/final URL query-string values. Anonymous product analytics accepts only allowlisted event names; URL/domain/page-content fields are rejected.

## Run locally

Requires Node.js 24+.

```bash
npm start
```

Open `http://localhost:8080`.

Use another port with:

```bash
PORT=3000 npm start
```

## Verify

```bash
npm run verify
```

The test suite covers URL policy, private/reserved IP rejection, DNS pinning, redirect validation, robots rules, crawler simulation, synthetic `oppref`, static Pixel checks, report sanitization, HTTP API validation, analytics allowlisting, discoverability assets, and the Vercel handler.

## Deploy

The repository includes `vercel.json` and a serverless `api-handler.js`. A Vercel deployment serves the static UI and routes `/api/*` to the scanner handler.

## Project status

Version `0.1.1` is intentionally a narrow public preflight. Recurring monitoring, browser runtime inspection, accounts, billing, and hosted deep Pixel/CAPI reconciliation are deferred until usage evidence justifies them. See [STATUS.md](STATUS.md).

## Security and privacy

The scanner accepts arbitrary public URLs, so SSRF defense is part of the product boundary rather than an optional hardening layer. See [SECURITY.md](SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## References

Implementation semantics are checked against current public OpenAI Ads documentation, including the Measurement Pixel and Conversions API documentation. Product behavior in this repository remains deliberately narrower than the full platform surface.

- https://developers.openai.com/ads/measurement-pixel
- https://developers.openai.com/ads/conversions-api

## Contributing

Issues and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT. See [LICENSE](LICENSE).
