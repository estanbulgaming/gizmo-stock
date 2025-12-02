<!-- cc8f1731-56dd-42cd-9de3-7627d81cb9b0 d2efbe2f-8e91-4935-9927-5fb1ea28744f -->
# Gizmo Stock - Project Analysis and Improvement Plan

## Overview

Stock management application built with React + TypeScript + Tailwind CSS. Core functionality works but needs refactoring and improvements.

---

## P0 - Immediate Priority (Gizmo API Stability)

### 0. Gizmo API Tests and CI/CD Integration

**Goal**: Prevent API contract breakage with comprehensive tests

**Files**: `services/api.ts`, `types/stock.ts`

**Tasks**:

1. **API Contract Tests** (`services/__tests__/api.test.ts`)
   - Test `fetchProducts` response parsing
   - Test `fetchProductGroups` response parsing
   - Test stock update (`POST /api/stock/{id}/{count}`)
   - Test product update (`PUT /api/v2.0/products`)
   - Mock API responses with realistic data
   - Test error handling (4xx, 5xx responses)

2. **Type Guards and Validators** (`types/gizmo-api.ts`)
   - Define strict API response types
   - Create runtime validators (zod or manual)
   - Ensure type safety for all API interactions

3. **CI/CD Enhancement** (`.github/workflows/ci.yml`)
   - Add API contract test step (before build)
   - Fail build on API test failures
   - Add test coverage threshold (e.g., 80% for services/)

**Why First**: API changes frequently break the app. Tests will catch regressions early.

---

## P1 - Core Refactoring

### 1. App.tsx Monolithic Structure (4883 lines)

**File**: `App.tsx`

**Problem**: All application logic in single file, hard to maintain

**Impact**: Poor readability, difficult testing, performance issues

**Solution**:
- Split into components: `StockList`, `CountingPage`, `SettingsPage`
- Custom hooks: `useStockData`, `useStockUpdate`, `usePriceUpdate`
- Service layer: API calls in separate services

### 2. State Management Complexity

**File**: `App.tsx` (lines 40-218)

**Problem**: 20+ useState hooks, state sync issues risk

**Impact**: Race conditions, memory leak risk

**Solution**:
- Group related state with useReducer
- Context API for global state
- State normalization

### 3. Error Handling and Retry Mechanism Missing

**Files**: `App.tsx`, `services/api.ts`

**Problem**: No automatic retry on network errors

**Impact**: Poor UX on temporary network issues

**Solution**:
- Create `utils/retry.ts` (exponential backoff)
- Wrap API calls with retry logic
- Add Error Boundary

### 4. Type Safety Gaps

**Files**: `services/api.ts`, `App.tsx`

**Problem**: `any` usage for API responses, weak type safety

**Impact**: Runtime errors, poor IDE support

**Solution**:
- Create `types/gizmo-api.ts` (API response types)
- Add `noImplicitAny: true` to tsconfig

### 5. Memory Leak Potential

**File**: `App.tsx` (image loading queue, useEffects)

**Problem**: Missing useEffect cleanups, timers not cleared

**Impact**: Performance degradation over time

**Solution**:
- Audit all useEffect cleanup functions
- Use AbortController for fetch cancellation
- Clean up timers properly

---

## P2 - Medium Priority

### 6. Performance Optimizations

**File**: `App.tsx`

**Issues**:
- Missing `useMemo` and `useCallback`
- Unnecessary re-renders
- Image loading queue can be optimized

**Solution**:
- Add memoization (filtered lists, computed values)
- React.memo for component memoization
- Virtual scrolling for large lists (if needed)

### 7. Accessibility (A11y)

**Files**: All components

**Issues**:
- Missing ARIA labels
- Incomplete keyboard navigation
- Screen reader support

**Solution**:
- Radix UI is accessible, add missing labels
- Improve focus management
- Document keyboard shortcuts

---

## P3 - Future Improvements

### 8. Code Organization Target

```
components/
  StockList/
    StockList.tsx
    StockListItem.tsx
    StockFilters.tsx
  Counting/
    CountingPage.tsx
    CountingSession.tsx
  Settings/
    SettingsPage.tsx
    ApiConfigForm.tsx
    SystemLogs.tsx
hooks/
  useStockData.ts
  useStockUpdate.ts
  usePriceUpdate.ts
services/
  stockService.ts
  priceService.ts
  productService.ts
```

### 9. Bundle Size Optimization

- Dynamic imports (lazy loading)
- Tree shaking verification
- Bundle analyzer

---

## Notes

### Potential Bugs

1. **Race Condition**: `fetchStocksForProducts` and `updateStockBatch` may conflict
2. **localStorage Quota**: May fill up with many products
3. **Image Loading**: Same image may be queued multiple times
4. **Number Parsing**: Inconsistent `parseInt`/`parseFloat` usage
5. **Date Formatting**: Hardcoded `toLocaleString('tr-TR')`

### Security Notes

1. **Basic Auth**: Password stored in localStorage as plain text
2. **XSS Risk**: API data should be sanitized
3. **CORS**: Verify CORS policy in production

### Performance Notes

1. **Re-render**: `useDeferredValue` used (good), can use elsewhere
2. **Image Loading**: Queue mechanism good, batch size can be optimized
3. **List Rendering**: Virtual scrolling may be needed for large lists

---

## Action Items (Priority Order)

### Immediate (P0)
- [ ] Create Gizmo API contract tests (`services/__tests__/api.test.ts`)
- [ ] Define API response types (`types/gizmo-api.ts`)
- [ ] Add test coverage threshold to CI/CD
- [ ] Translate README.md to English

### Next (P1)
- [ ] Split App.tsx into components: StockList, CountingPage, SettingsPage
- [ ] Create custom hooks: useStockData, useStockUpdate, usePriceUpdate
- [ ] Add retry mechanism: `utils/retry.ts` with exponential backoff
- [ ] Fix type safety: remove `any` usage, add `noImplicitAny` to tsconfig
- [ ] Audit memory leaks: useEffect cleanups, AbortController, timer cleanup
- [ ] Add Error Boundary component

### Later (P2+)
- [ ] Performance: useMemo/useCallback, React.memo, virtual scrolling
- [ ] State management: useReducer or Context API
- [ ] Accessibility: ARIA labels, keyboard navigation
- [ ] Documentation: JSDoc comments, component prop docs