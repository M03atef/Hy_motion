# HyMotion — Flutter Member App: Product photos are blank

> **Copy everything inside the `PROMPT` fence below** into a Flutter AI session / hand to a Flutter developer.
>
> Staff web already shows these photos (Sale + Member Orders). The Member App does not.
> This is a **client URL / Image widget bug**, not a missing Product API.
> Do **not** call staff `/api/inventory/products`.

---

```
PROMPT — HyMotion Member App: FIX product photos (Flutter)
You are a senior Flutter developer on the HyMotion Member App (Egypt / MENA).
Arabic primary + English secondary. RTL when locale is Arabic.

This prompt FIXES blank product photos in Store (list, detail, cart, my-order lines).
It does NOT add a new feature. It does NOT change checkout, auth, or staff APIs.

Read and obey Frontend/FLUTTER_MEMBER_APP_PROMPT.md for stack, STYLE A API_BASE, JWT, and forbidden staff routes.

═══════════════════════════════════════════════════════════════════
0) WHAT IS BROKEN (BINDING)
═══════════════════════════════════════════════════════════════════

Staff desk shows the same catalog photos (example: بروتين / FITNESS pack shot).
The Member App shows an empty placeholder instead.

Root cause (almost always one of these — fix ALL of them):

1) imageUrl from the API is RELATIVE, e.g.
     "/uploads/products-{tenantId}/xxxx.jpg"
   Image.network / CachedNetworkImage cannot load a path without a host.

2) You joined the path onto API_BASE which already ends with /api:
     WRONG:  https://HOST/api + /uploads/...  →  https://HOST/api/uploads/...   (404)
     RIGHT:  https://HOST     + /uploads/...  →  https://HOST/uploads/...

3) Backend sometimes returns an ABSOLUTE localhost URL:
     "https://localhost:5001/uploads/..."
   That works in a PC browser. On a phone, localhost is the PHONE.
   Rewrite localhost / 127.0.0.1 / 10.0.2.2 to the same host as API_BASE.

4) Ngrok free interstitial: <img> / CachedNetworkImage does NOT send
     ngrok-skip-browser-warning: true
   so the “browser” HTML page is returned instead of the JPEG.
   JSON API calls work (Dio has the header). Images do not — unless YOU add the header.

5) You read the wrong JSON key (photoUrl / image / picture) instead of imageUrl.
   Dart fromJson must accept imageUrl (camelCase). ASP.NET may also emit ImageUrl.

6) Order-history lines may omit imageUrl. Join the photo from the products
   you already loaded (Map<productId, imageUrl>), not a second staff API.

7) BoxFit.cover on a short tile crops the pack shot. Use BoxFit.contain
   on a light square pad (#F7F8F6). Same rule as staff Sale tiles.

Photos that are null/empty are VALID (owner never uploaded). Show one placeholder.
Never draw TWO boxes (real photo + empty icon). That was a staff-web bug; do not copy it.

═══════════════════════════════════════════════════════════════════
1) FORBIDDEN
═══════════════════════════════════════════════════════════════════

- GET/POST /api/inventory/products  (staff, inventory.view/manage)
- GET /api/inventory/products/image
- GET /api/members/{id} for a photo
- Unsplash / fake people grids / random gym stock photos
- Inventing a second image CDN
- Changing POST /member-store/orders
- Showing SKU, warehouse, or cost price on Member App tiles

═══════════════════════════════════════════════════════════════════
2) LIVE API (already shipping)
═══════════════════════════════════════════════════════════════════

STYLE A: API_BASE ends with /api. Paths do NOT repeat /api.

GET {API_BASE}/member-store/products?q=
Policy: AuthenticatedMember + FeatureFlag("inventory")
→ array (or PagedResult.items) of MemberStoreProductDto:

{
  "id": "guid",
  "categoryId": "guid?",
  "categoryName": "string?",
  "sku": "string",
  "name": "string",
  "nameAr": "string?",
  "description": "string?",
  "descriptionAr": "string?",
  "brand": "string?",
  "imageUrl": "string?",          // THIS FIELD. relative or absolute.
  "unitOfMeasure": "string",
  "sellPrice": 1000,
  "currency": "EGP",
  "allowFractionalQty": false,
  "trackStock": true,
  "availableQty": 12,
  "inStock": true
}

GET {API_BASE}/member-store/orders/{id}
→ lines[] may include productId, productName, qty, unitPrice, lineTotal.
  imageUrl on a line is OPTIONAL. If missing, look up productId in the
  in-memory product cache from GET /member-store/products.

Offers banners (if you already built Offers): reuse the SAME resolveMediaUrl
helper for bannerUrl. Do not invent a second resolver.

═══════════════════════════════════════════════════════════════════
3) REQUIRED HELPER — put in one place, use everywhere
═══════════════════════════════════════════════════════════════════

Suggested: lib/core/media_url.dart

Inputs:
- raw: product.imageUrl (or offer.bannerUrl)
- apiBase: the same API_BASE Dio uses, e.g. "https://xxxx.ngrok-free.dev/api"

Algorithm:

  String? resolveMediaUrl(String? raw, String apiBase) {
    if (raw == null) return null;
    final u = raw.trim();
    if (u.isEmpty) return null;
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;

    final origin = Uri.parse(apiBase.endsWith('/') ? apiBase : '$apiBase/')
        .replace(path: '', query: '', fragment: '')
        .origin;
    // origin is scheme://host[:port]  — NO /api

    Uri parsed;
    if (u.startsWith('http://') || u.startsWith('https://')) {
      parsed = Uri.parse(u);
    } else {
      final path = u.startsWith('/') ? u : '/$u';
      parsed = Uri.parse('$origin$path');
    }

    final host = parsed.host.toLowerCase();
    final loopback = host == 'localhost' || host == '127.0.0.1' || host == '10.0.2.2';
    if (loopback) {
      final apiHost = Uri.parse(origin);
      parsed = parsed.replace(
        scheme: apiHost.scheme,
        host: apiHost.host,
        port: apiHost.hasPort ? apiHost.port : null,
      );
    }
    return parsed.toString();
  }

Unit-test these cases (must pass):

  apiBase = "https://reach-lullaby-tighten.ngrok-free.dev/api"

  "/uploads/products-aaa/p.jpg"
    → "https://reach-lullaby-tighten.ngrok-free.dev/uploads/products-aaa/p.jpg"
    NOT ".../api/uploads/..."

  "https://localhost:5001/uploads/products-aaa/p.jpg"
    → "https://reach-lullaby-tighten.ngrok-free.dev/uploads/products-aaa/p.jpg"

  "" and null → null (placeholder, not a broken Image.network)

  "https://cdn.example.com/x.jpg" → unchanged (non-loopback absolute)

═══════════════════════════════════════════════════════════════════
4) IMAGE WIDGET (one widget, reuse)
═══════════════════════════════════════════════════════════════════

Suggested: ProductPhoto(url: resolved, size: 72)

Rules:
- Square tile, rounded ~12
- Background #F7F8F6 (light studio pad)
- BoxFit.contain  — NEVER BoxFit.cover
- If url == null → one grey photo icon, no second box
- If load fails → same placeholder (onError). Do not leave a broken Image
- cached_network_image is OK IF you pass httpHeaders:

    {
      "ngrok-skip-browser-warning": "true",
    }

  Use the same header Dio already sends. Uploads are public files — do NOT
  require Authorization on the image GET unless you prove 401 in Charles/Proxyman.

- Android: if you still hit HTTP (not HTTPS) on LAN, allow cleartext only for
  that debug host in network security config. Prefer HTTPS ngrok / 5001.

Debug (required until photos work):
  debugPrint('product photo raw=${product.imageUrl} resolved=$resolved');
Open the resolved URL in the phone’s Chrome. If Chrome shows the JPEG, the
widget is wrong. If Chrome 404s, the resolver is still wrong.

═══════════════════════════════════════════════════════════════════
5) WHERE TO APPLY
═══════════════════════════════════════════════════════════════════

- Store product grid / list tile
- Store product detail hero
- Cart line
- My orders list (if you show a product thumb)
- My order detail lines

Parse imageUrl in the product DTO:

  imageUrl: json['imageUrl'] ?? json['ImageUrl'] ?? json['relativeUrl']

Do not parse sku as an image. Do not use name as an image.

═══════════════════════════════════════════════════════════════════
6) ACCEPTANCE
═══════════════════════════════════════════════════════════════════

1) Broteen / بروتين tile shows the FITNESS pack shot (same file the staff
   Products desk uploaded), not a blank icon, not two icons.
2) A product with no imageUrl still shows ONE placeholder — app does not crash.
3) No request to /api/inventory/*.
4) Resolved URL never contains "/api/uploads/".
5) Photos work on a physical device against ngrok (not only the emulator).
6) Arabic name stays (بروتين). Photo is independent of locale.

When done: paste 3 debugPrint lines (raw → resolved) and a screenshot of the
Store grid with photos into the PR / chat.
```
