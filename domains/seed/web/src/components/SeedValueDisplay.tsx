import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function SeedValueDisplay({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (copied) return; // Prevent multiple copies while the copied state is true
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy seed value:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={cn(
        "group flex min-w-0 flex-col gap-1 rounded-md text-left transition-colors",
        "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        "-mx-2 -my-1 px-2 py-1",
        className
      )}
      title="Click to copy"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-xs">{value}</span>
        <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
          <Copy
            className={cn(
              "absolute h-3 w-3 text-muted-foreground",
              copied ? "opacity-0" : "opacity-0 group-hover:opacity-100"
            )}
          />
          <Check
            className={cn(
              "absolute h-3 w-3 text-green-500 opacity-0",
              copied && "opacity-100"
            )}
          />
        </span>
      </span>
    </button>
  );
}
