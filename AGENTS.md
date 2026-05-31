# AGENTS.md

## Project Overview

This project is a Chrome extension used to automate and enhance Prophet 21 (P21) web UI behavior.

Target application:

- Angular 16 frontend
- P21 DataWindow-style backend
- XHR-based network communication (not fetch)
- Server-driven UI updates via JSON payloads

Primary goals:

- Observe XHR requests/responses
- Detect specific business events (item changes, pricing changes)
- Trigger additional internal P21 requests
- Update UI without direct DOM manipulation when possible

---

## Architecture Preferences

Prefer this order of solutions:

1. Network-layer automation (preferred)

   - Hook XMLHttpRequest
   - Watch request URL/body
   - Watch response payload
   - Trigger additional requests

2. Internal state manipulation

   - Modify returned JSON payloads
   - Re-inject DataWindow-compatible state

3. DOM interaction (last resort)
   - Dispatch input/change events
   - Avoid brittle selectors when possible

Do NOT:

- Hardcode session IDs (`wid`, `shellid`)
- Hardcode timestamps (`ts`)
- Depend on Angular private internals unless necessary

Always dynamically capture:

- wid
- shellid
- current row identifiers
- active item data

---

## Known P21 Patterns

Common request types:

- `/ui/full/v2/data/data`
- `/ui/full/v1/grid/.../elements/state`

Important query params:

- `wid` = active window ID
- `shellid` = application shell/session
- `dw` / `dwName` = datawindow name
- `fn` = backend function name
- `ts` = timestamp/cachebuster

Typical payload structure:

```ts
{
  Data: {},
  DataInformation: {},
  Events: [],
  Properties: {},
  Result: {},
  Success: true
}
```

Watch especially:

- `Events`
- `Properties`
- `TP_ITEMS.items`

Coding Standards

Use TypeScript.

Prefer:

small focused modules
clear function names
minimal globals
defensive null checks
console logging behind debug flag

Example naming:

installXhrWatcher()
extractWid()
extractShellId()
matchOneTimePriceRequest()
triggerFollowupRequest()
Debugging

Include temporary logs for:

request URL
request body
response body
matched conditions

Format:

console.log("[P21 EXT]", ...)

Easy to grep/remove later.

Refactor Goal

Move from ad-hoc scripts toward:

xhr-monitor.ts
request-parser.ts
p21-types.ts
ui-hooks.ts

Keep business logic separate from transport logic.
