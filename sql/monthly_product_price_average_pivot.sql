-- =====================================================================================
-- همان منطقِ monthly_product_price_average.sql، ولی خروجی «عریض»:
-- هر ردیف = یک محصول، هر ستون = میانگینِ قیمتِ هر واحد در آن ماه.
-- برایِ نگاهِ سریع به ترندِ ۷ محصول در ۱۴ ماه.
-- =====================================================================================
WITH base AS (
  SELECT
    CASE
      WHEN sc.customername = 'نوآفرینان رادین پارس (تپسی دکتر)'
        THEN 'توسعه تجارت الکترونیک کوروش'
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
monthly_raw AS (
  SELECT customername, partcode, yearmonth,
    CASE
      WHEN LEFT(yearmonth,4) = '1404' THEN CAST(RIGHT(yearmonth,2) AS int)
      WHEN LEFT(yearmonth,4) = '1405' THEN 12 + CAST(RIGHT(yearmonth,2) AS int)
    END AS m_idx,
    SUM(actual_quantity)                                        AS total_quantity,
    SUM(fee * actual_quantity) / NULLIF(SUM(actual_quantity),0) AS month_fee
  FROM base
  GROUP BY customername, partcode, yearmonth
),
presence AS (
  SELECT customername, partcode,
    COUNT(*)                                   AS n_months,
    (COUNT(*) < (MAX(m_idx) - MIN(m_idx) + 1)) AS has_gap
  FROM monthly_raw GROUP BY customername, partcode
),
eligible AS (
  SELECT customername, partcode FROM presence WHERE NOT has_gap AND n_months >= 3
),
cust_month AS (
  SELECT mr.*
  FROM monthly_raw mr
  JOIN eligible e ON e.customername = mr.customername AND e.partcode = mr.partcode
  WHERE mr.total_quantity > 0
),
month_price AS (
  SELECT partcode, m_idx,
    SUM(month_fee * total_quantity) / NULLIF(SUM(total_quantity),0) AS avg_fee_w,
    COUNT(DISTINCT customername)                                    AS n_customers
  FROM cust_month
  GROUP BY partcode, m_idx
)
SELECT
  partcode,
  CASE WHEN partcode ILIKE 'co-%' THEN 'Compute'
       WHEN partcode ILIKE 'ST-%' THEN 'Storage' ELSE 'Other' END AS product_cluster,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=1 ))::numeric,0) AS p_1404_01,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=2 ))::numeric,0) AS p_1404_02,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=3 ))::numeric,0) AS p_1404_03,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=4 ))::numeric,0) AS p_1404_04,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=5 ))::numeric,0) AS p_1404_05,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=6 ))::numeric,0) AS p_1404_06,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=7 ))::numeric,0) AS p_1404_07,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=8 ))::numeric,0) AS p_1404_08,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=9 ))::numeric,0) AS p_1404_09,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=10))::numeric,0) AS p_1404_10,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=11))::numeric,0) AS p_1404_11,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=12))::numeric,0) AS p_1404_12,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=13))::numeric,0) AS p_1405_01,
  ROUND((MAX(avg_fee_w) FILTER (WHERE m_idx=14))::numeric,0) AS p_1405_02,
  -- رشدِ کلِ دوره: آخرین ماهِ موجود نسبت به اولین ماهِ موجود
  CAST(ROUND((
        ( (ARRAY_AGG(avg_fee_w ORDER BY m_idx DESC))[1]
        / NULLIF((ARRAY_AGG(avg_fee_w ORDER BY m_idx ASC))[1], 0) - 1) * 100
      )::numeric,1) AS double precision)                     AS total_price_change_pct
FROM month_price
GROUP BY partcode
ORDER BY product_cluster, partcode;
