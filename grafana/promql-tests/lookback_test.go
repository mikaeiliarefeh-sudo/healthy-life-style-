package main

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/prometheus/prometheus/promql/promqltest"
)

// Why "Buckets Present" is 5 and not 4 for a binding that had 4 samples:
// a sample exactly `lookbackDelta` old is still considered current, so at the
// transition boundary the OLD binding and the NEW binding are both visible in
// the same subquery bucket. Verified below by shrinking lookbackDelta.
func TestLookbackOverlapAtTransition(t *testing.T) {
	fixture, _ := os.ReadFile("fixture.txt")
	for _, lb := range []time.Duration{5 * time.Minute, 1 * time.Minute} {
		storage := promqltest.LoadedStorage(t, string(fixture))
		engine := promqltest.NewTestEngine(false, lb, 50000000)
		ts := time.Unix(0, 0).UTC().Add(55 * time.Minute)
		expr := `sum by (target_name) (count_over_time((max by (ip, target_kind, target_name) (kube_customresource_external_ip_info{ip="10.0.0.1"}))[60m:5m]))`
		q, _ := engine.NewInstantQuery(context.Background(), storage, nil, expr, ts)
		v, _ := q.Exec(context.Background()).Vector()
		fmt.Printf("lookbackDelta=%-4v ", lb)
		for _, s := range v {
			fmt.Printf("%s=%g  ", s.Metric.String(), s.F)
		}
		fmt.Println()
		q.Close()
		storage.Close()
	}
}
