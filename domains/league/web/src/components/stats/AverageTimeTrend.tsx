import { useEffect, useMemo, useRef } from "react";
import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
} from "echarts/components";
import {
  init,
  use as registerECharts,
  type ECharts,
  type EChartsCoreOption,
} from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { ChartLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDuration,
  movementLabel,
  type WeeklyPerformance,
} from "./stats-utils";

registerECharts([
  LineChart,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
]);

function cssColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;

  const value = getComputedStyle(document.body).getPropertyValue(name).trim();

  return value || fallback;
}

export function AverageTimeTrend({ weeks }: { weeks: WeeklyPerformance[] }) {
  const chartElementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const averageWeeks = useMemo(
    () =>
      weeks.filter(
        (week): week is WeeklyPerformance & { averageTimeMs: number } =>
          week.averageTimeMs !== null && week.averageTimeMs !== undefined
      ),
    [weeks]
  );
  const hasAverageData = averageWeeks.length > 0;

  const option = useMemo<EChartsCoreOption>(() => {
    const primary = cssColor("--primary", "#f59e0b");
    const border = cssColor("--border", "#3f3f46");
    const mutedForeground = cssColor("--muted-foreground", "#a1a1aa");
    const popover = cssColor("--popover", "#18181b");
    const popoverForeground = cssColor("--popover-foreground", "#fafafa");

    return {
      animationDuration: 350,
      aria: {
        enabled: true,
        description:
          "Line chart showing the player's average completion time for each recorded week.",
      },
      grid: { top: 18, right: 18, bottom: 38, left: 54 },
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove|click",
        axisPointer: {
          type: "line",
          lineStyle: { color: mutedForeground, opacity: 0.25, width: 1 },
        },
        backgroundColor: popover,
        borderColor: border,
        borderWidth: 1,
        padding: 12,
        textStyle: { color: popoverForeground, fontSize: 12 },
        formatter: (rawParams: unknown) => {
          const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
          if (
            !params ||
            typeof params !== "object" ||
            !("dataIndex" in params) ||
            typeof params.dataIndex !== "number"
          ) {
            return "";
          }

          const week = averageWeeks[params.dataIndex];
          if (!week) return "";

          return [
            `<strong>Week ${week.weekNumber}</strong> &middot; League ${week.leagueNumber}`,
            `<div style="margin-top:6px;color:${primary};font-size:15px;font-weight:700">${formatDuration(week.averageTimeMs)}</div>`,
            `<div style="margin-top:6px;color:${mutedForeground}">${week.matches} matches &middot; ${week.totalPoints} points</div>`,
            `<div style="color:${mutedForeground}">${movementLabel(week.movement)}</div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: averageWeeks.map((week) => `W${week.weekNumber}`),
        axisLine: { lineStyle: { color: border } },
        axisTick: { show: false },
        axisLabel: { color: mutedForeground, fontSize: 10 },
      },
      yAxis: {
        type: "value",
        scale: true,
        splitNumber: 3,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: mutedForeground,
          fontSize: 10,
          formatter: (value: number) => formatDuration(value, false),
        },
        splitLine: {
          lineStyle: { color: border, opacity: 0.08, type: "dashed" },
        },
      },
      series: [
        {
          name: "Average time",
          type: "line",
          data: averageWeeks.map((week) => week.averageTimeMs),
          connectNulls: false,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { color: primary, width: 2 },
          itemStyle: {
            color: primary,
            borderColor: popover,
            borderWidth: 2,
          },
          emphasis: { disabled: true },
        },
      ],
    };
  }, [averageWeeks]);

  useEffect(() => {
    const element = chartElementRef.current;
    if (!element || !hasAverageData) return;

    const chart = init(element, undefined, { renderer: "canvas" });
    const observer = new ResizeObserver(() => chart.resize());
    chartRef.current = chart;
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [hasAverageData]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <section aria-labelledby="average-time-heading">
      <Card>
        <CardHeader>
          <CardTitle
            id="average-time-heading"
            className="font-minecraft text-base tracking-[0.08em] uppercase"
          >
            Average time by week
          </CardTitle>
        </CardHeader>

        <CardContent>
          {!hasAverageData ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <ChartLine
                className="mb-3 size-8 text-muted-foreground/50"
                aria-hidden
              />
              <p className="font-medium">No average-time data</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Weekly averages will appear after this player records a
                completed week.
              </p>
            </div>
          ) : (
            <div
              ref={chartElementRef}
              className="h-70 w-full"
              role="img"
              aria-label="Average completion time by week"
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
