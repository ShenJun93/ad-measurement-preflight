# Threat Model

## Primary risk: SSRF

The product accepts user-supplied URLs and therefore treats SSRF as a core product risk.

Current controls:

- HTTP(S) only; embedded URL credentials are rejected.
- `localhost` and private/reserved IPv4/IPv6 ranges are rejected.
- Hostnames are resolved before the request; any resolved non-public address rejects the destination.
- Every redirect target is normalized and validated before fetching.
- The production request transport pins DNS lookup to the already-validated IP, reducing the DNS-rebinding / validation-to-connect gap.
- Redirect count, response-body retention, request timeout, and JSON request size are bounded.

## Data exposure

The scanner may inspect public HTML and `robots.txt`, but reports do not return fetched page bodies. Submitted/final URL query strings and fragments are removed from the report. Anonymous analytics is an allowlist of event names and rejects extra URL/domain/page-content fields.

## Crawler semantics

An OAI-AdsBot-like user agent is only a simulation. It can reveal obvious CDN/WAF/auth/rate-limit behavior but cannot prove that OpenAI's real crawler can or cannot reach the page.

## Pixel semantics

Static HTML inspection can identify SDK/init evidence and obvious CSP-meta risk, but it cannot prove browser runtime execution, consent state, network delivery, or conversion events. Findings are therefore marked incomplete where appropriate.

## Residual risks

- DNS, proxy, TLS, and network-stack behavior can differ across hosting environments.
- Public endpoints can change behavior between validation and later scans.
- HTML/robots parsers are intentionally narrow and may miss complex edge cases.
- A public host can proxy internally on its own server; this scanner only constrains the destination it connects to.

Security fixes should preserve a fail-closed bias for destination validation.
