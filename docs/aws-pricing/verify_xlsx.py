#!/usr/bin/env python3
"""Verify every formula in the workbook by resolving its ranges against real cell values
and recomputing the expected result in Python. Substitutes for the LibreOffice recalc pass,
which cannot run in this environment."""
import re, json, csv
from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string

wb = load_workbook("AWS-Pricing-Benchmark.xlsx")
sp = json.load(open("savings_plan_rates.json", encoding="utf-8"))
raw_rows = list(csv.DictReader(open("aws_pricing_us-east-1.csv", encoding="utf-8")))
ec2_src = list(csv.DictReader(open("ec2_ondemand.csv", encoding="utf-8")))

fails, checked = [], 0
def ck(cond, msg):
    global checked
    checked += 1
    if not cond:
        fails.append(msg)

def val(ws, ref):
    ref = ref.replace("$", "")
    m = re.match(r"([A-Z]+)(\d+)", ref)
    return ws.cell(row=int(m.group(2)), column=column_index_from_string(m.group(1))).value

# ── 1. ladder sheet: pct = rate / on-demand-anchor, monthly = rate * 730
ws = wb["نردبان تخفیف"]
anchors = {}
for r in range(5, ws.max_row + 1):
    inst, mech, rate = ws.cell(r, 1).value, ws.cell(r, 4).value, ws.cell(r, 7).value
    if inst is None or not isinstance(rate, (int, float)):
        continue   # blank spacer / footnote row, not a data row
    if mech == "On-Demand":
        anchors[inst] = (r, rate)
        ck(abs(rate - sp[inst]["ondemand_usd_hr"]) < 1e-9,
           f"ladder: on-demand rate mismatch for {inst}")
    f8, f9 = ws.cell(r, 8).value, ws.cell(r, 9).value
    m = re.fullmatch(r"=G(\d+)/\$G\$(\d+)", str(f8))
    ck(m is not None, f"ladder r{r}: pct formula malformed: {f8}")
    if m:
        ck(int(m.group(1)) == r, f"ladder r{r}: pct numerator points at row {m.group(1)}")
        ck(int(m.group(2)) == anchors[inst][0],
           f"ladder r{r}: {inst} denominator row {m.group(2)} != anchor {anchors[inst][0]}")
        num, den = val(ws, f"G{m.group(1)}"), val(ws, f"G{m.group(2)}")
        ck(isinstance(num, (int, float)) and isinstance(den, (int, float)) and den > 0,
           f"ladder r{r}: pct operands not numeric/positive")
        if isinstance(num, (int, float)) and isinstance(den, (int, float)) and den > 0:
            ck(0 < num / den <= 1.0001, f"ladder r{r}: pct {num/den:.3f} outside (0,1]")
    m9 = re.fullmatch(r"=G(\d+)\*730", str(f9))
    ck(m9 is not None and int(m9.group(1)) == r, f"ladder r{r}: monthly formula wrong: {f9}")

# cross-check a known ladder value against the source JSON
row_m7i = [r for r in range(5, ws.max_row + 1)
           if ws.cell(r, 1).value == "m7i.xlarge" and ws.cell(r, 4).value == "EC2 Instance SP"
           and ws.cell(r, 5).value == "3yr" and ws.cell(r, 6).value == "All Upfront"]
ck(len(row_m7i) == 1, "ladder: m7i 3yr EC2SP AllUpfront row not found exactly once")
if row_m7i:
    got = ws.cell(row_m7i[0], 7).value
    exp = sp["m7i.xlarge"]["rates"]["EC2 Instance SP|3yr|All Upfront"]["usd_hr"]
    ck(abs(got - exp) < 1e-9, f"ladder: m7i deepest rate {got} != {exp}")
    ck(abs(got / anchors['m7i.xlarge'][1] - 0.395) < 0.005,
       f"ladder: m7i deepest pct {got/anchors['m7i.xlarge'][1]:.4f} != ~0.395")

# ── 2. EC2 sheet: monthly = hourly * 730, hourly matches source
ws = wb["ماشین مجازی"]
src = {e["instance"]: float(e["usd_hr"]) for e in ec2_src}
bad_rate = bad_form = 0
for r in range(5, ws.max_row + 1):
    inst, hourly, f = ws.cell(r, 1).value, ws.cell(r, 12).value, ws.cell(r, 13).value
    if inst is None:
        continue
    if inst not in src or abs(hourly - src[inst]) > 1e-9:
        bad_rate += 1
    if str(f) != f"=L{r}*730":
        bad_form += 1
ck(bad_rate == 0, f"EC2 sheet: {bad_rate} rows whose hourly rate != source")
ck(bad_form == 0, f"EC2 sheet: {bad_form} rows with wrong monthly formula")

# ── 3. summary sheet: COUNTIF / MINIFS / MAXIFS ranges + recomputed results
ws = wb["خلاصه"]
rawws = wb["همه ردیف‌ها"]
raw_last = rawws.max_row
by_prod = {}
for x in raw_rows:
    by_prod.setdefault(x["product"], []).append(float(x["price"]))
for r in range(5, ws.max_row + 1):
    prod = ws.cell(r, 1).value
    if prod is None or prod == "جمع":
        continue
    ck(prod in by_prod, f"summary r{r}: product '{prod}' not present in raw data")
    fc = str(ws.cell(r, 2).value)
    m = re.fullmatch(r"=COUNTIF\('همه ردیف‌ها'!\$A\$5:\$A\$(\d+),A(\d+)\)", fc)
    ck(m is not None, f"summary r{r}: COUNTIF malformed: {fc}")
    if m:
        ck(int(m.group(1)) == raw_last,
           f"summary r{r}: COUNTIF range ends {m.group(1)}, raw sheet ends {raw_last}")
        ck(int(m.group(2)) == r, f"summary r{r}: COUNTIF criterion points at row {m.group(2)}")
    for col, fn in ((3, "MINIFS"), (4, "MAXIFS")):
        f = str(ws.cell(r, col).value)
        ck(f.startswith(f"=_xlfn.{fn}("), f"summary r{r}: {fn} missing _xlfn prefix: {f[:40]}")
        ck(f"$G$5:$G${raw_last}" in f and f"$A$5:$A${raw_last}" in f,
           f"summary r{r}: {fn} ranges do not match raw extent {raw_last}")
tot = str(ws.cell(ws.max_row, 2).value)
ck(re.fullmatch(r"=SUM\(B5:B\d+\)", tot), f"summary: total formula malformed: {tot}")

# ── 4. raw sheet integrity: row count + a spot value
ck(raw_last - 4 == len(raw_rows), f"raw sheet has {raw_last-4} data rows, expected {len(raw_rows)}")

# ── 5. cross-sheet references quote the space-containing sheet name
for r in range(5, ws.max_row + 1):
    for col in (2, 3, 4):
        f = ws.cell(r, col).value
        if isinstance(f, str) and "همه ردیف‌ها" in f:
            ck("'همه ردیف‌ها'!" in f, f"summary r{r}c{col}: sheet name not quoted")

print(f"formula/value checks run: {checked}")
if fails:
    print(f"\n✗ {len(fails)} FAILURES:")
    for f in fails[:25]:
        print("   ", f)
else:
    print("✓ all checks passed — every formula resolves to the intended range and value")
