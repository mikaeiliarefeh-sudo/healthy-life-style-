package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/prometheus/promql/promqltest"
)

const dashboardPath = "../external-ip-reuse-dashboard.json"

type dash struct {
	Panels []struct {
		Title   string `json:"title"`
		Targets []struct {
			Expr string `json:"expr"`
		} `json:"targets"`
	} `json:"panels"`
}

func TestDashboardQueries(t *testing.T) {
	raw, err := os.ReadFile(dashboardPath)
	if err != nil {
		t.Fatal(err)
	}
	var d dash
	if err := json.Unmarshal(raw, &d); err != nil {
		t.Fatal(err)
	}

	expRaw, err := os.ReadFile("expectations.json")
	if err != nil {
		t.Fatal(err)
	}
	var want map[string][]string
	if err := json.Unmarshal(expRaw, &want); err != nil {
		t.Fatal(err)
	}

	fixture, err := os.ReadFile("fixture.txt")
	if err != nil {
		t.Fatal(err)
	}
	storage := promqltest.LoadedStorage(t, string(fixture))
	defer storage.Close()
	engine := promqltest.NewTestEngine(false, 0, 50000000)

	// $window/$step are deliberately small so the fixture stays readable;
	// the arithmetic is identical at 30d/1h.
	repl := strings.NewReplacer(
		"$window", "60m",
		"$step", "5m",
		"$cluster", "c1",
		"$ns_filter", ".*",
		"$ip", "10.0.0.1",
	)
	evalTS := time.Unix(0, 0).UTC().Add(55 * time.Minute)

	seen := map[string]bool{}
	for _, p := range d.Panels {
		for _, tg := range p.Targets {
			exp, ok := want[p.Title]
			if !ok {
				t.Errorf("panel %q has a query but no expectation - add one", p.Title)
				continue
			}
			seen[p.Title] = true

			q, err := engine.NewInstantQuery(context.Background(), storage, nil, repl.Replace(tg.Expr), evalTS)
			if err != nil {
				t.Errorf("%s: %v", p.Title, err)
				continue
			}
			res := q.Exec(context.Background())
			if res.Err != nil {
				t.Errorf("%s: %v", p.Title, res.Err)
				q.Close()
				continue
			}
			v, _ := res.Vector()
			got := []string{}
			for _, s := range v {
				got = append(got, fmt.Sprintf("%s %g", s.Metric.String(), s.F))
			}
			sort.Strings(got)
			sort.Strings(exp)
			if !reflect.DeepEqual(got, exp) {
				t.Errorf("%s\n  want: %s\n  got:  %s", p.Title,
					strings.Join(exp, "\n        "), strings.Join(got, "\n        "))
			} else {
				t.Logf("ok  %s", p.Title)
			}
			q.Close()
		}
	}
	for title := range want {
		if !seen[title] {
			t.Errorf("expectation %q matched no panel", title)
		}
	}
}

// The inner `max by (...)` that strips kube-state-metrics plumbing labels is
// the single most important line in these queries. This test pins that: IP
// 10.0.0.2 keeps one target across a KSM restart, so the answer must be 1.
// Without the collapse the same data reports 2 and every re-use number inflates.
func TestInnerCollapseIsRequired(t *testing.T) {
	fixture, _ := os.ReadFile("fixture.txt")
	storage := promqltest.LoadedStorage(t, string(fixture))
	defer storage.Close()
	engine := promqltest.NewTestEngine(false, 0, 50000000)
	ts := time.Unix(0, 0).UTC().Add(55 * time.Minute)

	sel := `kube_customresource_external_ip_info{ip="10.0.0.2", target_kind!=""}`
	cases := []struct {
		name string
		expr string
		want float64
	}{
		{"with collapse (correct)",
			`count by (cluster, namespace, ip) (count_over_time((max by (cluster, namespace, ip, target_kind, target_name) (` + sel + `))[60m:5m]))`, 1},
		{"without collapse (the trap)",
			`count by (cluster, namespace, ip) (count_over_time(` + sel + `[60m]))`, 2},
	}
	for _, c := range cases {
		q, err := engine.NewInstantQuery(context.Background(), storage, nil, c.expr, ts)
		if err != nil {
			t.Fatal(err)
		}
		v, _ := q.Exec(context.Background()).Vector()
		if len(v) != 1 || v[0].F != c.want {
			t.Errorf("%s: want %v, got %v", c.name, c.want, v)
		} else {
			t.Logf("ok  %s => %g", c.name, v[0].F)
		}
		q.Close()
	}
}
