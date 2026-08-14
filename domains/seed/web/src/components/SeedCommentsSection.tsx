import { useMutation, useQuery } from "convex/react";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SendHorizonal } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAX_SEED_COMMENT_BODY_LENGTH } from "../../../convex/lib/consts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FieldError } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const COMMENT_GROUP_WINDOW_MS = 3 * 60 * 1000;
const MAX_COMMENT_GROUP_SIZE = 6;

type SeedComment = {
  _id: Id<"comments">;
  author: Id<"users">;
  body: string;
  createdAt: number;
  authorImage: string | null;
  authorName: string;
};

type CommentGroup = {
  author: Id<"users">;
  authorImage: string | null;
  authorName: string;
  comments: SeedComment[];
};

export function SeedCommentsSection({
  canCreateComments,
  seedId,
  className,
  autoFocus = false,
}: {
  canCreateComments: boolean;
  seedId: Id<"seeds">;
  className?: string;
  autoFocus?: boolean;
}) {
  const comments = useQuery(api.comments.listForSeed, { seedId });
  const createComment = useMutation(api.comments.create);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const shouldRefocusAfterSubmitRef = useRef(false);
  const groupedComments = useMemo(
    () => groupComments((comments ?? []) as SeedComment[]),
    [comments]
  );

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments?.length]);

  useEffect(() => {
    if (!autoFocus || !canCreateComments || !inputRef.current) {
      return;
    }

    inputRef.current.focus();
  }, [autoFocus, canCreateComments, seedId]);

  useEffect(() => {
    if (
      !canCreateComments ||
      isSubmitting ||
      !shouldRefocusAfterSubmitRef.current
    ) {
      return;
    }

    shouldRefocusAfterSubmitRef.current = false;
    inputRef.current?.focus();
  }, [canCreateComments, isSubmitting]);

  const handleSubmit = async () => {
    const trimmedBody = body.trim();

    if (!trimmedBody || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await createComment({ seedId, body: trimmedBody });
      setBody("");
      shouldRefocusAfterSubmitRef.current = true;
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not post comment"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <section
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 py-2">
          {comments === undefined ? (
            <CommentsListSkeleton />
          ) : comments.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No comments yet
            </p>
          ) : (
            groupedComments.map((group) => (
              <CommentGroupMessage
                key={group.comments[0]._id}
                authorImage={group.authorImage}
                authorName={group.authorName}
                comments={group.comments}
              />
            ))
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {canCreateComments ? (
        <div className="sticky bottom-0 z-10 mt-auto w-full">
          {error && <FieldError className="pb-2">{error}</FieldError>}
          <InputGroup className="h-9 shrink-0">
            <InputGroupInput
              aria-label="Write a comment"
              autoFocus={autoFocus}
              disabled={isSubmitting}
              maxLength={MAX_SEED_COMMENT_BODY_LENGTH}
              onChange={(event) => setBody(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              ref={inputRef}
              value={body}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Send comment"
                disabled={isSubmitting || body.trim().length === 0}
                onClick={() => void handleSubmit()}
                type="button"
              >
                <SendHorizonal />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      ) : (
        <div className="sticky bottom-0 z-10 mt-auto w-full">
          <p className="text-xs text-muted-foreground">
            Uploader or host access required to comment.
          </p>
        </div>
      )}
    </section>
  );
}

function CommentGroupMessage({
  authorImage,
  authorName,
  comments,
}: {
  authorImage: string | null;
  authorName: string;
  comments: SeedComment[];
}) {
  const initials = authorName
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex flex-col">
      {comments.map((comment, index) => (
        <div
          key={comment._id}
          className={cn(
            "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2.5 rounded-md hover:bg-muted/50",
            index === 0 ? "pt-1.5 pb-0" : "py-0"
          )}
        >
          {index === 0 ? (
            <Avatar className="mt-0.5 w-full shrink-0">
              {authorImage && (
                <AvatarImage src={authorImage} alt={authorName} />
              )}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          ) : (
            <div aria-hidden className="w-8 shrink-0" />
          )}
          <div className="min-w-0">
            {index === 0 && (
              <div className="flex items-baseline gap-2 leading-none">
                <span className="truncate text-sm font-medium">
                  {authorName}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatRelativeTime(comment.createdAt)}
                </span>
              </div>
            )}
            <p className="text-sm leading-snug wrap-break-word whitespace-pre-wrap text-foreground">
              {comment.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentsListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex gap-2.5">
          <Skeleton className="size-6 rounded-full" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatRelativeTime(timestamp: number) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(
    timestamp
  );
}

function groupComments(comments: SeedComment[]) {
  const groups: CommentGroup[] = [];

  for (const comment of comments) {
    const lastGroup = groups.length > 0 ? groups[groups.length - 1] : undefined;
    const lastComment =
      lastGroup && lastGroup.comments.length > 0
        ? lastGroup.comments[lastGroup.comments.length - 1]
        : undefined;

    if (
      lastGroup &&
      lastComment &&
      lastGroup.author === comment.author &&
      comment.createdAt - lastComment.createdAt <= COMMENT_GROUP_WINDOW_MS &&
      lastGroup.comments.length < MAX_COMMENT_GROUP_SIZE
    ) {
      lastGroup.comments.push(comment);
      continue;
    }

    groups.push({
      author: comment.author,
      authorImage: comment.authorImage,
      authorName: comment.authorName,
      comments: [comment],
    });
  }

  return groups;
}
