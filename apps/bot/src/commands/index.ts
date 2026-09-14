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
  assignCommand,
  toggleRegistrationCommand,
  dmCommand,
] satisfies readonly BotCommand[];
