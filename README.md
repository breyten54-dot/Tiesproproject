# Tiespro Project

Marketing website and internal costing tool for **Tiespro Training Institute** — a TETA-accredited training provider repositioning learnerships as a tax-efficient youth-employment strategy for transport, logistics and supply-chain employers.

## Repository layout

```
├── app/                    # Deployable PWA (Vercel-ready)
│   ├── index.html          # Branded cover / splash page
│   ├── home.html           # Marketing homepage
│   ├── tool.html           # Costing & quotation tool
│   ├── tool.js             # Costing tool logic (extracted from tool.html)
│   ├── sw.js               # Service worker for offline support
│   ├── manifest.webmanifest# PWA manifest
│   ├── 404.html            # Branded 404 page
│   ├── robots.txt          # Crawler instructions
│   ├── sitemap.xml         # SEO sitemap
│   ├── vercel.json         # Vercel headers (no-cache SW, manifest MIME)
│   ├── icons/              # PWA icons
│   └── screenshots/        # Wide/narrow screenshots referenced by the manifest
├── pricing-tool/           # Standalone legacy costing tool
│   ├── Tiespro_Costing_Tool.html
│   └── icons/              # Self-contained icon set
├── docs/                   # Business documents (DOCX, PPTX, XLSX)
├── archive/                # Old files zip
└── README.md               # This file
```

## Deploying the PWA

The `app/` directory is the deployable web app.

### Vercel

1. Connect the repo to Vercel.
2. Set the **Root Directory** to `app`.
3. Deploy. `vercel.json` ensures:
   - `sw.js` is served with `Cache-Control: no-cache` so updates propagate immediately.
   - `manifest.webmanifest` is served with `Content-Type: application/manifest+json`.

### Manual / static host

Serve the contents of `app/` from any static host. The service worker expects the app to be served from the root of its scope.

## Costing tool features

- Live cost breakdown with hidden-cost buffers, overheads and target-margin pricing.
- Discount slider with colour-coded margin indicator (green / amber / red), capped at 25% and applied to the standard programme only.
- Locality-aware travel, accommodation and venue costing.
- Per-learner materials, PPE, SETA/QCTO registration, EISA and certification costs.
- Qualification day defaults (training/assessment/moderation/revision) sourced from each qualification's registered SAQA credit value — see the Curriculum Day Reference table under Rate Assumptions. Taxi Driver is explicitly flagged "Unverified" since no public credit record could be confirmed.
- Revision Days as a separate, non-discounted add-on line (pre-EISA exam prep).
- Staff sign-in (PIN-based, in-browser only) with Manager / Staff roles — Staff cannot see Rate Assumptions or Staff & Access. No accounts ship by default: the first person to open the tool on a device creates the first (Manager) account themselves via a one-time setup screen, so no names/PINs ever live in source control.
- Manager-approval workflow: quotes needing sign-off (margin below floor, or discount above 15%) block "Generate Client Quote" until a manager approves or rejects (with comment) from the Quote Tracker.
- Quote Tracker: pipeline status (Draft/Sent/Follow-up Due/Won/Lost), follow-up dates with overdue highlighting, approval status, and dashboard stat chips — plus export, import, duplicate, search and bulk-clear.
- Auto-save draft so accidental tab closes don’t lose work.
- Client-ready printable/PDF quotation.
- Keyboard shortcuts:
  - `Ctrl + S` — save quote
  - `Ctrl + P` — generate client quote
  - `Ctrl + 1..5` — switch tabs (Build, Quote Tracker, Rate Assumptions, Staff & Access, Help)
- Offline support via service worker.

### Security note on staff sign-in

The staff directory (names, roles, PINs) and session are stored entirely in browser `localStorage` and enforced client-side only. Treat it as a convenience layer for a trusted internal team — not protection for financial or client-sensitive data. Anyone with basic developer-tools knowledge could bypass it; real access control would need a server-side login.

## Legacy standalone tool

`pricing-tool/Tiespro_Costing_Tool.html` is a self-contained copy of the costing tool that uses a `window.storage` bridge when hosted inside a wrapper app, falling back to in-memory storage otherwise. It keeps the same UI, logic and security improvements as the PWA version.

## Development notes

- No build step required — plain HTML, CSS and vanilla JavaScript.
- `tool.js` is linted with `node --check`.
- After significant changes, bump the cache name in `app/sw.js` so returning users get the new version.
- Update SARS travel/subsistence rates and contractor day rates in the **Rate Assumptions** tab at least annually.

## Important disclaimer

All Section 12H, ETI and B-BBEE figures shown in the tool and website are illustrative. Final numbers are verified against each client’s own payroll and tax position by a registered tax practitioner before appearing in a signed proposal.
