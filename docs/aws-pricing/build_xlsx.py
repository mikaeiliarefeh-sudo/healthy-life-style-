#!/usr/bin/env python3
"""Build the AWS pricing benchmark workbook from the extracted CSVs."""
import csv, json, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ARIAL = "Arial"
HDR_FILL = PatternFill("solid", fgColor="0E6A5B")
HDR_FONT = Font(name=ARIAL, bold=True, color="FFFFFF", size=10)
TITLE_FONT = Font(name=ARIAL, bold=True, size=13, color="0E6A5B")
BODY = Font(name=ARIAL, size=10)
BLUE = Font(name=ARIAL, size=10, color="0000FF")
NOTE = Font(name=ARIAL, size=9, italic=True, color="595959")
YELLOW = PatternFill("solid", fgColor="FFFF00")
THIN = Border(bottom=Side("thin", color="D9D9D9"))
USD = '$#,##0.00000'
USD2 = '$#,##0.00'
PCT = '0.0%'

rows = list(csv.DictReader(open("aws_pricing_us-east-1.csv", encoding="utf-8")))
ec2 = list(csv.DictReader(open("ec2_ondemand.csv", encoding="utf-8")))
sp = json.load(open("savings_plan_rates.json", encoding="utf-8"))
ri = {e["instance"]: e for e in json.load(open("discount_ladder.json", encoding="utf-8"))}
PUB = json.load(open("index.json"))["publicationDate"]

wb = Workbook()
wb._named_styles["Normal"].font = Font(name=ARIAL, size=10)


def sheet(name, title, headers, widths, rtl=True):
    ws = wb.create_sheet(name)
    ws.sheet_view.rightToLeft = rtl
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    ws["A2"] = f"منبع: AWS Price List Bulk API · ریجن us-east-1 · تاریخ انتشار داده: {PUB}"
    ws["A2"].font = NOTE
    for i, (h, w) in enumerate(zip(headers, widths), start=1):
        c = ws.cell(row=4, column=i, value=h)
        c.font, c.fill = HDR_FONT, HDR_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A5"
    ws.row_dimensions[4].height = 30
    return ws


def write(ws, r, vals, fmts=None):
    for i, v in enumerate(vals, start=1):
        c = ws.cell(row=r, column=i, value=v)
        if fmts and fmts.get(i):
            c.number_format = fmts[i]
    return r + 1


# ─────────────────────────────────────────── 1. راهنما
ws = wb.active
ws.title = "راهنما"
ws.sheet_view.rightToLeft = True
ws["A1"] = "بنچ‌مارک قیمت AWS — نگاشت به منوی محصولات ما"
ws["A1"].font = Font(name=ARIAL, bold=True, size=16, color="0E6A5B")
ws.column_dimensions["A"].width = 34
ws.column_dimensions["B"].width = 88
meta = [
    ("منبع داده", "AWS Price List Bulk API (عمومی، بدون احراز هویت)"),
    ("نقطه‌ی شروع", "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json"),
    ("ریجن مبنا", "us-east-1 (N. Virginia) — ارزان‌ترین ریجن AWS، مبنای استاندارد مقایسه"),
    ("تاریخ انتشار داده", PUB),
    ("ارز", "USD"),
    ("تعداد ردیف قیمت", len(rows)),
    ("نوع تنانسی EC2", "Shared / Linux / بدون نرم‌افزار پیش‌نصب / بدون لایسنس"),
    ("", ""),
    ("⚠ محدوده", "این فقط لایه‌ی ۱ (نرخ‌نامه‌ی عمومی) و لایه‌ی ۲ (نردبان تخفیف) است."),
    ("", "لایه‌ی ۳ — قرارداد خصوصی و تخفیف سازمانی — در این API وجود ندارد و عمومی نیست."),
    ("", "قیمت واقعی مشتری بزرگ AWS پایین‌تر از این اعداد است."),
    ("", ""),
    ("⚠ نکته‌ی روش", "قیمت ریجنی متفاوت است. us-east-1 کف قیمت AWS است؛"),
    ("", "ریجن‌های دیگر ۱۰ تا ۶۰ درصد گران‌ترند. برای مقایسه‌ی منصفانه ریجن را ثابت نگه دار."),
]
r = 3
for k, v in meta:
    ws.cell(row=r, column=1, value=k).font = Font(name=ARIAL, bold=True, size=10)
    c = ws.cell(row=r, column=2, value=v)
    c.font = BODY
    c.alignment = Alignment(wrap_text=False)
    r += 1

r += 1
ws.cell(row=r, column=1, value="نگاشت محصول ما → سرویس AWS").font = TITLE_FONT
r += 1
for h, w in [("محصول ما", 34), ("سرویس AWS", 88)]:
    pass
hdr = ["محصول در پنل ما", "سرویس AWS معادل"]
for i, h in enumerate(hdr, start=1):
    c = ws.cell(row=r, column=i, value=h)
    c.font, c.fill = HDR_FONT, HDR_FILL
r += 1
MAP = [
    ("ماشین‌های مجازی", "EC2 — Compute Instance (زمان مصرف، ثانیه‌ای با کف ۶۰ ثانیه)"),
    ("دیسک‌های مانا", "EBS — Storage + System Operation (IOPS) + Provisioned Throughput"),
    ("ایمیج‌ها", "EBS Snapshot + AMI storage"),
    ("شبکه ماشین‌ها", "IPv4 عمومی + NAT Gateway + Data Transfer + VPC Endpoint"),
    ("آبجکت استوریج", "S3 — Storage + API Request + Retrieval + جریمه‌ی حذف زودهنگام"),
    ("مهاجرت داده", "DataSync"),
    ("کلیدهای اتصال / مدیریت نقش‌ها", "IAM — رایگان (AWS برای این بُعد اصلاً متر ندارد)"),
    ("مانیتورینگ", "CloudWatch — Metric + Alarm + Data Payload (ingest لاگ)"),
    ("شبکه توزیع محتوا (CDN/DNS)", "CloudFront + Route 53"),
    ("Postgres", "RDS PostgreSQL — Instance + Storage + Provisioned IOPS"),
    ("پایگاه‌داده نسخه ۲ (کلاستر)", "RDS Aurora PostgreSQL"),
    ("خدمات DevOps", "CodeBuild + CodePipeline"),
    ("کوبرنتیز نسخه ۲", "EKS — control plane + Auto Mode + Provisioned Tier"),
    ("AI Workspace", "SageMaker (ML Instance) + Bedrock (به‌ازای توکن)"),
]
for a, b in MAP:
    ws.cell(row=r, column=1, value=a).font = BODY
    ws.cell(row=r, column=2, value=b).font = BODY
    r += 1

# ─────────────────────────────────────────── 2. نردبان تخفیف
ws = sheet("نردبان تخفیف", "نردبان تخفیف واقعی — استخراج‌شده از Savings Plan و Reserved Instance API",
           ["اینستنس", "vCPU", "حافظه", "مکانیزم", "مدت", "نوع پرداخت",
            "نرخ $/ساعت", "٪ از On-Demand", "ماهانه $ (۷۳۰ ساعت)"],
           [15, 7, 12, 18, 8, 17, 14, 15, 18])
r = 5
for it in sorted(sp):
    od = sp[it]["ondemand_usd_hr"]
    vcpu = next((e["vcpu"] for e in ec2 if e["instance"] == it), "")
    mem = next((e["memory"] for e in ec2 if e["instance"] == it), "")
    r0 = r
    r = write(ws, r, [it, int(vcpu) if vcpu else None, mem, "On-Demand", "—", "—", od, None, None],
              {7: USD, 8: PCT, 9: USD2})
    ws.cell(row=r - 1, column=8, value=f"=G{r-1}/$G${r0}").number_format = PCT
    ws.cell(row=r - 1, column=9, value=f"=G{r-1}*730").number_format = USD2
    for k, v in sorted(sp[it]["rates"].items(), key=lambda kv: -kv[1]["pct"]):
        plan, length, opt = k.split("|")
        r = write(ws, r, [it, int(vcpu) if vcpu else None, mem, plan, length, opt,
                          v["usd_hr"], None, None], {7: USD, 8: PCT, 9: USD2})
        ws.cell(row=r - 1, column=8, value=f"=G{r-1}/$G${r0}").number_format = PCT
        ws.cell(row=r - 1, column=9, value=f"=G{r-1}*730").number_format = USD2
    for k, v in sorted(ri.get(it, {}).items(), key=lambda kv: -kv[1]["pct_of_ondemand"]
                       if isinstance(kv[1], dict) else 0):
        if not isinstance(v, dict) or "usd_hr" not in v:
            continue
        length, opt, cls = k.split("_")
        r = write(ws, r, [it, int(vcpu) if vcpu else None, mem, f"Reserved ({cls})", length,
                          opt, v["usd_hr"], None, None], {7: USD, 8: PCT, 9: USD2})
        ws.cell(row=r - 1, column=8, value=f"=G{r-1}/$G${r0}").number_format = PCT
        ws.cell(row=r - 1, column=9, value=f"=G{r-1}*730").number_format = USD2
ws.auto_filter.ref = f"A4:I{r-1}"
ws.cell(row=r + 1, column=1, value="نرخ Reserved به‌صورت مؤثر محاسبه شده: نرخ ساعتی + (پیش‌پرداخت ÷ ساعات دوره). ۱ سال=۸۷۶۰ ساعت، ۳ سال=۲۶۲۸۰ ساعت.").font = NOTE

# ─────────────────────────────────────────── 3. ماشین‌های مجازی
ws = sheet("ماشین مجازی", "ماشین‌های مجازی — EC2 On-Demand (Linux, Shared)",
           ["اینستنس", "خانواده", "vCPU", "حافظه", "پردازنده", "معماری", "GPU",
            "حافظه GPU", "شبکه", "دیسک محلی", "نسل فعلی", "$/ساعت", "ماهانه $"],
           [16, 26, 7, 13, 30, 13, 7, 11, 24, 20, 11, 13, 13])
r = 5
for e in ec2:
    r = write(ws, r, [e["instance"], e["family"], int(e["vcpu"]) if e["vcpu"].isdigit() else e["vcpu"],
                      e["memory"], e["cpu"], e["arch"], e["gpu"], e["gpu_mem"], e["net"],
                      e["storage"], e["gen"], float(e["usd_hr"]), None], {12: USD, 13: USD2})
    ws.cell(row=r - 1, column=13, value=f"=L{r-1}*730").number_format = USD2
ws.auto_filter.ref = f"A4:M{r-1}"

# ─────────────────────────────────────────── per-product sheets
GROUPS = [
    ("دیسک و اسنپ‌شات", "دیسک‌های مانا و ایمیج‌ها — EBS", ["دیسک‌های مانا", "ایمیج‌ها / اسنپ‌شات"]),
    ("شبکه", "شبکه ماشین‌ها — IPv4، NAT Gateway، انتقال داده، VPC Endpoint", ["شبکه ماشین‌ها"]),
    ("آبجکت استوریج", "آبجکت استوریج — S3", ["آبجکت استوریج"]),
    ("CDN و DNS", "شبکه توزیع محتوا و DNS — CloudFront و Route 53", ["شبکه توزیع محتوا (CDN)", "DNS"]),
    ("پایگاه داده", "پایگاه‌داده — RDS PostgreSQL و Aurora", ["پایگاه‌داده (Postgres)", "پایگاه‌داده نسخه ۲ (کلاستر)"]),
    ("کوبرنتیز", "کوبرنتیز — EKS", ["کوبرنتیز"]),
    ("AI Workspace", "AI Workspace — SageMaker و Bedrock", ["AI Workspace"]),
    ("DevOps و مانیتورینگ", "خدمات DevOps و مانیتورینگ", ["خدمات DevOps", "مانیتورینگ", "مهاجرت داده"]),
]
for name, title, prods in GROUPS:
    sub = [x for x in rows if x["product"] in prods]
    ws = sheet(name, title, ["محصول ما", "سرویس", "بُعد صورتحساب", "نام SKU / usageType",
                             "مشخصات", "واحد", "قیمت $", "توضیح / پله"],
               [22, 15, 22, 40, 46, 13, 14, 26])
    r = 5
    for x in sorted(sub, key=lambda z: (z["product"], z["dimension"], z["name"])):
        r = write(ws, r, [x["product"], x["service"], x["dimension"], x["name"], x["spec"],
                          x["unit"], float(x["price"]), x["note"]], {7: USD})
    ws.auto_filter.ref = f"A4:H{r-1}"

# ─────────────────────────────────────────── raw
ws = sheet("همه ردیف‌ها", f"همه‌ی {len(rows)} ردیف قیمت — داده‌ی خام برای پیوت",
           ["محصول ما", "سرویس", "بُعد صورتحساب", "نام SKU / usageType", "مشخصات",
            "واحد", "قیمت $", "توضیح / پله"], [22, 15, 22, 40, 46, 13, 14, 26])
r = 5
for x in rows:
    r = write(ws, r, [x["product"], x["service"], x["dimension"], x["name"], x["spec"],
                      x["unit"], float(x["price"]), x["note"]], {7: USD})
ws.auto_filter.ref = f"A4:H{r-1}"
RAW_LAST = r - 1

# ─────────────────────────────────────────── خلاصه (formulas over raw)
ws = wb.create_sheet("خلاصه", 1)
ws.sheet_view.rightToLeft = True
ws["A1"] = "خلاصه — تعداد ردیف قیمت به تفکیک محصول"
ws["A1"].font = TITLE_FONT
ws["A2"] = "ستون «تعداد» با فرمول COUNTIF روی شیت «همه ردیف‌ها» محاسبه می‌شود."
ws["A2"].font = NOTE
for i, (h, w) in enumerate(zip(["محصول در پنل ما", "تعداد ردیف قیمت", "کمترین قیمت $", "بیشترین قیمت $"],
                               [30, 18, 18, 18]), start=1):
    c = ws.cell(row=4, column=i, value=h)
    c.font, c.fill = HDR_FONT, HDR_FILL
    ws.column_dimensions[get_column_letter(i)].width = w
prods = sorted({x["product"] for x in rows})
r = 5
for p in prods:
    ws.cell(row=r, column=1, value=p).font = BODY
    ws.cell(row=r, column=2, value=f"=COUNTIF('همه ردیف‌ها'!$A$5:$A${RAW_LAST},A{r})").font = BODY
    ws.cell(row=r, column=3, value=f"=_xlfn.MINIFS('همه ردیف‌ها'!$G$5:$G${RAW_LAST},'همه ردیف‌ها'!$A$5:$A${RAW_LAST},A{r})").number_format = USD
    ws.cell(row=r, column=4, value=f"=_xlfn.MAXIFS('همه ردیف‌ها'!$G$5:$G${RAW_LAST},'همه ردیف‌ها'!$A$5:$A${RAW_LAST},A{r})").number_format = USD
    r += 1
ws.cell(row=r, column=1, value="جمع").font = Font(name=ARIAL, bold=True, size=10)
ws.cell(row=r, column=2, value=f"=SUM(B5:B{r-1})").font = Font(name=ARIAL, bold=True, size=10)

wb.save("AWS-Pricing-Benchmark.xlsx")
print(f"saved: {len(wb.sheetnames)} sheets — {wb.sheetnames}")
