import type { BotCommand } from "./command";
import { pingCommand } from "./ping";

export const commands = [pingCommand] satisfies readonly BotCommand[];
