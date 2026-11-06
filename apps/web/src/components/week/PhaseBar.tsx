import { useState } from "react";
import { formatRunTime } from "@/lib/format";
import { phaseNames, type Phase, type PhaseBlock } from "@/lib/matchTimeline";

const PHASE_COLORS: Record<Phase, string> = {
  overworld: "#55ff55",
  nether: "#ff5555",
  bastion: "#8d8798",
  fortress: "#b54343",
  blind: "#7755ee",
  stronghold: "#77aa88",
  end: "#e2e2aa",
  complete: "#e2e2aa",
};

export function PhaseBar({
  blocks,
  scale,
}: {
  blocks: PhaseBlock[];
  scale: number;
}) {
  const [hovered, setHovered] = useState<{
    block: PhaseBlock;
    x: number;
    y: number;
    // Near the right edge the tooltip opens to the cursor's left.
    flip: boolean;
  } | null>(null);

  return (
    <span className="flex h-3 items-stretch">
      {blocks.map((block, index) => (
        // A 2px clear edge separates the phases without changing how long
        // each one looks.
        <span
          key={`${block.phase}-${index}`}
          role="img"
          aria-label={`${phaseNames[block.phase]} ${formatRunTime(block.duration)}`}
          onPointerMove={(event) =>
            setHovered({
              block,
              x: event.clientX,
              y: event.clientY,
              flip: event.clientX > window.innerWidth - 240,
            })
          }
          onPointerLeave={() => setHovered(null)}
          className="relative h-full bg-clip-content pr-0.5 transition-transform duration-150 hover:z-10 hover:scale-y-[1.5]"
          style={{
            width: `${(block.duration / scale) * 100}%`,
            backgroundColor: PHASE_COLORS[block.phase],
          }}
        />
      ))}

      {/* Fixed to the screen, so a scrolling column can't cut it off. It sits
          below the cursor so the run's time above stays visible. */}
      {hovered && (
        <span
          className="mc-tooltip pointer-events-none fixed z-50 flex items-center gap-2 px-2.5 py-1 text-sm whitespace-nowrap"
          style={{
            left: hovered.x,
            top: hovered.y + 20,
            transform: hovered.flip ? "translateX(-100%)" : undefined,
          }}
        >
          <span
            className="size-2.5"
            style={{ backgroundColor: PHASE_COLORS[hovered.block.phase] }}
          />
          <span className="font-semibold">
            {phaseNames[hovered.block.phase]}
          </span>
          <span className="font-minecraft text-home-muted tabular-nums">
            {formatRunTime(hovered.block.duration)} at{" "}
            {formatRunTime(hovered.block.startTime)}
          </span>
        </span>
      )}
    </span>
  );
}
