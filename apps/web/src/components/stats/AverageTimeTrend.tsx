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
import { formatRunTime } from "@/lib/format";
import { movementLabel } from "@/lib/movement";
import type { WeeklyPerformance } from "./stats-utils";

registerECharts([
  LineChart,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
]);

function cssColor(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

type AverageWeek = WeeklyPerformance & { averageTimeMs: number };

function buildOption(weeks: AverageWeek[]): EChartsCoreOption {
  const primary = cssColor("--color-primary");
  const border = cssColor("--color-border");
  const muted = cssColor("--color-muted");
  const deep = cssColor("--color-background-deep");
  const font = "Minecraft, sans-serif";

  return {
    animationDuration: 350,
    aria: {
      enabled: true,
      description:
        "Line chart showing the player's average completion time for each recorded week.",
    },
    grid: { top: 12, right: 12, bottom: 32, left: 56 },
    tooltip: {
      trigger: "axis",
      triggerOn: "mousemove|click",
      axisPointer: { lineStyle: { color: muted, opacity: 0.4, width: 1 } },
      // The frame comes from the formatter's own markup.
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      extraCssText: "box-shadow:none;border-radius:0",
      formatter: ([point]: { dataIndex: number }[]) => {
        const week = point && weeks[point.dataIndex];
        if (!week) return "";

        return `<div class="hover-card px-3 py-2 text-sm leading-snug text-foreground">
          <div class="font-bold">Week ${week.weekNumber} · League ${week.leagueNumber}</div>
          <div class="mt-1 font-minecraft text-lg pixel-shadow">${formatRunTime(week.averageTimeMs)}</div>
          <div class="text-muted">${week.matches} matches · ${week.totalPoints} points · ${movementLabel(week.movement)}</div>
        </div>`;
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: weeks.map((week) => `W${week.weekNumber}`),
      axisLine: { lineStyle: { color: border, width: 2 } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontFamily: font, fontSize: 12 },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: muted,
        fontFamily: font,
        fontSize: 12,
        formatter: (value: number) =>
          formatRunTime(value, { hundredths: false }),
      },
      splitLine: { lineStyle: { color: border, opacity: 0.6 } },
    },
    series: [
      {
        name: "Average time",
        type: "line",
        data: weeks.map((week) => week.averageTimeMs),
        // Square points, to match the site's blocky shapes.
        symbol: "rect",
        symbolSize: 8,
        lineStyle: { color: primary, width: 2 },
        itemStyle: { color: primary, borderColor: deep, borderWidth: 2 },
        emphasis: { disabled: true },
      },
    ],
  };
}

export function AverageTimeTrend({ weeks }: { weeks: WeeklyPerformance[] }) {
  const chartElementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const averageWeeks = useMemo(
    () =>
      weeks.filter((week): week is AverageWeek => week.averageTimeMs !== null),
    [weeks]
  );
  const hasAverageData = averageWeeks.length > 0;

  useEffect(() => {
    const element = chartElementRef.current;
    if (!element || !hasAverageData) return;

    const chart = init(element);
    const observer = new ResizeObserver(() => chart.resize());
    chartRef.current = chart;
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [hasAverageData]);

  // Runs after the chart is created above, and again when the weeks change.
  useEffect(() => {
    chartRef.current?.setOption(buildOption(averageWeeks), { notMerge: true });
  }, [averageWeeks]);

  return (
    <section aria-labelledby="average-time-heading">
      <h2 id="average-time-heading" className="text-pixel-md md:text-pixel-lg">
        Average time
      </h2>
      {!hasAverageData ? (
        <p className="mt-4 text-muted">
          Weekly averages show up once this player finishes a week.
        </p>
      ) : (
        <div ref={chartElementRef} className="mt-4 h-72 w-full" role="img" />
      )}
    </section>
  );
}
