#!/usr/bin/env python3
"""Extract AWS us-east-1 list prices, mapped to the Iranian provider's product menu."""
import csv, json, sys, collections

csv.field_size_limit(10**7)
REGION = "us-east-1"
HOURS = {"1yr": 8760, "3yr": 26280}

def rows(f):
    fh = open(f, newline="", encoding="utf-8")
    for _ in range(5):
        fh.readline()
    return csv.DictReader(fh)

def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None

out = collections.defaultdict(list)      # product -> list of dicts
def add(product, service, dimension, name, spec, unit, price, note=""):
    out[product].append(dict(product=product, service=service, dimension=dimension,
                             name=name, spec=spec, unit=unit,
                             price=None if price is None else round(price, 8), note=note))

# ─────────────────────────────────────────── EC2: compute, disks, snapshots, IPs
ondemand, reserved = {}, collections.defaultdict(dict)
ebs_vol, ebs_iops, ebs_thr, snap, ipaddr, natdt = {}, {}, {}, {}, {}, {}
other_fam = collections.Counter()

for r in rows("AmazonEC2.csv"):
    fam, term = r["Product Family"], r["TermType"]
    other_fam[fam] += 1
    p = num(r["PricePerUnit"])
    if p is None:
        continue

    if fam == "Compute Instance":
        if not (r["Tenancy"] == "Shared" and r["Operating System"] == "Linux"
                and r["Pre Installed S/W"] == "NA" and r["CapacityStatus"] == "Used"
                and r["License Model"] == "No License required"):
            continue
        it = r["Instance Type"]
        if term == "OnDemand" and p > 0:
            ondemand[it] = dict(
                instance=it, family=r["Instance Family"], vcpu=r["vCPU"], memory=r["Memory"],
                cpu=r["Physical Processor"], arch=r["Processor Architecture"],
                gpu=r["GPU"], gpu_mem=r["GPU Memory"], net=r["Network Performance"],
                storage=r["Storage"], gen=r["Current Generation"], usd_hr=p)
        elif term == "Reserved":
            key = (r["LeaseContractLength"], r["PurchaseOption"], r["OfferingClass"])
            d = reserved[it].setdefault(key, {"hourly": 0.0, "upfront": 0.0})
            if r["Unit"] == "Quantity":
                d["upfront"] += p
            else:
                d["hourly"] += p

    elif fam == "Storage" and term == "OnDemand":
        v = r["Volume API Name"]
        if v:
            ebs_vol[v] = dict(volume=v, type=r["Volume Type"], media=r["Storage Media"],
                              max_size=r["Max Volume Size"], max_iops=r["Max IOPS/volume"],
                              max_thr=r["Max throughput/volume"], unit=r["Unit"], usd=p)
    elif fam == "System Operation" and term == "OnDemand" and p > 0:
        ebs_iops[r["usageType"]] = dict(usage=r["usageType"], volume=r["Volume API Name"],
                                        desc=r["PriceDescription"], unit=r["Unit"], usd=p)
    elif fam == "Provisioned Throughput" and term == "OnDemand" and p > 0:
        ebs_thr[r["usageType"]] = dict(usage=r["usageType"], volume=r["Volume API Name"],
                                       desc=r["PriceDescription"], unit=r["Unit"], usd=p)
    elif fam == "Storage Snapshot" and term == "OnDemand":
        snap[r["usageType"]] = dict(usage=r["usageType"], desc=r["PriceDescription"],
                                    unit=r["Unit"], usd=p)
    elif fam == "IP Address" and term == "OnDemand":
        ipaddr[r["usageType"]] = dict(usage=r["usageType"], desc=r["PriceDescription"],
                                      unit=r["Unit"], usd=p)
    elif fam in ("NAT Gateway", "Data Transfer", "CPU Credits") and term == "OnDemand" and p > 0:
        natdt[(fam, r["usageType"], r["StartingRange"])] = dict(
            fam=fam, usage=r["usageType"], desc=r["PriceDescription"], unit=r["Unit"], usd=p,
            rng=f"{r['StartingRange']}–{r['EndingRange']}" if r["EndingRange"] not in ("", "Inf") else "")

# ── ماشین‌های مجازی
for it, d in sorted(ondemand.items(), key=lambda kv: kv[1]["usd_hr"]):
    spec = f"{d['vcpu']} vCPU / {d['memory']}"
    if d["gpu"]:
        spec += f" / GPU {d['gpu']}"
    add("ماشین‌های مجازی", "EC2", "زمان مصرف", it, spec, "USD/hr", d["usd_hr"],
        f"{d['family']} | {d['cpu']} | {d['net']}")

# ── نردبان تخفیف (representative types across families)
REP = ["t3.medium", "m7i.xlarge", "m7g.xlarge", "c7i.2xlarge", "r7i.xlarge", "m5.xlarge"]
ladder = []
for it in REP:
    if it not in ondemand:
        continue
    od = ondemand[it]["usd_hr"]
    e = {"instance": it, "vcpu": ondemand[it]["vcpu"], "memory": ondemand[it]["memory"],
         "ondemand_usd_hr": od}
    for (length, opt, cls), d in reserved.get(it, {}).items():
        eff = d["hourly"] + d["upfront"] / HOURS[length]
        if eff <= 0:
            continue
        e[f"{length}_{opt.replace(' ', '')}_{cls}"] = dict(
            usd_hr=round(eff, 6), pct_of_ondemand=round(eff / od * 100, 1))
    ladder.append(e)

# ── دیسک‌های مانا
for v, d in sorted(ebs_vol.items()):
    add("دیسک‌های مانا", "EBS", "ظرفیت رزروشده", v, d["type"], d["unit"], d["usd"],
        f"max {d['max_size']} | max IOPS {d['max_iops']} | max {d['max_thr']}")
for d in sorted(ebs_iops.values(), key=lambda x: x["usage"]):
    add("دیسک‌های مانا", "EBS", "IOPS رزروشده", d["usage"], d["desc"], d["unit"], d["usd"])
for d in sorted(ebs_thr.values(), key=lambda x: x["usage"]):
    add("دیسک‌های مانا", "EBS", "throughput رزروشده", d["usage"], d["desc"], d["unit"], d["usd"])

# ── ایمیج‌ها
for d in sorted(snap.values(), key=lambda x: x["usage"]):
    add("ایمیج‌ها / اسنپ‌شات", "EBS Snapshot", "مصرف واقعی", d["usage"], d["desc"], d["unit"], d["usd"])

# ── شبکه ماشین‌ها: IP
for d in sorted(ipaddr.values(), key=lambda x: x["usage"]):
    add("شبکه ماشین‌ها", "EC2 IPv4", "ظرفیت رزروشده", d["usage"], d["desc"], d["unit"], d["usd"])

for d in sorted(natdt.values(), key=lambda x: (x["fam"], x["usage"])):
    prod = "ماشین‌های مجازی" if d["fam"] == "CPU Credits" else "شبکه ماشین‌ها"
    add(prod, "EC2", d["fam"], d["usage"], d["desc"], d["unit"], d["usd"],
        ("پله: " + d["rng"]) if d["rng"] else "")

# ─────────────────────────────────────────── VPC (NAT gateway, endpoints)
for r in rows("AmazonVPC.csv"):
    p = num(r["PricePerUnit"])
    if p is None or p == 0 or r["TermType"] != "OnDemand":
        continue
    add("شبکه ماشین‌ها", "VPC", r["Product Family"] or "NAT/Endpoint",
        r["usageType"], r["PriceDescription"], r["Unit"], p, r["Group"])

# ─────────────────────────────────────────── Data transfer (egress)
seen = set()
for r in rows("AWSDataTransfer_global.csv"):
    p = num(r["PricePerUnit"])
    if p is None or r["TermType"] != "OnDemand":
        continue
    if r.get("From Region Code") != REGION and r.get("Region Code") != REGION:
        continue
    key = (r["usageType"], r["StartingRange"], r["To Location"])
    if key in seen:
        continue
    seen.add(key)
    rng = f"{r['StartingRange']}–{r['EndingRange']} {r['Unit']}"
    add("شبکه ماشین‌ها", "Data Transfer", "انتقال داده", r["usageType"],
        f"{r['Transfer Type']} → {r['To Location']}", r["Unit"], p,
        f"پله: {rng}")

# ─────────────────────────────────────────── S3
for r in rows("AmazonS3.csv"):
    p = num(r["PricePerUnit"])
    if p is None or r["TermType"] != "OnDemand" or not r["Product Family"]:
        continue
    dim = {"Storage": "مصرف واقعی", "API Request": "عملیات",
           "Fee": "حداقل‌ها و جریمه‌ها", "Data Transfer": "انتقال داده"}.get(r["Product Family"], r["Product Family"])
    spec = r["Storage Class"] or r["Group Description"] or r["PriceDescription"]
    note = f"پله: {r['StartingRange']}–{r['EndingRange']}" if r["EndingRange"] not in ("", "Inf") else ""
    add("آبجکت استوریج", "S3", dim, r["usageType"], spec, r["Unit"], p, note)

# ─────────────────────────────────────────── CloudFront + Route53
for r in rows("AmazonCloudFront_global.csv"):
    p = num(r["PricePerUnit"])
    if p is None or r["TermType"] != "OnDemand" or not r["Product Family"]:
        continue
    loc = r.get("From Location") or r.get("Location") or ""
    if loc and "United States" not in loc and r["Product Family"] == "Data Transfer":
        continue
    add("شبکه توزیع محتوا (CDN)", "CloudFront", r["Product Family"],
        r["usageType"], r["PriceDescription"], r["Unit"], p,
        f"پله: {r['StartingRange']}–{r['EndingRange']}" if r["EndingRange"] not in ("", "Inf") else "")

for r in rows("AmazonRoute53_global.csv"):
    p = num(r["PricePerUnit"])
    if p is None or r["TermType"] != "OnDemand" or not r["Product Family"]:
        continue
    if r["Product Family"] == "DNS Domain Names":
        continue
    add("DNS", "Route 53", r["Product Family"], r["usageType"],
        r["PriceDescription"], r["Unit"], p,
        f"پله: {r['StartingRange']}–{r['EndingRange']}" if r["EndingRange"] not in ("", "Inf") else "")

# ─────────────────────────────────────────── RDS (Postgres + clusters)
pg_od, pg_res, rds_stor = {}, collections.defaultdict(dict), {}
for r in rows("AmazonRDS.csv"):
    p = num(r["PricePerUnit"])
    if p is None:
        continue
    fam = r["Product Family"]
    if fam == "Database Instance":
        eng, dep = r["Database Engine"], r["Deployment Option"]
        if "PostgreSQL" not in eng or r["License Model"] not in ("No license required", ""):
            continue
        key = (r["Instance Type"], dep, eng)
        if r["TermType"] == "OnDemand" and p > 0:
            pg_od[key] = dict(instance=r["Instance Type"], dep=dep, engine=eng,
                              vcpu=r["vCPU"], memory=r["Memory"], usd_hr=p)
        elif r["TermType"] == "Reserved":
            k2 = (r["LeaseContractLength"], r["PurchaseOption"])
            d = pg_res[key].setdefault(k2, {"hourly": 0.0, "upfront": 0.0})
            d["upfront" if r["Unit"] == "Quantity" else "hourly"] += p
    elif fam in ("Database Storage", "Provisioned IOPS", "Provisioned Throughput",
                 "Storage Snapshot") and r["TermType"] == "OnDemand" and p > 0:
        if r["Database Engine"] and "PostgreSQL" not in r["Database Engine"] and r["Database Engine"] != "Any":
            continue
        rds_stor[(fam, r["usageType"])] = dict(fam=fam, usage=r["usageType"],
                                               desc=r["PriceDescription"], unit=r["Unit"], usd=p,
                                               dep=r["Deployment Option"])

for key, d in sorted(pg_od.items(), key=lambda kv: kv[1]["usd_hr"]):
    prod = "پایگاه‌داده (Postgres)" if "Aurora" not in d["engine"] else "پایگاه‌داده نسخه ۲ (کلاستر)"
    add(prod, "RDS", "زمان مصرف", d["instance"],
        f"{d['vcpu']} vCPU / {d['memory']} — {d['dep']}", "USD/hr", d["usd_hr"], d["engine"])
for d in sorted(rds_stor.values(), key=lambda x: (x["fam"], x["usage"])):
    add("پایگاه‌داده (Postgres)", "RDS", d["fam"], d["usage"], d["desc"], d["unit"], d["usd"], d["dep"])

# ─────────────────────────────────────────── EKS
for r in rows("AmazonEKS.csv"):
    p = num(r["PricePerUnit"])
    if p is None or p == 0 or r["TermType"] != "OnDemand":
        continue
    add("کوبرنتیز", "EKS", "زمان مصرف", r["usageType"], r["PriceDescription"], r["Unit"], p,
        r.get("Group", ""))

# ─────────────────────────────────────────── AI Workspace: SageMaker + Bedrock
sm = {}
for r in rows("AmazonSageMaker.csv"):
    p = num(r["PricePerUnit"])
    if p is None or p == 0 or r["TermType"] != "OnDemand":
        continue
    if r["Product Family"] == "ML Instance":
        comp = r.get("Component", "") or r.get("usageType", "")
        sm[(r.get("Instance Name") or r["usageType"], comp)] = dict(
            name=r.get("Instance Name") or r["usageType"], comp=comp,
            vcpu=r.get("vCPU", ""), mem=r.get("Memory", ""), gpu=r.get("GPU", ""),
            unit=r["Unit"], usd=p)
for d in sorted(sm.values(), key=lambda x: x["usd"]):
    spec = f"{d['vcpu']} vCPU / {d['mem']}" + (f" / GPU {d['gpu']}" if d["gpu"] else "")
    add("AI Workspace", "SageMaker", "زمان مصرف", d["name"], spec.strip(" /"), d["unit"], d["usd"], d["comp"])

bed = {}
for r in rows("AmazonBedrock.csv"):
    p = num(r["PricePerUnit"])
    if p is None or p == 0 or r["TermType"] != "OnDemand":
        continue
    key = (r["usageType"], r["PriceDescription"])
    if key in bed:
        continue
    bed[key] = 1
    add("AI Workspace", "Bedrock", "توکن / درخواست", r["usageType"],
        r["PriceDescription"], r["Unit"], p, r.get("Model Name", ""))

# ─────────────────────────────────────────── DevOps
for f, svc in [("CodeBuild.csv", "CodeBuild"), ("AWSCodePipeline.csv", "CodePipeline")]:
    for r in rows(f):
        p = num(r["PricePerUnit"])
        if p is None or p == 0 or r["TermType"] != "OnDemand":
            continue
        add("خدمات DevOps", svc, r["Product Family"], r["usageType"],
            r["PriceDescription"], r["Unit"], p)

# ─────────────────────────────────────────── مانیتورینگ
for r in rows("AmazonCloudWatch.csv"):
    p = num(r["PricePerUnit"])
    if p is None or r["TermType"] != "OnDemand" or not r["Product Family"]:
        continue
    add("مانیتورینگ", "CloudWatch", r["Product Family"], r["usageType"],
        r["PriceDescription"], r["Unit"], p,
        f"پله: {r['StartingRange']}–{r['EndingRange']}" if r["EndingRange"] not in ("", "Inf") else "")

# ─────────────────────────────────────────── مهاجرت داده
for r in rows("AWSDataSync.csv"):
    p = num(r["PricePerUnit"])
    if p is None or p == 0:
        continue
    add("مهاجرت داده", "DataSync", "مصرف واقعی", r["usageType"],
        r["PriceDescription"], r["Unit"], p)

# ─────────────────────────────────────────── write
allrows = [x for v in out.values() for x in v]
with open("aws_pricing_us-east-1.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=["product", "service", "dimension", "name", "spec", "unit", "price", "note"])
    w.writeheader()
    w.writerows(allrows)

with open("ec2_ondemand.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(next(iter(ondemand.values())).keys()))
    w.writeheader()
    w.writerows(sorted(ondemand.values(), key=lambda d: d["usd_hr"]))

json.dump(ladder, open("discount_ladder.json", "w"), indent=1)

print(f"total priced line items: {len(allrows)}")
print(f"EC2 on-demand Linux instance types: {len(ondemand)}")
print(f"EC2 types with reserved terms: {len(reserved)}")
print(f"RDS PostgreSQL instance/deployment combos: {len(pg_od)}\n")
for k in sorted(out, key=lambda k: -len(out[k])):
    print(f"  {len(out[k]):6d}  {k}")
print("\nEC2 product families seen:", dict(other_fam.most_common(8)))
