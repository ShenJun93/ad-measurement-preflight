# Preserving `oppref`

`oppref` is the OpenAI click reference appended to an ad landing-page URL. OpenAI's conversion measurement guidance says the Pixel can capture it and store it in a first-party cookie, and advertisers can include it in Conversions API events when available.

**Run a redirect preflight:** https://chatgpt-ads-tracking-checker.vercel.app/

> Independent project. Not affiliated with or endorsed by OpenAI.

## Why preservation matters

A click reference can be lost before the conversion path starts if a redirect, URL normalizer, router, or landing-page handoff drops unknown query parameters. OpenAI specifically recommends preserving `oppref` through redirects and landing-page navigation.

A typical failure looks like this:

```text
/ad?oppref=<value>&utm_source=chatgpt
        ↓ redirect
/landing?utm_source=chatgpt
```

The page still loads, but the click reference is gone.

## What this project checks

The scanner adds a **synthetic** `oppref` value to the submitted URL, follows redirects using the same SSRF-safe URL policy as the rest of the scanner, and reports whether that exact synthetic value survives to the final URL.

This proves only redirect preservation for the simulated request. It does not prove that the browser Pixel stored the real click reference, that consent/storage conditions allow it, or that a later conversion event was attributed.

## Measurement notes

OpenAI's current guidance also recommends:

- including `oppref` with server-side conversion events when available;
- using the Pixel and Conversions API together for more resilient measurement;
- using the same event ID when the same conversion is sent through both methods so OpenAI can deduplicate it.

## Official reference

- OpenAI conversion measurement: https://help.openai.com/en/articles/20001409-conversion-measurement
