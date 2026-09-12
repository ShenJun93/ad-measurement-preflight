# OAI-AdsBot readiness

OAI-AdsBot is the crawler advertisers need to allow for ChatGPT Ads landing-page validation and review. OpenAI also recommends allowing OAI-SearchBot, but OAI-AdsBot is the crawler to prioritize for ads readiness.

**Run a preflight:** https://chatgpt-ads-tracking-checker.vercel.app/

> Independent project. Not affiliated with or endorsed by OpenAI.

## What usually blocks it

A landing page can be public in a normal browser and still be inaccessible to an ads crawler. Common blockers include:

- `robots.txt` rules that disallow the landing path;
- WAF, CDN, or bot-mitigation rules that reject automated traffic;
- authentication or geo restrictions;
- CAPTCHA or human-verification challenges;
- rate limiting, especially HTTP 429 responses;
- redirect chains that end on a blocked or non-public destination.

OpenAI's advertiser guidance explicitly calls out robots rules, web protection layers, authentication, and rate limiting as areas to inspect when its crawler cannot reach a page.

## What this project checks

The preflight reads `robots.txt`, applies OAI-AdsBot-specific rules with wildcard fallback, and sends an **OAI-AdsBot-like simulated request** to look for obvious HTTP, auth, challenge, and rate-limit failures.

That simulation is useful for finding configuration problems, but it is not proof that OpenAI's real crawler can reach the page. Real crawler access can still depend on infrastructure, network reputation, bot-verification systems, and production logs that this tool cannot see.

## Recommended verification order

1. Confirm the landing URL is publicly reachable without authentication.
2. Confirm `robots.txt` permits OAI-AdsBot on the relevant paths.
3. Review WAF/CDN/bot-management rules for blocks or challenges.
4. Check production logs for 403, 429, challenge, or auth responses around crawler attempts.
5. Re-submit or re-review the ad after access is fixed when required by the ads workflow.

## Official reference

- OpenAI advertiser crawler guidance: https://help.openai.com/en/articles/20001243-advertiser-guidance-for-allowing-openai-web-crawlers
