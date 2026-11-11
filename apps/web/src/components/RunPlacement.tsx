import { ordinal } from "@/lib/format";
import { cn } from "@/lib/utils";

// Where a run finished in its match: its place, DNF or Missed.
export function RunPlacement({
  run,
}: {
  run: { placement: number | null; dnf: boolean; missed: boolean };
}) {
  return (
    <span
      className={cn(
        "font-minecraft text-pixel-sm pixel-shadow",
        run.placement === 1 && "text-gold",
        run.dnf && "text-demoted",
        run.missed && "text-base leading-normal text-muted"
      )}
    >
      {run.missed
        ? "Missed"
        : run.dnf || run.placement === null
          ? "DNF"
          : ordinal(run.placement)}
    </span>
  );
}
