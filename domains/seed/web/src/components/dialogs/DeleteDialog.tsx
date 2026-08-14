import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "../ui/alert-dialog";

export function DeleteAlert({
  isLoading,
  label,
  onDelete,
}: {
  isLoading: boolean;
  label: string;
  onDelete: () => void;
}) {
  return (
    <AlertDialogContent>
      <AlertDialogTitle>{label}</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the league.
        All connected seeds will become unasigned.
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onDelete}>
          {!isLoading ? "Delete" : "Deleting..."}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
