# Gizmo DB Schema – Columns, Relationships, and API Mapping

This document explains the PostgreSQL schema used by Gizmo Analytics, what each column means, how tables relate to each other, and how they map to Gizmo Web API resources. Use it to understand the model when building views, Metabase cards, or reconciling with API data.

- Target DB: `gizmo_analytics` (PostgreSQL)
- BI: Metabase (`http://localhost:3000`)
- Source (read-only): SQL Server `estanbul` on `192.168.1.5`

## Entity Map (API ↔ DB)

- Payment Methods
  - API: `GET /api/v2.0/paymentmethods`
  - DB: `dim_payment_method` (dictionary)
- Deposit Transactions (Deposits & Withdrawals)
  - API: `GET /api/v2.0/deposittransactions`
  - DB: `payment` (positive = deposit, negative = withdrawal, `is_voided` for voids)
- Invoices
  - API: `GET /api/invoices` (v1) or `GET /api/v2.0/invoices`
  - DB: `invoice`
- Invoice Payments
  - API: `GET /api/v2.0/invoicepayments`
  - DB: `invoice_payment` (planned/used by ETL, create table if missing)
- Points Transactions
  - API: `GET /api/v2.0/pointstransactions`
  - DB: `point_transaction`
- Register Transactions (cash drawer)
  - API: `GET /api/v2.0/registertransactions`
  - DB: not modeled (optional future table)
- Products & Categories (for invoice lines)
  - API: product/catalog endpoints (various)
  - DB: `dim_product`, `dim_category`, joined via invoice lines

## Tables

### payment
- Purpose: Monetary deposits/withdrawals by users; used for “Deposits & Withdrawals”, “Balances by method”, etc.
- Columns
  - `payment_id` (serial, PK): Surrogate key
  - `user_id` (int, NOT NULL): Who performed the transaction; joins `users.user_id`
  - `amount` (decimal(10,2), NOT NULL): Positive=deposit, negative=withdrawal
  - `payment_method_id` (int, NULL): Payment method code; join to `dim_payment_method.original_id`
  - `created_time` (timestamp, NOT NULL): Event time (UTC; convert for TR)
  - `modified_time` (timestamp, NULL): Last update time if any
  - `is_voided` (bool, default false): True if voided/reversed
  - `description` (text, NULL): Free text
  - `original_id` (int, UNIQUE): Original PaymentId from source
- Indexes
  - `idx_payment_user_id`, `idx_payment_created_time`, `idx_payment_payment_method_id`
  - `ux_payment_original_id`
- API mapping (DepositTransactions)
  - `userId → user_id`, `amount → amount`, `paymentMethodId → payment_method_id`, `date → created_time`, `isVoided → is_voided`
  - Some fields (e.g., `shiftId`, `registerId`, `operatorId`) are not stored in `payment` (optional future cols)

### point_transaction
- Purpose: Point/account balance changes and usage (uploads/spends/pc usage).
- Columns
  - `point_transaction_id` (serial, PK)
  - `user_id` (int, NOT NULL)
  - `type` (int, NOT NULL): Domain-specific (0=load, 1=spend, 2=PC usage, …)
  - `amount` (int, NOT NULL)
  - `balance` (int, NULL)
  - `created_time` (timestamp, NOT NULL)
  - `modified_time` (timestamp, NULL)
  - `is_voided` (bool, default false)
  - `original_id` (int, UNIQUE)
- Indexes
  - `idx_point_transaction_user_id`, `idx_point_transaction_created_time`, `ux_point_transaction_original_id`
- API mapping (PointsTransactions)
  - `UserId → user_id`, `Type → type`, `Amount → amount`, `Balance → balance`, `CreatedTime → created_time`, `IsVoided → is_voided`

### users
- Purpose: User dimension / attributes for joins and segmentation.
- Columns
  - `user_id` (serial, PK)
  - `username` (varchar), `email` (varchar)
  - `balance` (decimal(10,2), default 0)
  - `is_guest` (bool, default false)
  - `created_time` (timestamp), `modified_time` (timestamp), `last_activity` (timestamp)
  - `original_id` (int, UNIQUE): Source UserId
- Indexes
  - `idx_users_original_id`, `ux_users_original_id_unique`

### dim_payment_method
- Purpose: Payment method dictionary (join target for `payment.payment_method_id`).
- Columns
  - `payment_method_id` (serial, PK)
  - `original_id` (int, UNIQUE): Source id (e.g., -1 Cash, -2 Credit Card, -3 Deposit…)
  - `name` (text)
- API mapping (PaymentMethods)
  - `id → original_id`, `name → name`

### usage_session
- Purpose: PC session usage (start/end/duration/amount charged).
- Columns
  - `session_id` (serial, PK)
  - `user_id` (int, NOT NULL)
  - `pc_id` (int, NULL)
  - `start_time` (timestamp), `end_time` (timestamp), `duration_minutes` (int)
  - `amount_charged` (decimal(10,2))
  - `created_time` (timestamp)
  - `original_id` (int)
- Relationships: `user_id → users.user_id`

### dim_category
- Purpose: Product categories (dictionary).
- Columns
  - `category_id` (serial, PK)
  - `original_id` (int, UNIQUE)
  - `name` (text)

### dim_product
- Purpose: Product dictionary for invoice lines.
- Columns
  - `product_id` (serial, PK)
  - `original_id` (int, UNIQUE)
  - `name` (text)
  - `category_original_id` (int, NULL): Join to `dim_category.original_id`

### invoice
- Purpose: Invoice headers (order totals/status).
- Columns
  - `invoice_id` (serial, PK)
  - `original_id` (int, UNIQUE): Source ProductOrderId
  - `user_id` (int, NULL)
  - `created_time` (timestamp), `modified_time` (timestamp)
  - `is_voided` (bool, default false)
  - `status` (text)
  - `subtotal_amount` (decimal(12,2))
  - `tax_amount` (decimal(12,2))
  - `discount_amount` (decimal(12,2))
  - `total_amount` (decimal(12,2))
- Indexes
  - `ux_invoice_original_id`, `idx_invoice_created_time`
- API mapping (Invoices)
  - `productOrderId → original_id`, `userId → user_id`, `createdTime/modifiedTime → created_time/modified_time`
  - `isVoided → is_voided`, `status → status`, `subTotal/taxTotal/total → subtotal_amount/tax_amount/total_amount`

### invoice_item
- Purpose: Invoice lines (products/time offers/bundles).
- Columns
  - `invoice_item_id` (serial, PK)
  - `original_id` (int, UNIQUE)
  - `invoice_original_id` (int): Join to `invoice.original_id`
  - `product_original_id` (int): Join to `dim_product.original_id`
  - `quantity` (int)
  - `unit_price` (decimal(12,2))
  - `total_price` (decimal(12,2))
  - `created_time` (timestamp)
- Indexes
  - `ux_invoice_item_original_id`, `idx_invoice_item_invoice_original_id`, `idx_invoice_item_product_original_id`

### invoice_payment (planned)
- Purpose: Payment applications to invoices (tender split, past sales, etc.).
- Status: Used by scripts (`sync_data.py`, `recon_report.py`) but table may be missing; create if needed.
- Suggested Columns (from ETL config)
  - `invoice_payment_id` (serial, PK)
  - `original_id` (int, UNIQUE)
  - `invoice_original_id` (int) → `invoice.original_id`
  - `payment_original_id` (int) → `payment.original_id`
  - `user_id` (int)
  - `amount` (decimal(12,2))
  - `created_time` (timestamp)
  - `modified_time` (timestamp)
  - `shift_id` (int, NULL)

### sync_log
- Purpose: Watermarking and operational logging for sync batches.
- Columns
  - `id` (serial, PK)
  - `table_name` (varchar)
  - `last_sync_time` (timestamp)
  - `record_count` (int)
  - `success` (bool)
  - `error_message` (text)
  - `created_at` (timestamp)

## Relationships (Logical)

- `payment.user_id → users.user_id`
- `payment.payment_method_id → dim_payment_method.original_id`
- `invoice.user_id → users.user_id`
- `invoice_item.invoice_original_id → invoice.original_id`
- `invoice_item.product_original_id → dim_product.original_id`
- `dim_product.category_original_id → dim_category.original_id`
- `usage_session.user_id → users.user_id`
- `invoice_payment.invoice_original_id → invoice.original_id` (planned)
- `invoice_payment.payment_original_id → payment.original_id` (planned)

## Domain Notes

- Timezone: Source timestamps are UTC in API examples; convert to `Europe/Istanbul` for reporting where appropriate.
- Voids/Refunds: Use `is_voided=true` on `payment`, `point_transaction`, and `invoice`. Refunds may appear as negative amounts or specific statuses; align policies in views.
- Status mapping (invoice): `status` is vendor-defined; map to business states (paid/unpaid/refunded/voided) for consistent metrics.
- Payment method join: Use `payment.payment_method_id = dim_payment_method.original_id`.
- Product taxonomy: Populate `dim_product` and `dim_category`; classify lines into “Session Time”, “Time Offers”, “Products”, “Bundles”.

## Metabase Card Readiness (GET endpoints → DB)

- Payment Methods (`/api/v2.0/paymentmethods`)
  - Card type: dictionary listing; used in joins and filters. Status: Ready (`dim_payment_method`).
- Deposit Transactions (`/api/v2.0/deposittransactions`)
  - Cards: totals by day/method, void summary, balances. Status: Ready (`payment`).
- Invoices (`/api/invoices`, `/api/v2.0/invoices`)
  - Cards: invoice counts/totals, voids, status breakdown. Status: Ready (`invoice`).
- Invoice Payments (`/api/v2.0/invoicepayments`)
  - Cards: tender splits, payments for past sales. Status: Partial (create `invoice_payment` table + ETL).
- Points Transactions (`/api/v2.0/pointstransactions`)
  - Cards: points in/out, PC usage trends. Status: Ready (`point_transaction`).
- Register Transactions (`/api/v2.0/registertransactions`)
  - Cards: pay-ins/outs (cash drawer). Status: Not modeled (optional future table).

## Suggested Views (for stable BI)

- `v_payment_method_mix_30d` (exists): Payment totals by method (last 30 days) using dictionary join.
- `daily_revenue`, `hourly_revenue` (exist): Core revenue trends from `payment`.
- `v_product_sales_30d` (exists): Product sales from invoices (last 30 days).
- `v_invoice_summary_30d` (suggested): Counts/sums by status and void flag.
- `v_deposits_withdrawals_30d` (suggested): Deposits/withdrawals totals and voids by method.

## Gaps & Next Steps

- Create `invoice_payment` table (if absent) and load from SQL Server; add indexes and joins.
- Populate `dim_product`/`dim_category` robustly and classify invoice lines.
- Decide on timezone handling policy in views (convert to TR for reporting).
- Add optional fields if needed (e.g., `shift_id`, `register_id`, `operator_id`) to better mirror API for ops use-cases.

