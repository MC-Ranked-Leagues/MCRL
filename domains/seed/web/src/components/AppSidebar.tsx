import { useQuery } from "convex/react";
import { useMemo } from "react";
import { NavLink, useLocation } from "react-router";
import {
  ChevronRight,
  ChevronsUpDown,
  Home,
  ListTree,
  LogOut,
  ScrollText,
  ShieldCheck,
  Sprout,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { sortLeaguesByNumberAndName } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

const adminLinks = [
  {
    label: "Manage Seeds",
    to: "/app/admin/seeds",
    icon: Sprout,
    exact: false,
  },
  {
    label: "Manage Leagues",
    to: "/app/admin/leagues",
    icon: ListTree,
    exact: false,
  },
  {
    label: "Activity Logs",
    to: "/app/admin/logs",
    icon: ScrollText,
    exact: false,
  },
] as const;

const adminUserLinks = [
  {
    label: "Active Users",
    to: "/app/admin/users/active",
  },
  {
    label: "Pending Users",
    to: "/app/admin/users/pending",
  },
] as const;

export function AppSidebar({
  onSignOut,
  user,
}: {
  onSignOut: () => void | Promise<void>;
  user: Doc<"users">;
}) {
  const location = useLocation();
  const allLeagues = useQuery(api.leagues.listLeagues);
  const leagues = useMemo(
    () => sortLeaguesByNumberAndName(allLeagues ?? []),
    [allLeagues]
  );
  const isLeagueRoute = isActivePath(location.pathname, "/app/league");
  const isUsersRoute = isActivePath(location.pathname, "/app/admin/users");

  const isAdmin = user.roles.includes("admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarNavItem
                exact
                icon={Home}
                label="App"
                pathname={location.pathname}
                to="/app"
              />

              <Collapsible
                className="group/collapsible"
                defaultOpen={isLeagueRoute}
                render={<SidebarMenuItem />}
              >
                <SidebarMenuButton
                  isActive={isLeagueRoute}
                  render={<CollapsibleTrigger />}
                  tooltip="Leagues"
                >
                  <Trophy />
                  <span>Leagues</span>
                  <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
                </SidebarMenuButton>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {allLeagues === undefined ? (
                      <>
                        <SidebarMenuSubItem>
                          <SidebarMenuSkeleton />
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSkeleton />
                        </SidebarMenuSubItem>
                      </>
                    ) : leagues.length === 0 ? (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton aria-disabled tabIndex={-1}>
                          <span>No leagues</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ) : (
                      leagues.map((league) => (
                        <SidebarMenuSubItem key={league._id}>
                          <SidebarMenuSubButton
                            isActive={isActivePath(
                              location.pathname,
                              `/app/league/${league._id}`
                            )}
                            render={
                              <NavLink to={`/app/league/${league._id}`} />
                            }
                          >
                            <span>{league.leagueName}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarNavItem
                  exact
                  icon={ShieldCheck}
                  label="Admin Dashboard"
                  pathname={location.pathname}
                  to="/app/admin"
                />

                <Collapsible
                  className="group/collapsible"
                  defaultOpen={isUsersRoute}
                  render={<SidebarMenuItem />}
                >
                  <SidebarMenuButton
                    isActive={isUsersRoute}
                    render={<CollapsibleTrigger />}
                    tooltip="Users"
                  >
                    <Users />
                    <span>Users</span>
                    <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {adminUserLinks.map((link) => (
                        <SidebarMenuSubItem key={link.to}>
                          <SidebarMenuSubButton
                            isActive={isActivePath(location.pathname, link.to)}
                            render={<NavLink to={link.to} />}
                          >
                            <span>{link.label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>

                {adminLinks.map((link) => (
                  <SidebarNavItem
                    key={link.to}
                    exact={link.exact}
                    icon={link.icon}
                    label={link.label}
                    pathname={location.pathname}
                    to={link.to}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <AccountMenu onSignOut={onSignOut} user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

function AccountMenu({
  isActive,
  onSignOut,
  user,
}: {
  isActive?: boolean;
  onSignOut: () => void | Promise<void>;
  user: Doc<"users">;
}) {
  const displayName = user.name ?? "Unknown user";
  const username = user.lowercaseName ?? displayName.toLowerCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                isActive={isActive}
                size="lg"
                tooltip="Account"
              />
            }
          >
            <UserAvatar user={user} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-muted-foreground">
                @{username}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            side="right"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-2">
                <div className="flex items-center gap-2">
                  <UserAvatar user={user} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {displayName}
                    </span>
                    <span className="truncate text-muted-foreground">
                      @{username}
                    </span>
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<NavLink to="/app/account" />}>
                <UserRound />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void onSignOut();
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserAvatar({ user }: { user: Doc<"users"> }) {
  const displayName = user.name ?? "Unknown user";

  return (
    <Avatar size="sm">
      {user.image && <AvatarImage alt={displayName} src={user.image} />}
      <AvatarFallback>{getUserInitials(displayName)}</AvatarFallback>
    </Avatar>
  );
}

function getUserInitials(displayName: string) {
  return displayName.trim().slice(0, 2).toUpperCase() || "U";
}

function SidebarNavItem({
  exact = false,
  icon: Icon,
  label,
  pathname,
  to,
}: {
  exact?: boolean;
  icon: LucideIcon;
  label: string;
  pathname: string;
  to: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActivePath(pathname, to, exact)}
        render={<NavLink end={exact} to={to} />}
        tooltip={label}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function isActivePath(pathname: string, to: string, exact = false) {
  if (exact) {
    return pathname === to;
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}
