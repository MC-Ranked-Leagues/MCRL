import { adminRegCommand } from "./admin-reg";
import { adminUnregCommand } from "./admin-unreg";
import { unregCommand } from "./unreg";
import { regCommand } from "./reg";
import { assignCommand } from "./assign";
import { dmCommand } from "./dm";
import { toggleRegistrationCommand } from "./toggle-registration";
import type { BotCommand } from "./command";
import { nmCommand } from "./nm";
import { pingCommand } from "./ping";

export const commands = [
  pingCommand,
  nmCommand,
  regCommand,
  adminRegCommand,
  unregCommand,
  adminUnregCommand,
  assignCommand,
  toggleRegistrationCommand,
  dmCommand,
] satisfies readonly BotCommand[];
