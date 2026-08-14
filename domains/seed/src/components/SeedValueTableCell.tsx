import { TableCell } from "@/components/ui/table";

export function SeedValueTableCell({ value }: { value: string }) {
  return (
    <TableCell className="max-w-48 truncate border-r font-mono text-muted-foreground">
      {value}
    </TableCell>
  );
}
