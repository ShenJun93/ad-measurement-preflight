# ChatGPT Ads measurement preflight

A measurement setup can look correct in Ads Manager and still fail at the landing-page or conversion-path boundary. This preflight is designed to catch a narrow set of launch-time failures before they turn into missing or ambiguous conversion data.

**Run the live checker:** https://chatgpt-ads-tracking-checker.vercel.app/

> Independent project. Not affiliated with or endorsed by OpenAI.

## Preflight checklist

### 1. Landing page

- Public HTTP(S) URL resolves and returns a usable response.
- Redirects terminate normally.
- Every redirect destination remains public and expected.

### 2. Ads crawler readiness

- `robots.txt` allows OAI-AdsBot on the landing path.
- WAF/CDN/bot controls do not obviously return auth, challenge, 403, or 429 responses to an OAI-AdsBot-like request.
- Production infrastructure is still the authority for real crawler access; this tool only simulates.

### 3. Click-reference preservation

- A synthetic `oppref` survives redirects without dropping existing query parameters.
- Application routing and landing-page navigation should also preserve the real click reference where applicable.

### 4. Pixel readiness

- The page source contains evidence of the OpenAI Measurement Pixel SDK and initialization when expected.
- Obvious CSP restrictions are surfaced.
- Static HTML evidence is **not** runtime proof: this project does not execute a browser, consent flow, tag manager, or network beacon.

### 5. Conversion-path verification outside this tool

OpenAI's conversion guidance says conversion events may be sent with the Pixel, the Conversions API, or both. When the same conversion is sent through both, use the same event ID for deduplication. Validate actual event delivery, event naming, consent, timestamps, and server-side payloads in the systems that own those signals.

## What a passing preflight means

A PASS means the checks this project can observe did not find a blocking condition. It does **not** certify attribution, real OAI-AdsBot access, browser runtime behavior, or Ads Manager reporting.

That boundary is deliberate: the goal is a fast, explainable launch check, not a false guarantee of end-to-end attribution.

## Official references

- OpenAI advertiser crawler guidance: https://help.openai.com/en/articles/20001243-advertiser-guidance-for-allowing-openai-web-crawlers
- OpenAI conversion measurement: https://help.openai.com/en/articles/20001409-conversion-measurement
- Measurement Pixel: https://developers.openai.com/ads/measurement-pixel
- Conversions API: https://developers.openai.com/ads/conversions-api
