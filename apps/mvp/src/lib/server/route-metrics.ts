type MetricLevel = "info" | "warn" | "error";

type RouteMetric = {
  metric: string;
  route: string;
  level?: MetricLevel;
  value?: number;
  tags?: Record<string, string | number | boolean>;
};

export function emitRouteMetric({
  metric,
  route,
  level = "info",
  value = 1,
  tags = {},
}: RouteMetric): void {
  const payload = {
    type: "route_metric",
    metric,
    route,
    value,
    tags,
    ts: new Date().toISOString(),
  };

  const line = `[RouteMetric] ${JSON.stringify(payload)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
