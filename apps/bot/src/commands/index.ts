import { signupCommand } from "./signup";
import { migrateAccountCommand } from "./migrate-account";
import { importCommand } from "./import";
import { clearCommand } from "./clear";
import { adminRegCommand } from "./admin-reg";
import { unregCommand } from "./unreg";
import { regCommand } from "./reg";
import { assignCommand } from "./assign";
import { dmCommand } from "./dm";
import { emCommand } from "./em";
import { unendCommand } from "./unend";
import { toggleRegistrationCommand } from "./toggle-registration";
import type { BotCommand } from "./command";
import { nmCommand } from "./nm";
import { pingCommand } from "./ping";
import { testClearCommand } from "./test-clear";
import { testFillCommand } from "./test-fill";
import { testMigrateCommand } from "./test-migrate";
import { meCommand } from "./me";
import { rankedCommand } from "./ranked";
import { twitchCommand } from "./twitch";
import { listCommand } from "./list";

export const commands = [
  meCommand,
  rankedCommand,
  twitchCommand,
  signupCommand,
  migrateAccountCommand,
  pingCommand,
  nmCommand,
  regCommand,
  listCommand,
  adminRegCommand,
  unregCommand,
  assignCommand,
  toggleRegistrationCommand,
  dmCommand,
  emCommand,
  unendCommand,
  importCommand,
  clearCommand,
  testFillCommand,
  testClearCommand,
  testMigrateCommand,
] satisfies readonly BotCommand[];
