import type { BotCommand } from "./command";
import { nmCommand } from "./nm";
import { pingCommand } from "./ping";

export const commands = [
  pingCommand,
  nmCommand,
] satisfies readonly BotCommand[];
