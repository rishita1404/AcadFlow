# Performance Optimization Results — AcadFlow (Evaluation 2)

**Date:** 2026-11-15  
**Audit Tool:** Google Lighthouse 13.6.0  
**Test URL:** Production Preview Mode (`http://localhost:4173/login`)  

---

## 1. Before vs After Comparison Table

| Metric | Baseline (Dev / Pre-Opt) | After Optimization (Production) | Target | Result |
|---|---|---|---|---|
| **Lighthouse Performance Score** | **67 / 100** | **98 / 100** | ≥ 90 | 🎯 **EXCEEDED (+31 pts)** |
| **Largest Contentful Paint (LCP)** | 39.9 s | **2.3 s** | < 2.5 s | 🎯 **PASSED (-94.2%)** |
| **Total Blocking Time (TBT)** | 340 ms | **0 ms** | < 200 ms | 🎯 **ZERO MAIN-THREAD BLOCKING** |
| **Cumulative Layout Shift (CLS)** | 0.00 | **0.00** | < 0.1 | 🎯 **ZERO LAYOUT SHIFT** |
| **Total JavaScript Transfer** | 6,545 kB | **110.57 kB** | < 150 kB initial | 🎯 **PASSED (33 kB gzipped core)** |
| **Font Assets Shipped** | 10 files (270 kB, multi-charset) | **2 files (84.8 kB, Latin only)** | Latin only | 🎯 **PASSED (68.5% smaller)** |
| **Vite Manual Chunks** | 1 single chunk (warning) | **Vendor chunks + 35 route lazy chunks** | No warning | 🎯 **PASSED (Zero warnings)** |

---

## 2. Summary of Applied Improvements

1. **Route-Level Code Splitting:**
   - Every route in `frontend/src/app/router.jsx` migrated from static imports to `React.lazy()` with `<Suspense fallback={<BrandedSkeleton />}>`.
   - Core entry bundle shrunk to **100.03 kB minified (33.25 kB gzipped)**.

2. **Vite Manual Chunking:**
   - Configured `vendor-react`, `vendor-router`, `vendor-query`, `vendor-charts`, and `vendor-lucide` to isolate library caching from application code changes.
   - Eliminated the Vite `(!) Some chunks are larger than 500 kB` warning.

3. **Latin Font Subsetting:**
   - Replaced full `@fontsource-variable` imports with Latin-only `@font-face` rules in `frontend/src/styles/fonts.css`.
   - Dropped Greek, Cyrillic, and Vietnamese font variants from the build.
   - Added font preloading in `frontend/index.html` with `font-display: swap`.

4. **Component Memoization:**
   - Profiled and wrapped `StatusBadge`, `CourseCard`, and `KpiCard` in `React.memo`.
   - Wrapped critical derived lists and risk band calculations in `useMemo` in `StudentHome` and `CoordinatorSummary`.

5. **Telemetry & Real User Monitoring:**
   - Installed `web-vitals` library and added non-blocking `navigator.sendBeacon` client reporting for LCP, INP, CLS, and TTFB.
   - Built backend beacon receiver `POST /api/v1/metrics/web-vitals` with rate limiting and Prometheus histogram exposition on `/metrics`.
