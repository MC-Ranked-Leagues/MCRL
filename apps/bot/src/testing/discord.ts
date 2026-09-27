import { Collection } from "discord.js";

export interface MockRole {
  id: string;
  editable: boolean;
}

export interface MemberRolesMock {
  roles: {
    cache: Collection<string, MockRole>;
    add: (role: MockRole | string, reason?: string) => Promise<void>;
    remove: (
      role: MockRole | string | (MockRole | string)[],
      reason?: string
    ) => Promise<void>;
    set: (ids: string[], reason?: string) => Promise<void>;
  };
  // What Discord currently holds for the member; the assertions that matter.
  serverRoles: Set<string>;
  calls: { add: number; remove: number; set: number };
}

function resolveId(role: MockRole | string): string {
  return typeof role === "string" ? role : role.id;
}

// Replicates discord.js 14 manager semantics: a singular add() PUTs one role
// and a singular remove() DELETEs one role, neither touching the manager
// cache; remove([...]) and set() PATCH the full role list, with remove([...])
// deriving that list from the stale cache. Mocks that apply every call to
// shared state hide the clobber this caused.
export function createMemberRoles(initial: MockRole[]): MemberRolesMock {
  const serverRoles = new Set(initial.map((role) => role.id));
  const cache = new Collection(initial.map((role) => [role.id, role]));
  const calls = { add: 0, remove: 0, set: 0 };
  return {
    roles: {
      cache,
      add: async (role) => {
        calls.add += 1;
        serverRoles.add(typeof role === "string" ? role : role.id);
      },
      remove: async (role) => {
        calls.remove += 1;
        if (Array.isArray(role)) {
          const ids = role.map(resolveId);
          const next = [...cache.keys()].filter((id) => !ids.includes(id));
          serverRoles.clear();
          for (const id of next) serverRoles.add(id);
          return;
        }
        serverRoles.delete(resolveId(role));
      },
      set: async (ids) => {
        calls.set += 1;
        serverRoles.clear();
        for (const id of ids) serverRoles.add(id);
      },
    },
    serverRoles,
    calls,
  };
}
