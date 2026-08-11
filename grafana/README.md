# External IP Re-use & Workspace Connections

Answers two questions about `kube_customresource_external_ip_info`:

1. **Over time, how many resources of a workspace has one IP been attached to?**
   More than one ⇒ the IP was **reserved and re-used**.
2. **Has the same IP appeared in more than one workspace?**
   ⇒ customer A released it, customer B later bought it.

## Files

| File | What it is |
|---|---|
| `external-ip-reuse-dashboard.json` | Import this into Grafana. Classic v1 schema, so Grafana migrates it on import regardless of the v2 schema toggle. |
| `build_dashboard.py` | Generates the JSON. Edit here, not in the JSON — the same PromQL fragments repeat across ~10 panels. |
| `recording-rules.yaml` | Optional but strongly recommended for anything past ~30 days. |
| `promql-tests/` | Go tests that run every dashboard query against the real Prometheus engine with synthetic data. |

## Import

Grafana → Dashboards → New → Import → upload `external-ip-reuse-dashboard.json`.
The `$datasource` variable defaults to the `engine-vm-thr1` UID
(`b6273083-9ae2-405c-a518-bb13a2d1a92e`) taken from the existing
*Cluster Unused ExternalIPs Cleanup* dashboard; change it in the picker if needed.

Start at **`window=7d`, `step=1h`**. Widen only once queries return comfortably.

## The method

`kube_customresource_external_ip_info` is an info-metric: one series per
`(cluster, namespace, ip, name, gateway, target_kind, target_name)` with value `1`.
`target_kind=""` means the IP is **not** attached to anything — that is exactly
the convention the existing cleanup dashboard relies on.

**Step 1 — collapse first.**

```promql
max by (cluster, namespace, ip, target_kind, target_name) (kube_customresource_external_ip_info{...})
```

The raw metric also carries kube-state-metrics plumbing labels (`instance`,
`pod`, `job`, `endpoint`, …) plus `name` and `gateway`. Skipping this step is
**the** way to get wrong answers: a KSM pod restart mints a brand new series and
inflates every count. `promql-tests/eval_test.go:TestInnerCollapseIsRequired`
pins this — the same fixture reports `1` with the collapse and `2` without it.

**Step 2 — count distinct over time.**

```promql
count by (cluster, namespace, ip) (
  count_over_time( ( <collapsed> )[$window:$step] )
)
```

`count_over_time` emits one output series per distinct binding, so counting
those series *is* a `COUNT DISTINCT`. Value > 1 ⇒ the IP was attached to more
than one resource during the window.

**Step 3 — reject fan-out.**

```promql
max_over_time( ( count by (cluster, namespace, ip) (<collapsed>) )[$window:$step] ) == 1
```

`AND`-ing this against step 2 keeps only IPs that never had two live targets at
the same instant, so `distinct > 1` genuinely means *sequential* re-use rather
than one IP serving several resources simultaneously.

**Watch the outer aggregator.** `count by (...)` is correct only when it is
**coarser** than the inner `max by (...)` — that is what makes it a count of
distinct values. Where the panel wants the number of buckets a binding was
present for, the outer aggregator must be `sum by (...)`; `count by (...)` at
the same granularity as the inner grouping returns a constant `1`.

## Caveats

- **`$step` is the sampling resolution.** An attachment shorter than `$step` can
  be missed entirely, so every number is a **lower bound**. Cross-check a
  suspicious IP at `$step=5m` in the drill-down row.
- **`$window` cannot exceed datasource retention.** The *Data availability*
  panel shows the real limit — check it before quoting a 90d or 365d figure.
- **Cost.** `[$window:$step]` re-evaluates the inner query `$window/$step` times.
  `30d:1h` = 720 evaluations; `365d:5m` will time out. Use the recording rules
  for anything routine.
- **"Buckets Present" is ±1 bucket per transition.** Prometheus treats a sample
  as current for `lookbackDelta` (5m by default), so at a hand-over the old and
  new binding both appear in the same bucket.
  `promql-tests/lookback_test.go` demonstrates this: the same fixture yields
  `5/3/6` at a 5m lookback and `4/2/6` at 1m. **Distinct counts are unaffected**
  — only the dwell-time column.
- **Delete + recreate under the same name undercounts.** A Service deleted and
  recreated with an identical `target_name` is one distinct value, not two.
- **`compute-reserve` is excluded everywhere** on the assumption that it is the
  free/unallocated pool. Change the `namespace!="compute-reserve"` matcher if
  that is wrong — it is the one assumption here taken from dashboard context
  rather than confirmed.
- **Namespace is treated as the workspace.** The workspace UUID is embedded in
  the namespace name; the *Workspace lookup* panel maps it explicitly. That
  lookup is deliberately **not** joined onto the main tables: `kube_namespace_labels`
  only resolves namespaces that still exist, so joining it would silently drop
  every IP whose old workspace has since been deleted — exactly the rows this
  analysis is about.

## Tests

```
cd promql-tests && go test -v
```

Loads a synthetic fixture into a real Prometheus TSDB and asserts the exact
output of **every** query in the dashboard JSON. The fixture covers: sequential
re-use, a KSM restart that must *not* look like re-use, simultaneous fan-out
that must be excluded from the strict count, an IP moving between workspaces via
`compute-reserve`, and IPs that must not appear at all. A panel with no
expectation fails the test, so queries and expectations cannot drift apart.
