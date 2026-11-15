# React Profiler Notes — Component Re-rendering Optimization (Lab 20)

**Date:** 2026-11-15  
**Tool:** React DevTools Profiler / Static Dependency Analysis  

---

## 1. High-Frequency Re-render Hotspots Identified

### A. `StatusBadge.jsx`
- **Issue:** Rendered across every course card, directory table row, notification item, risk snapshot, and timetable tile. Parent re-renders (such as polling intervals or search state input) caused unnecessary virtual DOM reconciliation for all badges on screen simultaneously (~50+ instances on directory and dashboard pages).
- **Optimization:** Wrapped in `React.memo(StatusBadge)`. The component is purely functional and depends on scalar props (`band`, `status`, `value`, `size`).
- **Result:** 0 wasted re-renders when parent states change without badge prop changes.

### B. `CourseCard.jsx`
- **Issue:** Rendered on `StudentHome`, `FacultyHome`, and `CoordinatorSummary`. Whenever student warning polls or notice feeds fired (every 60s), every course card re-rendered in its entirety including the inner SVG `BufferGauge`.
- **Optimization:** Wrapped in `React.memo(CourseCard)`.
- **Result:** Re-renders prevented during background notifications and warnings refresh cycles.

### C. `StudentHome.jsx`
- **Issue:** On every render, four separate array filtering and iteration passes were executed:
  1. `courses` array fallback normalization
  2. Worst risk band derivation loop (`worstBand`)
  3. `unreadNoticesCount` filter
  4. `todayClasses` timetable filter
- **Optimization:** Memoized with `useMemo(..., [dash?.courses])`, `useMemo(..., [courses])`, `useMemo(..., [notices])`, and `useMemo(..., [timetable])`.
- **Result:** Derived calculations are now cached and only re-evaluate when their specific queries resolve new data.

### D. `CoordinatorSummary.jsx`
- **Issue:** `KpiCard` components and `BAND_BLOCKS` arrays were re-instantiated on every state change of the batch and semester filter dropdowns, even though total student counts had not changed.
- **Optimization:** `KpiCard` wrapped in `React.memo`, `courses` and `BAND_BLOCKS` wrapped in `useMemo`.
- **Result:** Filter changes only update the relevant downstream view without re-creating static KPI cards.
