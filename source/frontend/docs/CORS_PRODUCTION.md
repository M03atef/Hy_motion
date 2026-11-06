# HyMotion Web — Production CORS

Staff desk static server (`apps/web/server.js`) must **not** use wildcard CORS in production.

## Required configuration

Set an explicit comma-separated allowlist:

```bash
GFP_CORS_ALLOWED_ORIGINS=https://app.example.com,https://staff.example.com
```

`CORS_ALLOWED_ORIGINS` is accepted as a legacy alias of the same value.

## Behavior

| Environment | Allowlist set | Incoming `Origin` | Result |
|-------------|----------------|-------------------|--------|
| Production (`NODE_ENV=production`) | Yes | Listed | `Access-Control-Allow-Origin: <origin>` |
| Production | Yes | Unknown | No ACAO header (browser blocks) |
| Production | No | Same-origin only | Allowed |
| Production | No | Cross-origin | Rejected (no wildcard) |
| Non-production | No | Any | Dev convenience `*` |
| Non-production | Yes | Listed only | Allowlist enforced |

Credentials must never be combined with `Access-Control-Allow-Origin: *`. Production deployments should always set `GFP_CORS_ALLOWED_ORIGINS` to the real staff/member web origins.
