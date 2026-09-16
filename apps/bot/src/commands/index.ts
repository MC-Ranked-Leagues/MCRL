import { importCommand } from "./import";
import { clearCommand } from "./clear";
import { adminRegCommand } from "./admin-reg";
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
  assignCommand,
  toggleRegistrationCommand,
  dmCommand,
  importCommand,
  clearCommand,
] satisfies readonly BotCommand[];
