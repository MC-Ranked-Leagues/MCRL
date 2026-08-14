import {
  ArrowRightLeft,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  CircleX,
  MessageSquareText,
  PauseCircle,
  Pencil,
  PlayCircle,
  Settings2,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  UserCheck,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";

export const LOG_PAGE_SIZE = 25;

export type LogEventType = Doc<"logs">["eventType"];
export type LogActorType = Doc<"logs">["actorType"];
export type EventFilter = LogEventType | "all";
export type ActorFilter = LogActorType | "all";

type EventConfig = {
  label: string;
  icon: LucideIcon;
};

export const LOG_EVENT_CONFIG = {
  "seed.uploaded": {
    label: "Seed uploaded",
    icon: Upload,
  },
  "seed.marked_bad": {
    label: "Seed marked bad (legacy)",
    icon: CircleX,
  },
  "seed.marked_used": {
    label: "Seed marked used",
    icon: CheckCircle2,
  },
  "seed.league_changed": {
    label: "Seed league changed",
    icon: ArrowRightLeft,
  },
  "seed.reordered": {
    label: "Seed reordered",
    icon: ArrowUpDown,
  },
  "seed.updated": {
    label: "Seed updated",
    icon: Pencil,
  },
  "seed.deleted": {
    label: "Seed deleted",
    icon: Trash2,
  },
  "comment.created": {
    label: "Comment posted",
    icon: MessageSquareText,
  },
  "user.signed_up": {
    label: "User signed up",
    icon: UserPlus,
  },
  "user.activated": {
    label: "User activated",
    icon: UserCheck,
  },
  "user.deactivated": {
    label: "User deactivated",
    icon: UserMinus,
  },
  "user.access_updated": {
    label: "User access updated",
    icon: ShieldCheck,
  },
  "user.settings_updated": {
    label: "User settings updated",
    icon: Settings2,
  },
  "league.created": {
    label: "League created",
    icon: Trophy,
  },
  "league.updated": {
    label: "League updated",
    icon: Pencil,
  },
  "league.deleted": {
    label: "League deleted",
    icon: Trash2,
  },
  "testing.paused": {
    label: "Testing paused",
    icon: PauseCircle,
  },
  "testing.resumed": {
    label: "Testing resumed",
    icon: PlayCircle,
  },
  "week.advanced": {
    label: "Week advanced",
    icon: CalendarClock,
  },
} satisfies Record<LogEventType, EventConfig>;

export const LOG_EVENT_FILTER_ITEMS: Array<{
  label: string;
  value: EventFilter;
}> = [
  { label: "All event types", value: "all" },
  ...Object.entries(LOG_EVENT_CONFIG).map(([value, config]) => ({
    label: config.label,
    value: value as LogEventType,
  })),
];

export const LOG_ACTOR_LABELS: Record<LogActorType, string> = {
  admin: "Admin",
  host: "Host",
  uploader: "Uploader",
  user: "User",
  system: "System / API",
};

export const LOG_ACTOR_FILTER_ITEMS: Array<{
  label: string;
  value: ActorFilter;
}> = [
  { label: "All user types", value: "all" },
  ...Object.entries(LOG_ACTOR_LABELS).map(([value, label]) => ({
    label,
    value: value as LogActorType,
  })),
];

export const LOG_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

export const LOG_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeStyle: "short",
});
