# Performance Baseline — AcadFlow (Evaluation 2)

**Date:** 2026-11-15  
**Environment:** macOS, Node.js v20, Vite 5.4, Chrome Headless  
**Audit Tool:** Google Lighthouse 13.6.0  

---

## 1. Initial Measurements Summary

### Route: `/login` (Baseline)

| Metric | Raw Measured Value | Target | Status |
|---|---|---|---|
| **Performance Score** | **67 / 100** | ≥ 90 | ⚠️ Needs Optimization |
| **Largest Contentful Paint (LCP)** | **39.9 s** | < 2.5 s | ⚠️ Unoptimized bundles & dev server latency |
| **Total Blocking Time (TBT)** | **340 ms** | < 200 ms | ⚠️ Long task on main thread |
| **Cumulative Layout Shift (CLS)** | **0.00** | < 0.1 | ✅ Passed |
| **Initial Production JS Bundle** | **769.97 kB** (175.89 kB gzip) | < 150 kB gzip initial | ⚠️ Exceeds 150 kB target; Vite single-chunk warning |
| **Fonts Shipped in Build** | 10 files (270 kB) including Cyrillic, Greek, Vietnamese | Latin only (< 85 kB) | ⚠️ Ships unnecessary non-Latin font subsets |

---

## 2. Identified Bottlenecks

1. **No Code Splitting:** `frontend/src/app/router.jsx` statically imports all 35+ page components into a single massive index bundle (`769.97 kB`).
2. **Font Subsets:** `@fontsource-variable/inter` and `@fontsource-variable/fraunces` import `index.css`, which includes Cyrillic, Greek, and Vietnamese glyphs.
3. **No Vendor Chunking:** Core libraries (React, React Router, TanStack Query, Recharts, Lucide) are bundled into the primary application chunk instead of cached vendor chunks.
4. **Missing Web Vitals Ingestion:** No automated RUM (Real User Monitoring) beaconing for LCP, INP, CLS, or TTFB.
