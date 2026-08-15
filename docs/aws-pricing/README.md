# داده‌ی قیمت AWS — us-east-1

استخراج مستقیم از **AWS Price List Bulk API** (عمومی، بدون احراز هویت)، نگاشت‌شده به منوی محصولات پنل ما.

گزارش خوانا: <https://claude.ai/code/artifact/35e56868-fe0d-471b-a7f7-063d2b28fddb>
رودمپ بنچ‌مارک: <https://claude.ai/code/artifact/18942bb4-a057-4271-9661-3223f045d7b6>

| قلم | مقدار |
|---|---|
| تاریخ انتشار داده | ۲۰۲۶-۰۸-۱۵ |
| ریجن | us-east-1 |
| ارز | USD |
| ردیف قیمت | ۸٬۸۶۳ |
| نوع اینستنس EC2 | ۱٬۲۲۵ (On-Demand، Linux، تنانسی مشترک) |
| سرویس‌های AWS | ۱۶ |
| اعتبارسنجی | ۱۱/۱۱ در برابر قیمت‌های مرجع شناخته‌شده |

## فایل‌ها

| فایل | محتوا |
|---|---|
| `AWS-Pricing-Benchmark.xlsx` | ورک‌بوک ۱۳ شیتی — یک شیت به‌ازای هر گروه محصول، به‌علاوه راهنما، خلاصه، نردبان تخفیف و داده‌ی خام |
| `aws_pricing_us-east-1.csv` | همه‌ی ۸٬۸۶۳ ردیف، تخت (`product, service, dimension, name, spec, unit, price, note`) |
| `ec2_ondemand.csv` | ۱٬۲۲۵ اینستنس با مشخصات کامل (vCPU، حافظه، پردازنده، GPU، شبکه) |
| `savings_plan_rates.json` | نرخ واقعی Compute SP و EC2 Instance SP برای ۶ اینستنس نماینده |
| `discount_ladder.json` | نرخ مؤثر Reserved (ساعتی + سرشکن پیش‌پرداخت) |
| `extract.py` | اسکریپت استخراج — دوباره اجرا کن تا داده تازه شود |
| `build_xlsx.py` | ساخت ورک‌بوک از CSVها |
| `verify_xlsx.py` | ۱٬۰۶۷ چک روی فرمول‌ها و مقادیر ورک‌بوک |

## نگاشت محصول ما → سرویس AWS

| محصول در پنل ما | سرویس AWS |
|---|---|
| ماشین‌های مجازی | EC2 — Compute Instance |
| دیسک‌های مانا | EBS — Storage + System Operation (IOPS) + Provisioned Throughput |
| ایمیج‌ها | EBS Snapshot |
| شبکه ماشین‌ها | IPv4 عمومی + NAT Gateway + Data Transfer + VPC Endpoint |
| آبجکت استوریج | S3 |
| مهاجرت داده | DataSync |
| کلیدهای اتصال / مدیریت نقش‌ها | IAM — **رایگان، هیچ SKU قیمتی ندارد** |
| مانیتورینگ | CloudWatch |
| شبکه توزیع محتوا (CDN/DNS) | CloudFront + Route 53 |
| Postgres | RDS PostgreSQL |
| پایگاه‌داده نسخه ۲ (کلاستر) | RDS Aurora PostgreSQL |
| خدمات DevOps | CodeBuild + CodePipeline |
| کوبرنتیز نسخه ۲ | EKS |
| AI Workspace | SageMaker + Bedrock |

## بازتولید

```bash
# ۱. فهرست سرویس‌ها (۲۶۸ سرویس)
curl -s https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json

# ۲. فایل ریجنی هر سرویس
curl -s https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/region_index.json

# ۳. داده‌ی قیمت (۵ خط متادیتا، بعد سرستون)
curl -s https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.csv

# ۴. نرخ تعهد
curl -s https://pricing.us-east-1.amazonaws.com/savingsPlan/v1.0/aws/AWSComputeSavingsPlan/current/region_index.json

# ۵. استخراج و ساخت
python3 extract.py && python3 build_xlsx.py && python3 verify_xlsx.py
```

## هشدارها

- **فقط لایه‌ی ۱ و ۲.** قرارداد خصوصی و تخفیف سازمانی (لایه‌ی ۳) در هیچ API عمومی نیست. مشتری بزرگ AWS کمتر از این اعداد می‌پردازد.
- **فقط us-east-1** — ارزان‌ترین ریجن AWS. سایر ریجن‌ها ۱۰ تا ۶۰٪ گران‌ترند.
- **فقط Linux و تنانسی مشترک.** لایسنس ویندوز و دیتابیس تجاری جداست.
- **بدون هزینه‌ی پشتیبانی** — درصدی از کل صورتحساب با کف ثابت؛ دستی اضافه کنید.
- **بدون Spot** — قیمت لحظه‌ای است و در Price List API نیست.
- **عکس یک لحظه.** فصلی تکرار کنید و نسخه‌دار نگه دارید.

## نکته‌ی روش

هنگام استخراج، دو بار فیلتر ردیف اشتباه را برداشت:

1. کلاس Standard آبجکت استوریج در داده‌ی AWS با نام **General Purpose** ثبت شده، نه Standard.
2. کوبرنتیز چند نوع ردیف ساعتی دارد؛ اولین تطابق `Hours` مربوط به control plane نبود. ردیف درست `USE1-AmazonEKS-Hours:perCluster` است.

هر دو فقط به این دلیل پیدا شدند که خروجی در برابر قیمت‌های شناخته‌شده تست شد. **بدون آن تست، هر دو عدد غلط بی‌سروصدا وارد گزارش می‌شدند.** هر بار که این استخراج را تازه می‌کنید، همان تست را دوباره اجرا کنید.
