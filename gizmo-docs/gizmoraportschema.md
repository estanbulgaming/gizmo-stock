# Gizmo Reports – Functional Schema and Data Mapping

This document catalogs the key reports exposed at `http://192.168.1.5/reports` and maps their fields and filters to our DB/API so we can reproduce them in Metabase and validate reconciliation.

- Auth: form POST `/auth` (fields `Username`, `Password`) with cookie `_BASE_AUTH_COOKIE`.
- Global filters (per report):
  - `DateFrom` (hidden input + display), `DateTo` (hidden input + display)
  - Period presets: Daily, Weekly, Monthly, Yearly, Custom
  - PDF export: add `&Pdf=true` to current report URL
  - i18n: `GET /setlanguage?culture=...&returnurl=...`

## Overview Report
- URL
  - Filter page: `/reports/overviewreportfilter`
  - Data page: `/reports/OverviewReport?DateFrom=...&DateTo=...`
- Sections
  - Operators
    - Columns: Shift hours, Hours sold, Products sold, Time offers sold, Bundles sold, Voids, Pay Ins-Outs, Total
    - Drilldown: `redirectToOperatorVoids(<id>)`
  - Utilization (%)
    - AVG utilization; bar and line charts rendered via `utilizationBarChartData`/Chart.js
  - Users
    - Total accounts, New accounts, Banned accounts, Unique members/guests logins, AVG daily visits
  - Average revenue
  - Revenue per group
  - Totals
    - Total revenue; Financial total with link to Financial report
- DB/API mapping
  - Operators KPIs: derive from `invoice`, `invoice_item`, and/or POS logs (voids); Pay Ins-Outs from register transactions (optional)
  - Utilization: from `usage`/`usage_session` (SUM seconds → hours) normalized by capacity
  - Users: `users` fact + login logs (if available)
  - Revenue: `payment` and/or `invoice.total_amount` (policy-dependent)

## Financial Report
- URL
  - Filter page: `/reports/financialreportfilter`
  - Data page: `/reports/FinancialReport?DateFrom=...&DateTo=...`
- Sections and fields
  - Deposits & Withdrawals
    - Rows: Deposits, Withdrawals, Deposit Voids
    - Breakdown by method: Credit Card, Cash, etc.
    - Totals
  - Sales
    - Subsections: Session Time, Time Offers, Products
    - Columns: Quantity, Unit Cost, Tax, Total Cost, Value
    - Sales Total
    - Tender split: Sales - Deposit / Credit Card / Cash / Pay Later
  - Payments For Past Sales
    - Example: Past Sales - Cash
  - Voids
    - Columns: Quantity, Unit Cost, Tax, Total Cost, Value
    - Refunds - Cash; Unrefunded and/or Unpaid
  - Balances
    - Credit Card Total, Cash Total, Super App totals, Tax Total, Cost Total, Grand Total
- DB/API mapping
  - Deposits/Withdrawals: `payment` (amount > 0 / < 0), `dim_payment_method`, `payment.is_voided`
  - Sales (lines): `invoice_item` (quantity, total_price) + `invoice.tax_amount`; unit cost not modeled (optional future column)
  - Tender split: `invoice_payment` (planned) + `dim_payment_method`
  - Past Sales Payments: `invoice_payment.created_time` within window AND linked `invoice.created_time` before window start
  - Voids: `invoice.is_voided = TRUE` and/or item-level flags if present
  - Balances by method: SUM(`payment.amount`) grouped by `payment_method_id`

## Hosts Report (PC Usage)
- URL
  - Filter page: `/reports/hostusagereportfilter`
  - Data page: likely `/reports/HostUsageReport?DateFrom=...&DateTo=...` (by convention)
- KPIs (expected)
  - Host group utilization, per-host/session time, peak hours
- DB mapping
  - `usage` (events, seconds) → hours/day/month
  - `usage_session` (session-level) enriched via `v_usage_session_enriched`
  - `host`, `host_group` for grouping/filters

## Shared Filters and Behaviors
- Request
  - GET with `DateFrom`, `DateTo` (ISO `YYYY-MM-DD hh:mm:ss`)
  - Presets manage `DateFromHidden`/`DateToHidden` and display fields
- Output
  - HTML tables with totals and subsections
  - Chart.js for utilization/revenue visuals in Overview
  - Export hooks: `exportToPDF()` appends `&Pdf=true`

## Field Dictionary (principal)
- Deposits
  - Count: number of `payment` rows with `amount > 0` and `is_voided = FALSE`
  - Value: SUM(`payment.amount`) for same filter
- Withdrawals
  - Count: `amount < 0` (voided excluded)
  - Value: SUM(`payment.amount`) (negative)
- Deposit Voids
  - Count: `payment.is_voided = TRUE`
  - Value: ABS(SUM of voided payments)) if shown as negative; keep sign per report policy
- Sales – Session Time / Time Offers / Products
  - Quantity: SUM(`invoice_item.quantity`) filtered by product/category classes
  - Tax: SUM(`invoice.tax_amount`) or per-line tax if modeled
  - Total Cost: not modeled (future enhancement)
  - Value: SUM(`invoice_item.total_price`)
- Payments For Past Sales
  - SUM(`invoice_payment.amount`) where `invoice_payment.created_time` in window and linked `invoice.created_time` < window start
- Voids
  - Count/Value from `invoice.is_voided = TRUE` (and item-level when available)
- Balances by method
  - Credit Card Total, Cash Total, etc.: SUM(`payment.amount`) grouped by `dim_payment_method.name`
- Utilization (%)
  - ((SUM usage hours) / capacity) × 100
  - Capacity policy from `.env`: `PC_CAPACITY_BREAKPOINT_DATE`, `PC_COUNT_BEFORE`, `PC_COUNT_AFTER`

## Reproduction in Metabase (mapping)
- Overview KPIs
  - Utilization: use `v_usage_daily_hours`/`v_usage_monthly_hours` with capacity normalization inside view or question
  - Users: `users` table counts; new/banned via `created_time`/flags
  - Revenue: `payment` (method mix view exists), invoices via `invoice`
- Financial KPIs
  - Deposits/Withdrawals cards sourced from `payment` + `dim_payment_method`
  - Sales by line type using `invoice_item` joined to `dim_product`/`dim_category`
  - Tender split, past sales: requires `invoice_payment` load
  - Balances: aggregate over `payment`
- Hosts KPIs
  - Use `usage` + `host`/`host_group`; build “Usage Rate (Month Overlay, 3y)” and “Monthly Usage Rate (3y)” cards

## Known Gaps
- Unit/Total Cost not modeled in our schema; presentational only unless we add cost columns
- Item-level void/refund flags not captured; currently invoice-level `is_voided`
- `invoice_payment` table pending; needed for tender split and past-sales metrics
- Host ↔ usage_session linkage depends on `usage_user_session` bridge; verify source availability

## Quick Test URLs (logged-in)
- Overview: `/reports/OverviewReport?DateFrom=2025-09-01 00:00:00&DateTo=2025-09-10 23:59:59`
- Financial: `/reports/FinancialReport?DateFrom=2025-09-01 00:00:00&DateTo=2025-10-01 00:00:00`

