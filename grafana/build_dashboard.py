#!/usr/bin/env python3
"""
Builds the "External IP Reuse / Workspace Connections" Grafana dashboard.

Why a generator instead of hand-written JSON: the same PromQL sub-expressions
repeat across ~10 panels. Editing them in one place here and regenerating is
far less error-prone than keeping 10 copies in sync inside the JSON.

Usage:
    python3 build_dashboard.py > external-ip-reuse-dashboard.json
"""

import json

# UID of the "engine-vm-thr1" Prometheus/VictoriaMetrics datasource, taken from
# the exported "Cluster Unused ExternalIPs Cleanup" dashboard. It is only the
# *default* for the $datasource variable; the picker can change it.
DEFAULT_DS_UID = "b6273083-9ae2-405c-a518-bb13a2d1a92e"

DS = {"type": "prometheus", "uid": "${datasource}"}

# --------------------------------------------------------------------------
# Building blocks
# --------------------------------------------------------------------------

# Common label matchers. compute-reserve is the free/unallocated pool, so it is
# excluded everywhere we talk about "a customer workspace".
COMMON = 'cluster=~"$cluster", namespace!="compute-reserve", namespace=~"$ns_filter"'

# Every external IP record, attached or not.
SEL_ALL = f'kube_customresource_external_ip_info{{{COMMON}}}'

# Only the samples where the IP is actually bound to a resource.
# target_kind="" is what the cleanup dashboard uses to mean "unused".
SEL_ATT = f'kube_customresource_external_ip_info{{{COMMON}, target_kind!=""}}'


def binding(sel=SEL_ATT):
    """Collapse a raw kube-state-metrics series down to just the identity of a
    binding: (cluster, namespace, ip) -> (target_kind, target_name).

    This inner aggregation is NOT optional. The raw metric also carries KSM
    plumbing labels (instance, pod, job, endpoint, ...) plus `name` and
    `gateway`. Counting series without collapsing first means a kube-state-
    metrics pod restart invents a brand new series and inflates every count.
    """
    return (
        f'max by (cluster, namespace, ip, target_kind, target_name) ({sel})'
    )


def distinct_targets(sel=SEL_ATT):
    """Number of DISTINCT resources each IP was bound to over $window.

    count_over_time() gives one output series per distinct binding identity;
    counting those series per (cluster, namespace, ip) is the standard PromQL
    count-distinct idiom.
    """
    return (
        'count by (cluster, namespace, ip) (\n'
        '  count_over_time(\n'
        f'    ( {binding(sel)} )[$window:$step]\n'
        '  )\n'
        ')'
    )


def max_concurrent(sel=SEL_ATT):
    """Highest number of resources bound to the IP AT THE SAME INSTANT.

    Needed to tell real sequential re-use apart from an IP that is simply
    fanned out to several targets at once: distinct=3 & concurrent=1 means the
    IP was genuinely handed from one resource to the next.
    """
    return (
        'max_over_time(\n'
        '  (\n'
        '    count by (cluster, namespace, ip) (\n'
        f'      {binding(sel)}\n'
        '    )\n'
        '  )[$window:$step]\n'
        ')'
    )


def distinct_workspaces():
    """Number of DISTINCT namespaces (= workspaces) an IP has lived in.

    Deliberately aggregated WITHOUT `cluster`: an IP that is re-issued in a
    different cluster is still the same IP being re-used, not two IPs.
    """
    return (
        'count by (ip) (\n'
        '  count_over_time(\n'
        f'    ( max by (ip, namespace) ({SEL_ALL}) )[$window:$step]\n'
        '  )\n'
        ')'
    )


def workspace_membership():
    """Per (ip, namespace) how many $step buckets the IP belonged to that
    namespace. Multiply by $step to read it as a dwell time.

    NOTE: `sum by`, not `count by`. The inner `max by (ip, namespace)` already
    yields exactly one series per group, so `count by (ip, namespace)` would
    return a constant 1 instead of the bucket count. `count by` is only the
    right outer aggregation when it is COARSER than the inner grouping (that is
    the count-distinct case in distinct_targets/distinct_workspaces).
    """
    return (
        'sum by (ip, namespace) (\n'
        '  count_over_time(\n'
        f'    ( max by (ip, namespace) ({SEL_ALL}) )[$window:$step]\n'
        '  )\n'
        ')'
    )


# The headline expression: IPs bound to more than one resource over time, but
# never to more than one at once -> the IP was reserved and re-used.
TRUE_SEQUENTIAL_REUSE = (
    '(\n'
    f'  {distinct_targets()} > 1\n'
    ')\n'
    'and on (cluster, namespace, ip)\n'
    '(\n'
    f'  {max_concurrent()} == 1\n'
    ')'
)


# --------------------------------------------------------------------------
# Panel helpers
# --------------------------------------------------------------------------

def target(expr, ref="A", instant=True, legend="__auto"):
    return {
        "refId": ref,
        "datasource": DS,
        "editorMode": "code",
        "expr": expr,
        "format": "table" if instant else "time_series",
        "instant": instant,
        "range": not instant,
        "legendFormat": legend,
        "exemplar": False,
    }


def stat(pid, title, expr, gp, desc="", color="text", unit="none"):
    return {
        "id": pid,
        "type": "stat",
        "title": title,
        "description": desc,
        "datasource": DS,
        "gridPos": gp,
        "targets": [target(expr)],
        "options": {
            "colorMode": color,
            "graphMode": "none",
            "justifyMode": "center",
            "orientation": "auto",
            "reduceOptions": {
                "calcs": ["lastNotNull"],
                "fields": "",
                "values": False,
            },
            "textMode": "auto",
            "wideLayout": True,
        },
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "color": {"mode": "fixed", "fixedColor": "text"},
                "mappings": [{"options": {"match": "null", "result": {"text": "0"}}, "type": "special"}],
            },
            "overrides": [],
        },
    }


def table(pid, title, targets, gp, desc="", organize=None, sort_by=None,
          overrides=None, extra_transformations=None):
    transformations = []
    if extra_transformations:
        transformations.extend(extra_transformations)
    if organize:
        transformations.append({"id": "organize", "options": organize})
    options = {"cellHeight": "sm", "showHeader": True, "footer": {"show": False, "reducer": ["sum"], "countRows": False, "fields": ""}}
    if sort_by:
        options["sortBy"] = [{"displayName": sort_by, "desc": True}]
    return {
        "id": pid,
        "type": "table",
        "title": title,
        "description": desc,
        "datasource": DS,
        "gridPos": gp,
        "targets": targets,
        "transformations": transformations,
        "options": options,
        "fieldConfig": {
            "defaults": {
                "custom": {
                    "align": "left",
                    "cellOptions": {"type": "auto"},
                    "filterable": True,
                    "inspect": False,
                },
                "color": {"mode": "thresholds"},
                "thresholds": {"mode": "absolute", "steps": [{"color": "text", "value": None}]},
            },
            "overrides": overrides or [],
        },
    }


def row(pid, title, y, collapsed=False):
    return {
        "id": pid,
        "type": "row",
        "title": title,
        "gridPos": {"h": 1, "w": 24, "x": 0, "y": y},
        "collapsed": collapsed,
        "panels": [],
    }


# Shared column renaming for the (cluster, namespace, ip) tables.
BASE_ORGANIZE = {
    "excludeByName": {"Time": True, "__name__": True},
    "includeByName": {},
    "indexByName": {"cluster": 0, "namespace": 1, "ip": 2, "Value": 3},
    "renameByName": {
        "cluster": "Cluster",
        "namespace": "Namespace (Workspace)",
        "ip": "IP",
    },
}


def organize_with(value_name, **extra_renames):
    o = json.loads(json.dumps(BASE_ORGANIZE))
    o["renameByName"]["Value"] = value_name
    o["renameByName"].update(extra_renames)
    return o


# --------------------------------------------------------------------------
# Panels
# --------------------------------------------------------------------------

panels = []

# ---- Row 1: summary ------------------------------------------------------
panels.append(row(100, "① Summary — is IP reservation actually being re-used?", 0))

panels.append(stat(
    1, "IPs with ≥1 attachment",
    f'count(\n{distinct_targets()}\n)',
    {"h": 4, "w": 6, "x": 0, "y": 1},
    desc="Denominator: distinct (cluster, namespace, ip) that were bound to at least one resource at some point during $window.",
))

panels.append(stat(
    2, "IPs bound to >1 resource",
    f'count(\n{distinct_targets()} > 1\n)',
    {"h": 4, "w": 6, "x": 6, "y": 1},
    desc="IPs that saw more than one distinct target inside the SAME workspace during $window. Includes IPs fanned out to several targets simultaneously — see the next stat for the stricter count.",
))

panels.append(stat(
    3, "IPs re-used sequentially (strict)",
    f'count(\n{TRUE_SEQUENTIAL_REUSE}\n)',
    {"h": 4, "w": 6, "x": 12, "y": 1},
    desc="THE headline number. >1 distinct target over time AND never more than one target at the same instant => the IP was held (reserved) and handed from one resource to the next.",
))

panels.append(stat(
    4, "IPs seen in >1 workspace",
    f'count(\n{distinct_workspaces()} > 1\n)',
    {"h": 4, "w": 6, "x": 18, "y": 1},
    desc="Same IP address observed under more than one namespace during $window — e.g. customer A released it and customer B later bought it. Aggregated across clusters on purpose.",
))

# ---- Row 2: reuse inside one workspace -----------------------------------
panels.append(row(200, "② Re-use inside the SAME workspace", 5))

panels.append(table(
    5, "IPs bound to more than one resource (same workspace)",
    [target(f'{distinct_targets()} > 1')],
    {"h": 11, "w": 14, "x": 0, "y": 6},
    desc="One row per (cluster, namespace, ip). 'Distinct Resources' = how many different target_kind/target_name pairs the IP was attached to across $window. Sort descending to find the most-recycled IPs.",
    organize=organize_with("Distinct Resources"),
    sort_by="Distinct Resources",
))

panels.append({
    "id": 6,
    "type": "bargauge",
    "title": "Top 25 most re-used IPs",
    "description": "Same data as the table on the left, ranked.",
    "datasource": DS,
    "gridPos": {"h": 11, "w": 10, "x": 14, "y": 6},
    "targets": [target(f'topk(25,\n{distinct_targets()} > 1\n)', instant=False, legend="{{namespace}} — {{ip}}")],
    "options": {
        "displayMode": "gradient",
        "orientation": "horizontal",
        "showUnfilled": True,
        "valueMode": "color",
        "minVizHeight": 16,
        "minVizWidth": 8,
        "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
    },
    "fieldConfig": {
        "defaults": {
            "unit": "none",
            "color": {"mode": "continuous-BlYlRd"},
            "thresholds": {"mode": "absolute", "steps": [{"color": "text", "value": None}]},
        },
        "overrides": [],
    },
})

panels.append(table(
    7, "Strict sequential re-use (reserved, then handed to a new resource)",
    [target(TRUE_SEQUENTIAL_REUSE)],
    {"h": 10, "w": 14, "x": 0, "y": 17},
    desc="Subset of the table above, keeping only IPs that were never attached to two resources at the same instant. This is the list that proves 'the customer reserved the IP and used it more than once'.",
    organize=organize_with("Distinct Resources (sequential)"),
    sort_by="Distinct Resources (sequential)",
))

panels.append(table(
    8, "⚠ Attached to >1 resource AT THE SAME TIME (review, not re-use)",
    [target(f'{max_concurrent()} > 1')],
    {"h": 10, "w": 10, "x": 14, "y": 17},
    desc="These IPs had several live targets simultaneously, so their 'distinct resources' count is fan-out rather than sequential re-use. Expect this to be empty or tiny; if it is not, the metric may expose one series per exposure path and the model needs a second look.",
    organize=organize_with("Max Concurrent Targets"),
    sort_by="Max Concurrent Targets",
))

# ---- Row 3: same IP across workspaces ------------------------------------
panels.append(row(300, "③ The same IP across DIFFERENT workspaces", 27))

panels.append(table(
    9, "IPs that lived in more than one workspace",
    [target(f'{distinct_workspaces()} > 1')],
    {"h": 10, "w": 10, "x": 0, "y": 28},
    desc="Counted over every record of the IP (attached or not), so a release-then-resell cycle is captured. compute-reserve is excluded, so parking in the free pool between owners does not count as a workspace.",
    organize={
        "excludeByName": {"Time": True, "__name__": True},
        "includeByName": {},
        "indexByName": {"ip": 0, "Value": 1},
        "renameByName": {"ip": "IP", "Value": "Distinct Workspaces"},
    },
    sort_by="Distinct Workspaces",
))

panels.append(table(
    10, "Workspace history of those IPs",
    [target(
        f'{workspace_membership()}\n'
        'and on (ip)\n'
        f'(\n{distinct_workspaces()} > 1\n)'
    )],
    {"h": 10, "w": 14, "x": 10, "y": 28},
    desc="Expands the previous panel: one row per (ip, namespace). 'Buckets Present' is how many $step samples the IP belonged to that namespace — multiply by $step for an approximate dwell time (e.g. 72 buckets at 1h ≈ 3 days).",
    organize={
        "excludeByName": {"Time": True, "__name__": True},
        "includeByName": {},
        "indexByName": {"ip": 0, "namespace": 1, "Value": 2},
        "renameByName": {"ip": "IP", "namespace": "Namespace (Workspace)", "Value": "Buckets Present"},
    },
    sort_by="IP",
))

# ---- Row 4: drill-down ---------------------------------------------------
panels.append(row(400, "④ Drill-down for a single IP — $ip", 38))

panels.append({
    "id": 11,
    "type": "state-timeline",
    "title": "Binding timeline for $ip",
    "description": "One lane per (namespace, target_kind, target_name) the IP was bound to. Gaps = the IP was unattached. This is the visual proof of 'reserved, released, re-attached'. Uses the time picker range, not $window.",
    "datasource": DS,
    "gridPos": {"h": 10, "w": 24, "x": 0, "y": 39},
    "targets": [target(
        'max by (namespace, target_kind, target_name) (\n'
        '  kube_customresource_external_ip_info{cluster=~"$cluster", ip="$ip"}\n'
        ')',
        instant=False,
        legend="{{namespace}} | {{target_kind}}/{{target_name}}",
    )],
    "options": {
        "alignValue": "left",
        "legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
        "mergeValues": False,
        "rowHeight": 0.9,
        "showValue": "never",
        "tooltip": {"mode": "single", "sort": "none"},
    },
    "fieldConfig": {
        "defaults": {
            "custom": {"fillOpacity": 80, "lineWidth": 0, "insertNulls": False, "spanNulls": False},
            "color": {"mode": "continuous-GrYlRd"},
            "mappings": [{"options": {"1": {"text": "attached", "index": 0}}, "type": "value"}],
            "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]},
        },
        "overrides": [],
    },
})

panels.append(table(
    12, "Every binding ever seen for $ip",
    [target(
        # sum, not count: see the note in workspace_membership().
        'sum by (cluster, namespace, ip, target_kind, target_name) (\n'
        '  count_over_time(\n'
        '    ( max by (cluster, namespace, ip, target_kind, target_name) (\n'
        '        kube_customresource_external_ip_info{cluster=~"$cluster", ip="$ip"}\n'
        '    ) )[$window:$step]\n'
        '  )\n'
        ')'
    )],
    {"h": 9, "w": 24, "x": 0, "y": 49},
    desc="Rows where 'Connected To (Kind)' is empty are the periods the IP sat unused. 'Buckets Present' × $step ≈ how long that binding lasted.",
    organize={
        "excludeByName": {"Time": True, "__name__": True},
        "includeByName": {},
        "indexByName": {"cluster": 0, "namespace": 1, "ip": 2, "target_kind": 3, "target_name": 4, "Value": 5},
        "renameByName": {
            "cluster": "Cluster",
            "namespace": "Namespace (Workspace)",
            "ip": "IP",
            "target_kind": "Connected To (Kind)",
            "target_name": "Connected To (Name)",
            "Value": "Buckets Present",
        },
    },
    sort_by="Buckets Present",
))

# ---- Row 5: reference / sanity ------------------------------------------
panels.append(row(500, "⑤ Reference & sanity checks", 58))

panels.append({
    "id": 13,
    "type": "timeseries",
    "title": "Data availability — how far back can this analysis go?",
    "description": "Set the time picker to 1y. Where this line starts is the real retention limit of the datasource; $window can never be longer than that. Check this BEFORE trusting a 90d/365d number.",
    "datasource": DS,
    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 59},
    "targets": [target(
        'count(kube_customresource_external_ip_info{cluster=~"$cluster"})',
        instant=False,
        legend="series present",
    )],
    "options": {
        "legend": {"calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": True},
        "tooltip": {"mode": "single", "sort": "none"},
    },
    "fieldConfig": {
        "defaults": {
            "unit": "none",
            "custom": {"drawStyle": "line", "lineWidth": 1, "fillOpacity": 10, "showPoints": "never", "spanNulls": False},
            "color": {"mode": "palette-classic"},
            "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]},
        },
        "overrides": [],
    },
})

panels.append(table(
    14, "Workspace lookup (namespace → workspace UUID → internal flag)",
    [target(
        'max by (cluster, namespace, label_bepa_cafebazaar_cloud_cloud_workspace_uuid,\n'
        '        label_bepa_cafebazaar_cloud_internal,\n'
        '        label_bepa_cafebazaar_cloud_workspace_suspended) (\n'
        '  kube_namespace_labels{cluster=~"$cluster", namespace=~"$ns_filter"}\n'
        ')'
    )],
    {"h": 8, "w": 12, "x": 12, "y": 59},
    desc="Kept as a separate lookup instead of joining onto the tables above on purpose: this join only resolves namespaces that still EXIST right now, so joining it in would silently drop every IP whose old workspace has since been deleted — exactly the rows this analysis is about.",
    organize={
        "excludeByName": {"Time": True, "__name__": True, "Value": True},
        "includeByName": {},
        "indexByName": {"cluster": 0, "namespace": 1},
        "renameByName": {
            "cluster": "Cluster",
            "namespace": "Namespace",
            "label_bepa_cafebazaar_cloud_cloud_workspace_uuid": "Workspace UUID",
            "label_bepa_cafebazaar_cloud_internal": "Is Internal",
            "label_bepa_cafebazaar_cloud_workspace_suspended": "Suspended",
        },
    },
    sort_by="Namespace",
))

panels.append({
    "id": 15,
    "type": "text",
    "title": "How to read this dashboard / method & caveats",
    "gridPos": {"h": 15, "w": 24, "x": 0, "y": 67},
    "options": {
        "mode": "markdown",
        "content": (
            "### The question\n"
            "*Over time, how many resources of a workspace has one IP been attached to?* "
            "If an IP was attached to **more than one** resource, it was **reserved and re-used**. "
            "Separately, one IP may appear in **two workspaces** (customer A releases it, customer B buys it).\n\n"
            "### How it is computed\n"
            "`kube_customresource_external_ip_info` is an info-metric: one series per "
            "`(cluster, namespace, ip, name, gateway, target_kind, target_name)`, value `1`, "
            "and `target_kind=\"\"` means *unattached*.\n\n"
            "1. **Collapse first.** `max by (cluster, namespace, ip, target_kind, target_name)(...)` strips "
            "kube-state-metrics plumbing labels (`instance`, `pod`, `job`, …) plus `name`/`gateway`. "
            "**Skipping this step is the #1 way to get wrong numbers** — a KSM pod restart mints new series "
            "and inflates every count.\n"
            "2. **Count distinct over time.** `count by (...)(count_over_time( (<collapsed>)[$window:$step] ))` — "
            "`count_over_time` emits one series per distinct binding, so counting those series *is* a COUNT DISTINCT.\n"
            "3. **Reject fan-out.** `max_over_time(count by (cluster,namespace,ip)(<collapsed>)[$window:$step]) == 1` "
            "keeps only IPs that never had two live targets at once, so `distinct > 1` really means *sequential* re-use.\n\n"
            "### Caveats — read before quoting a number\n"
            "- **`$step` is the sampling resolution.** Any attachment shorter than `$step` can be missed entirely, "
            "so results are a **lower bound**. Cross-check a suspicious IP at `$step=5m` in panel ④.\n"
            "- **'Buckets Present' over-counts by up to one bucket per transition.** Prometheus still considers a "
            "sample current for `lookbackDelta` (5m by default), so at a hand-over the old and the new binding are "
            "both visible in the same bucket. Read that column as an estimate, ±1 bucket per transition. "
            "The distinct counts everything else rests on are **not** affected.\n"
            "- **`$window` cannot exceed datasource retention.** Verify with the *Data availability* panel first.\n"
            "- **Cost.** These are subqueries: `[$window:$step]` runs the inner query `$window/$step` times. "
            "`30d:1h` = 720 evaluations; `365d:5m` will time out. Start at `7d:1h`, widen once it returns. "
            "For anything routine, use the recording rule in `recording-rules.yaml` — it removes the subquery "
            "entirely and makes a 1y lookback cheap.\n"
            "- **Delete + recreate under the same name undercounts.** A Service deleted and recreated with the "
            "identical `target_name` is one distinct value, not two, so real re-use is slightly under-reported.\n"
            "- **`compute-reserve` is excluded everywhere** as the free/unallocated pool. If that is not what it "
            "means, change the `namespace!=\"compute-reserve\"` matcher.\n"
            "- **Namespace is treated as the workspace.** The workspace UUID is embedded in the namespace name; "
            "panel ⑤ maps it explicitly.\n"
        ),
    },
    "datasource": DS,
    "transparent": False,
})


# --------------------------------------------------------------------------
# Variables
# --------------------------------------------------------------------------

templating = {
    "list": [
        {
            "name": "datasource",
            "type": "datasource",
            "label": "Datasource",
            "query": "prometheus",
            "current": {"text": "engine-vm-thr1", "value": DEFAULT_DS_UID},
            "refresh": 1,
            "hide": 0,
            "multi": False,
            "includeAll": False,
            "options": [],
        },
        {
            "name": "cluster",
            "type": "query",
            "label": "Cluster",
            "datasource": DS,
            "definition": "label_values(kube_node_info,cluster)",
            "query": {"qryType": 1, "query": "label_values(kube_node_info,cluster)", "refId": "PrometheusVariableQueryEditor-VariableQuery"},
            "current": {"text": "engine-thr1", "value": "engine-thr1"},
            "refresh": 1,
            "sort": 1,
            "hide": 0,
            "multi": True,
            "includeAll": True,
            "allValue": ".*",
            "options": [],
            "allowCustomValue": True,
        },
        {
            "name": "window",
            "type": "custom",
            "label": "Lookback window",
            "description": "How far back to look for re-use. Cannot exceed datasource retention.",
            "query": "1h,6h,24h,2d,7d,14d,30d,60d,90d,180d,365d",
            "current": {"text": "30d", "value": "30d"},
            "options": [
                {"text": t, "value": t, "selected": t == "30d"}
                for t in ["1h", "6h", "24h", "2d", "7d", "14d", "30d", "60d", "90d", "180d", "365d"]
            ],
            "hide": 0,
            "multi": False,
            "includeAll": False,
            "allowCustomValue": True,
        },
        {
            "name": "step",
            "type": "custom",
            "label": "Resolution",
            "description": "Subquery step. Smaller = catches shorter attachments but much more expensive. window/step evaluations are performed.",
            "query": "5m,10m,30m,1h,3h,6h,12h,24h",
            "current": {"text": "1h", "value": "1h"},
            "options": [
                {"text": t, "value": t, "selected": t == "1h"}
                for t in ["5m", "10m", "30m", "1h", "3h", "6h", "12h", "24h"]
            ],
            "hide": 0,
            "multi": False,
            "includeAll": False,
            "allowCustomValue": True,
        },
        {
            "name": "ns_filter",
            "type": "textbox",
            "label": "Namespace regex",
            "description": "Narrow the analysis to a subset of workspaces. Default .* = all.",
            "query": ".*",
            "current": {"text": ".*", "value": ".*"},
            "options": [],
            "hide": 0,
        },
        {
            "name": "ip",
            "type": "query",
            "label": "IP (drill-down)",
            "datasource": DS,
            "definition": 'label_values(kube_customresource_external_ip_info{cluster=~"$cluster"},ip)',
            "query": {"qryType": 1, "query": 'label_values(kube_customresource_external_ip_info{cluster=~"$cluster"},ip)', "refId": "PrometheusVariableQueryEditor-VariableQuery"},
            "current": {"text": "87.247.175.99", "value": "87.247.175.99"},
            "refresh": 1,
            "sort": 1,
            "hide": 0,
            "multi": False,
            "includeAll": False,
            "options": [],
            "allowCustomValue": True,
        },
    ]
}


dashboard = {
    "title": "External IP Re-use & Workspace Connections",
    "description": "Over time, how many resources of a workspace has each external IP been attached to, and has the same IP moved between workspaces.",
    "tags": ["engine", "externalip", "capacity"],
    "timezone": "browser",
    "editable": True,
    "graphTooltip": 0,
    "schemaVersion": 39,
    "refresh": "",
    "time": {"from": "now-30d", "to": "now"},
    "timepicker": {},
    "panels": panels,
    "templating": templating,
    "annotations": {"list": []},
    "links": [],
    "preload": False,
    "weekStart": "",
}

if __name__ == "__main__":
    print(json.dumps(dashboard, indent=2, ensure_ascii=False))
