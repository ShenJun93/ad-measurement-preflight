# Architecture

The repository has four small runtime boundaries:

1. **URL policy and transport** — `src/preflight/url-policy.js` rejects unsafe URL forms and private/reserved destinations; `http-probe.js` validates each redirect hop and pins the outbound connection to a validated IP.
2. **Measurement checks** — `robots.js`, `attribution.js`, and `pixel-static.js` convert observable HTTP/static evidence into narrow readiness signals.
3. **Report orchestration** — `scan.js` coordinates landing, robots, crawler-simulation, synthetic `oppref`, and static Pixel checks; `findings.js` groups and scores the results.
4. **Delivery surface** — `server.js` provides the local HTTP app; `api-handler.js` provides the Vercel serverless API; `index.html`, `app.js`, and `styles.css` render the zero-signup UI.

The public scanner intentionally does not require the earlier Chrome-extension diagnostic code. That deeper browser path is not part of this repository's initial acquisition flow.

## Data flow

```text
landing URL
  -> normalize / reject unsafe forms
  -> DNS resolve / reject non-public addresses
  -> pinned HTTP(S) probe
  -> validate each redirect again
  -> robots + crawler simulation + synthetic oppref + static Pixel inspection
  -> sanitized deterministic report
  -> browser UI
```

The report strips URL credentials, query strings, fragments, and fetched page bodies before returning data to the UI.
