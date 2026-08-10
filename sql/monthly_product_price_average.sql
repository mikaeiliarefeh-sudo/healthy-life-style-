-- =====================================================================================
-- میانگین قیمتِ هر واحدِ محصول به تفکیکِ «ماه» (به‌جای به تفکیکِ «مشتری»)
-- -------------------------------------------------------------------------------------
-- تفاوت با نسخهٔ قبلی:
--   * قبلاً: یک avg_paid_fee برای هر (مشتری × محصول) در کلِ بازه محاسبه می‌شد.
--   * حالا : برای هر (محصول × ماه) میانگینِ قیمتِ هر واحد + ترندِ آن محاسبه می‌شود.
-- فیلترها/نرمال‌سازی‌های base دقیقاً مثل قبل است.
-- مشتری‌هایی که gap دارند (یا کمتر از ۳ ماه حضور دارند) در CTE ‏eligible کنار گذاشته می‌شوند.
-- =====================================================================================
WITH base AS (
  SELECT
    CASE
      WHEN sc.customername = 'نوآفرینان رادین پارس (تپسی دکتر)'
        THEN 'توسعه تجارت الکترونیک کوروش'      -- ادغامِ دکتر تپسی (نامِ قدیم) در نامِ جدید
      ELSE sc.customername
    END                                          AS customername,
    sc.partcode, sc.yearmonth, sc.quantity, sc.fee, sc.dataresource, cs.customer_type,
    CASE WHEN sc.dataresource = 'RetInvoice' THEN -sc.quantity ELSE sc.quantity END AS actual_quantity
  FROM financial.sales_consumption sc
  JOIN public.mv_customer_size_monthly cs
    ON sc.yearmonth = cs.yearmonth AND sc.customername = cs.customername
  WHERE cs.customer_type IN ('Large','Medium','Small','Enterprise')
    AND cs.yearmonth IN ('1404-01','1404-02','1404-03','1404-04','1404-05','1404-06',
                         '1404-07','1404-08','1404-09','1404-10','1404-11','1404-12',
                         '1405-01','1405-02')
    AND sc.partcode IN ('co-vm-c1','co-vm-g1','co-vm-m1','co-vm-e1','ST-ARC-1','ST-OS-1','ST-OS-3')
    AND (sc.customername <> 'اطلس ارتباط رامان (اسمارتک)' OR sc.customername IS NULL)
    AND (sc.customername <> 'نوای دیار خرد (دید)' OR sc.customername IS NULL)
    AND sc.fee <> 0
    AND sc.invoicenumber NOT IN ('4986', '3012', '5393', '3013')
    AND (sc.quotationitemid <> '212183.0' OR sc.quotationitemid IS NULL)
    AND (sc.customername <> 'مریخ کارپارس آسیا' OR sc.partcode <> 'co-vm-g1' OR sc.customername IS NULL)
),

-- سطحِ پایه (بدون تغییر): قیمتِ وزنیِ هر واحد برای هر (مشتری × محصول × ماه)
monthly_raw AS (
  SELECT customername, partcode, yearmonth,
    CASE
      WHEN LEFT(yearmonth,4) = '1404' THEN CAST(RIGHT(yearmonth,2) AS int)
      WHEN LEFT(yearmonth,4) = '1405' THEN 12 + CAST(RIGHT(yearmonth,2) AS int)
    END AS m_idx,
    SUM(actual_quantity)                                        AS total_quantity,
    SUM(fee * actual_quantity) / NULLIF(SUM(actual_quantity),0) AS month_fee,
    COUNT(*)                                                    AS invoice_lines_in_month
  FROM base
  GROUP BY customername, partcode, yearmonth
),

presence AS (
  SELECT customername, partcode,
    COUNT(*)                                   AS n_months,
    (COUNT(*) < (MAX(m_idx) - MIN(m_idx) + 1)) AS has_gap,
    MIN(m_idx)                                 AS min_idx,
    MAX(m_idx)                                 AS max_idx
  FROM monthly_raw
  GROUP BY customername, partcode
),

-- کنار گذاشتنِ مشتری‌هایِ gap‌دار و مشتری‌هایِ خیلی کوتاه‌مدت
eligible AS (
  SELECT customername, partcode, min_idx, max_idx
  FROM presence
  WHERE NOT has_gap
    AND n_months >= 3
),

global_max AS (SELECT MAX(m_idx) AS max_m_idx FROM monthly_raw),

-- مشاهداتِ واقعیِ (مشتری × محصول × ماه) که واردِ میانگینِ ماهانه می‌شوند
cust_month AS (
  SELECT
    mr.customername, mr.partcode, mr.yearmonth, mr.m_idx,
    mr.total_quantity, mr.month_fee,
    -- ماه‌هایِ «لبه»: ماهِ اولِ هر مشتری و ماهِ آخرِ مشتریِ churn‌شده معمولاً ناقص/prorated هستند
    (
      mr.m_idx = e.min_idx
      OR (mr.m_idx = e.max_idx AND (gm.max_m_idx - e.max_idx) >= 2)
    ) AS is_edge_month
  FROM monthly_raw mr
  JOIN eligible e
    ON e.customername = mr.customername AND e.partcode = mr.partcode
  CROSS JOIN global_max gm
  WHERE mr.total_quantity > 0        -- مرجوعی‌ها/خالص‌شدنِ منفی نباید وزنِ منفی به میانگین بدهد
),

-- ★ اگریگیشنِ اصلی: محصول × ماه
month_price AS (
  SELECT
    partcode, yearmonth, m_idx,
    COUNT(DISTINCT customername)                                  AS n_customers,
    SUM(total_quantity)                                           AS total_quantity,
    SUM(month_fee * total_quantity)                               AS revenue,
    SUM(month_fee * total_quantity) / NULLIF(SUM(total_quantity),0)                  AS avg_fee_w,
    AVG(month_fee)                                                                   AS avg_fee_simple,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY month_fee::double precision)         AS median_fee,
    MIN(month_fee)                                                                   AS min_fee,
    MAX(month_fee)                                                                   AS max_fee,
    -- همان میانگینِ وزنی، ولی بدونِ ماه‌هایِ ناقصِ ابتدا/انتهایِ هر مشتری
    SUM(month_fee * total_quantity) FILTER (WHERE NOT is_edge_month)
      / NULLIF(SUM(total_quantity) FILTER (WHERE NOT is_edge_month),0)               AS avg_fee_w_core,
    COUNT(DISTINCT customername) FILTER (WHERE NOT is_edge_month)                    AS n_customers_core
  FROM cust_month
  GROUP BY partcode, yearmonth, m_idx
),

-- ترندِ «سبدِ ثابت»: فقط مشتری‌هایی که هم در ماهِ t و هم در t-1 حضور دارند،
-- با وزنِ مقدارِ ماهِ قبل (link relative از نوعِ Laspeyres) → اثرِ تغییرِ ترکیبِ مشتری حذف می‌شود.
matched_link AS (
  SELECT
    cur.partcode, cur.m_idx,
    COUNT(*)                                                                     AS n_matched_customers,
    SUM(cur.month_fee * prv.total_quantity)
      / NULLIF(SUM(prv.month_fee * prv.total_quantity),0)                        AS price_link
  FROM cust_month cur
  JOIN cust_month prv
    ON  prv.customername = cur.customername
    AND prv.partcode     = cur.partcode
    AND prv.m_idx        = cur.m_idx - 1
  GROUP BY cur.partcode, cur.m_idx
)

SELECT
  mp.partcode,
  CASE
    WHEN mp.partcode ILIKE 'co-%' THEN 'Compute'
    WHEN mp.partcode ILIKE 'ST-%' THEN 'Storage'
    ELSE 'Other'
  END                                                     AS product_cluster,
  mp.yearmonth,
  mp.m_idx,

  mp.n_customers,
  mp.total_quantity,

  ROUND(mp.avg_fee_w::numeric,      0)                    AS avg_fee_per_unit,        -- ★ ستونِ اصلی
  ROUND(mp.avg_fee_w_core::numeric, 0)                    AS avg_fee_per_unit_core,   -- بدونِ ماه‌هایِ ناقص
  ROUND(mp.avg_fee_simple::numeric, 0)                    AS avg_fee_unweighted,      -- میانگینِ ساده بینِ مشتری‌ها
  ROUND(mp.median_fee::numeric,     0)                    AS median_fee_per_unit,
  ROUND(mp.min_fee::numeric,        0)                    AS min_fee_per_unit,
  ROUND(mp.max_fee::numeric,        0)                    AS max_fee_per_unit,

  -- ترندِ خام (تحتِ تأثیرِ تغییرِ ترکیبِ مشتری‌ها)
  CAST(ROUND(((mp.avg_fee_w / NULLIF(LAG(mp.avg_fee_w) OVER w, 0) - 1) * 100)::numeric, 1)
       AS double precision)                               AS mom_price_pct,
  CAST(ROUND((mp.avg_fee_w / NULLIF(FIRST_VALUE(mp.avg_fee_w) OVER w, 0) * 100)::numeric, 1)
       AS double precision)                               AS price_index_base100,

  -- ترندِ سبدِ ثابت (تمیزتر برایِ قضاوت دربارهٔ «قیمت واقعاً چقدر تغییر کرده»)
  CAST(ROUND(((ml.price_link - 1) * 100)::numeric, 1)
       AS double precision)                               AS mom_price_matched_pct,
  CAST(ROUND((100 * EXP(SUM(LN(CASE WHEN ml.price_link > 0 THEN ml.price_link ELSE 1 END)) OVER w))::numeric, 1)
       AS double precision)                               AS chained_price_index_base100,
  ml.n_matched_customers

FROM month_price mp
LEFT JOIN matched_link ml
  ON ml.partcode = mp.partcode AND ml.m_idx = mp.m_idx
WINDOW w AS (PARTITION BY mp.partcode ORDER BY mp.m_idx)
ORDER BY mp.partcode, mp.m_idx;
