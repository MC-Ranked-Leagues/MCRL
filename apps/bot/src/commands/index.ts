import { signupCommand } from "./signup";
import { migrateAccountCommand } from "./migrate-account";
import { importCommand } from "./import";
import { hostCommand } from "./host";
import { clearCommand } from "./clear";
import { adminRegCommand } from "./admin-reg";
import { adminUnregCommand } from "./admin-unreg";
import { unregCommand } from "./unreg";
import { regCommand } from "./reg";
import { assignCommand } from "./assign";
import { advanceWeekCommand } from "./advance-week";
import { devChangeWeekCommand } from "./dev-change-week";
import { emCommand } from "./em";
import { relegateCommand } from "./relegate";
import { relegateReapplyCommand } from "./relegate-reapply";
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
import { linkCommand } from "./link";

export const commands = [
  meCommand,
  rankedCommand,
  linkCommand,
  twitchCommand,
  signupCommand,
  migrateAccountCommand,
  pingCommand,
  nmCommand,
  regCommand,
  listCommand,
  adminRegCommand,
  adminUnregCommand,
  unregCommand,
  assignCommand,
  toggleRegistrationCommand,
  advanceWeekCommand,
  devChangeWeekCommand,
  emCommand,
  relegateCommand,
  relegateReapplyCommand,
  unendCommand,
  hostCommand,
  importCommand,
  clearCommand,
  testFillCommand,
  testClearCommand,
  testMigrateCommand,
] satisfies readonly BotCommand[];
