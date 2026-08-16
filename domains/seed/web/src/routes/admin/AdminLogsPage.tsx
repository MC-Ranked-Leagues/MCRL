import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, FileClock, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LOG_ACTOR_FILTER_ITEMS,
  LOG_ACTOR_LABELS,
  LOG_DATE_FORMATTER,
  LOG_EVENT_CONFIG,
  LOG_EVENT_FILTER_ITEMS,
  LOG_PAGE_SIZE,
  LOG_TIME_FORMATTER,
  type ActorFilter,
  type EventFilter,
} from "@/lib/logPresentation";

export function AdminLogsPage() {
  const [view, setView] = useState<{
    eventType: EventFilter;
    actorType: ActorFilter;
    cursors: Array<string | null>;
  }>({
    eventType: "all",
    actorType: "all",
    cursors: [null],
  });
  const cursor = view.cursors[view.cursors.length - 1] ?? null;
  const logsPage = useQuery(api.logs.list, {
    paginationOpts: { numItems: LOG_PAGE_SIZE, cursor },
    ...(view.eventType === "all" ? {} : { eventType: view.eventType }),
    ...(view.actorType === "all" ? {} : { actorType: view.actorType }),
  });
  const hasFilters = view.eventType !== "all" || view.actorType !== "all";
  const pageNumber = view.cursors.length;

  const resetFilters = () => {
    setView({ eventType: "all", actorType: "all", cursors: [null] });
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="mt-2 text-2xl font-semibold">Activity logs</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This page is a work in progress while we collect enough data to finish
          testing, so some logs may have bugs or issues.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-end gap-3 lg:flex-row">
          <FieldGroup className="grid flex-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="log-event-filter">Event type</FieldLabel>
              <Select
                items={LOG_EVENT_FILTER_ITEMS}
                onValueChange={(value) => {
                  setView((current) => ({
                    ...current,
                    eventType: value ?? "all",
                    cursors: [null],
                  }));
                }}
                value={view.eventType}
              >
                <SelectTrigger className="w-full" id="log-event-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {LOG_EVENT_FILTER_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="log-actor-filter">User type</FieldLabel>
              <Select
                items={LOG_ACTOR_FILTER_ITEMS}
                onValueChange={(value) => {
                  setView((current) => ({
                    ...current,
                    actorType: value ?? "all",
                    cursors: [null],
                  }));
                }}
                value={view.actorType}
              >
                <SelectTrigger className="w-full" id="log-actor-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {LOG_ACTOR_FILTER_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <Button
            disabled={!hasFilters}
            onClick={resetFilters}
            type="button"
            variant="outline"
          >
            <RotateCcw data-icon="inline-start" />
            Clear filters
          </Button>
        </div>

        {logsPage === undefined ? (
          <Table
            className="min-w-5xl table-fixed"
            containerClassName="max-h-[calc(100svh-19rem)] rounded-md border"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">When</TableHead>
                <TableHead className="w-44">Event</TableHead>
                <TableHead className="w-52">Actor</TableHead>
                <TableHead className="w-64">Target</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 7 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-8 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full max-w-80" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : logsPage.page.length === 0 ? (
          <Empty className="min-h-80">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileClock />
              </EmptyMedia>
              <EmptyTitle>
                {hasFilters ? "No matching activity" : "No activity yet"}
              </EmptyTitle>
              <EmptyDescription>
                {hasFilters
                  ? "Try a different event or user type."
                  : "Important changes will appear here as they happen."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table
            className="min-w-5xl table-fixed"
            containerClassName="max-h-[calc(100svh-19rem)] rounded-md border"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">When</TableHead>
                <TableHead className="w-44">Event</TableHead>
                <TableHead className="w-52">Actor</TableHead>
                <TableHead className="w-64">Target</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsPage.page.map((log) => {
                const event = LOG_EVENT_CONFIG[log.eventType];
                const EventIcon = event.icon;
                const targetHref =
                  log.targetId &&
                  log.targetType === "seed" &&
                  log.eventType !== "seed.deleted"
                    ? `/app/admin/seeds/${log.targetId}`
                    : log.targetId && log.targetType === "league"
                      ? `/app/league/${log.targetId}`
                      : null;

                return (
                  <TableRow key={log._id}>
                    <TableCell className="overflow-hidden">
                      <time
                        className="block truncate"
                        dateTime={new Date(log._creationTime).toISOString()}
                      >
                        {LOG_DATE_FORMATTER.format(log._creationTime)} at{" "}
                        {LOG_TIME_FORMATTER.format(log._creationTime)}
                      </time>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <div className="flex min-w-0 items-center gap-2">
                        <EventIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{event.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <Tooltip>
                        <TooltipTrigger
                          render={<span className="block truncate" />}
                        >
                          <span className="font-medium">{log.actorName}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            - {LOG_ACTOR_LABELS[log.actorType]}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {log.actorName} - {LOG_ACTOR_LABELS[log.actorType]}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            targetHref ? (
                              <Link
                                className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                                to={targetHref}
                              />
                            ) : (
                              <span className="block truncate font-medium" />
                            )
                          }
                        >
                          {log.targetLabel}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm flex-col items-start">
                          <span>{log.targetLabel}</span>
                          {log.targetId && <span>ID: {log.targetId}</span>}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="block truncate text-muted-foreground" />
                          }
                        >
                          {log.summary}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md whitespace-normal">
                          {log.summary}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {pageNumber} - Up to {LOG_PAGE_SIZE} entries per page
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <Button
                  disabled={view.cursors.length === 1}
                  onClick={() => {
                    setView((current) => ({
                      ...current,
                      cursors: current.cursors.slice(0, -1),
                    }));
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft data-icon="inline-start" />
                  Previous
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  disabled={logsPage === undefined || logsPage.isDone}
                  onClick={() => {
                    if (!logsPage || logsPage.isDone) return;

                    setView((current) => ({
                      ...current,
                      cursors: [...current.cursors, logsPage.continueCursor],
                    }));
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Next
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </section>
  );
}
