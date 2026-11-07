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

function cssColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

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
    const lava = cssColor("--color-lava", "#f05a1a");
    const line = cssColor("--color-obsidian-line", "#3a2d4c");
    const muted = cssColor("--color-muted", "#b8aec4");
    const deep = cssColor("--color-obsidian-deep", "#120c1a");
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
        axisPointer: {
          type: "line",
          lineStyle: { color: muted, opacity: 0.4, width: 1 },
        },
        // The frame comes from the formatter's own markup.
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        extraCssText: "box-shadow:none;border-radius:0",
        formatter: (rawParams: unknown) => {
          const params: unknown = Array.isArray(rawParams)
            ? rawParams[0]
            : rawParams;
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

          return `<div class="mc-tooltip px-3 py-2 text-sm leading-snug text-foreground">
            <div class="font-bold">Week ${week.weekNumber} · League ${week.leagueNumber}</div>
            <div class="mt-1 font-minecraft text-lg font-bold">${formatRunTime(week.averageTimeMs)}</div>
            <div class="text-muted">${week.matches} matches · ${week.totalPoints} points · ${movementLabel(week.movement)}</div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: averageWeeks.map((week) => `W${week.weekNumber}`),
        axisLine: { lineStyle: { color: line, width: 3 } },
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
        splitLine: { lineStyle: { color: line, opacity: 0.6 } },
      },
      series: [
        {
          name: "Average time",
          type: "line",
          data: averageWeeks.map((week) => week.averageTimeMs),
          connectNulls: false,
          showSymbol: true,
          // Square points, to match the site's blocky shapes.
          symbol: "rect",
          symbolSize: 9,
          lineStyle: { color: lava, width: 3 },
          itemStyle: { color: lava, borderColor: deep, borderWidth: 2 },
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
      <h2
        id="average-time-heading"
        className="text-3xl leading-none font-bold md:text-4xl"
      >
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
