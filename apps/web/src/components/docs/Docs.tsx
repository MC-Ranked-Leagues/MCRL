import { navigate } from "astro:transitions/client";
import type { ComponentProps, ReactNode } from "react";
import { SquarePenIcon } from "lucide-react";
import {
  type SerializedPageTree,
  useFumadocsLoader,
} from "fumadocs-core/source/client";
import type { TOCItemType } from "fumadocs-core/toc";
import { useSidebar } from "@fumadocs/base-ui/components/sidebar/base";
import { buttonVariants } from "@fumadocs/base-ui/components/ui/button";
import { LinkItem } from "@fumadocs/base-ui/layouts/shared";
import { ThemeSwitch } from "@fumadocs/base-ui/layouts/shared/slots/theme-switch";
import {
  DocsLayout,
  useSpaciousLayout,
} from "@fumadocs/base-ui/layouts/spacious";
import {
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
} from "@fumadocs/base-ui/layouts/spacious/page";
import {
  Sidebar,
  SidebarDrawer,
  SidebarProvider,
  type SidebarProps,
} from "@fumadocs/base-ui/layouts/spacious/slots/sidebar";
import { RootProvider } from "@fumadocs/base-ui/provider/astro";
import SearchDialog from "@/components/docs/SearchDialog";
import { SITE_NAME } from "@/consts";
import { DISCORD_URL, GITHUB_URL } from "@/links";
import { cn } from "@/lib/utils";

interface DocsProps {
  /** `Astro.url.pathname` */
  pathname: string;
  /** `Astro.params` */
  params: Record<string, string | undefined>;
  tree: SerializedPageTree;
  title: string;
  description?: string;
  toc: TOCItemType[];
  /** The date of the page's last commit, missing for uncommitted pages. */
  lastModified?: Date;
  /** The page's source file on GitHub. */
  editUrl: string;
  children?: ReactNode;
}

// The page content comes in as children.
export default function Docs({
  pathname,
  params,
  tree,
  title,
  description,
  toc,
  lastModified,
  editUrl,
  children,
}: DocsProps) {
  const data = useFumadocsLoader({ tree });

  return (
    <RootProvider
      pathname={pathname}
      params={params}
      navigate={navigate}
      search={{ SearchDialog }}
      // The rest of the site is dark only.
      theme={{ defaultTheme: "dark" }}
    >
      {/* The spacious layout is the one Fumadocs' own docs use. */}
      <DocsLayout
        tree={data.tree}
        nav={{
          title: (
            <>
              <img
                src="/MCRL.webp"
                alt=""
                width="24"
                height="24"
                className="size-6 [image-rendering:pixelated]"
              />
              {SITE_NAME}
            </>
          ),
        }}
        githubUrl={GITHUB_URL}
        // On mobile, the sidebar drawer shows icon links in its header.
        links={[
          {
            type: "icon",
            label: "Discord",
            text: "Discord",
            icon: <DiscordIcon />,
            url: DISCORD_URL,
            external: true,
          },
        ]}
        slots={{
          actions: Actions,
          sidebar: {
            provider: SidebarProvider,
            main: SidebarWithDiscord,
            drawer: SidebarDrawer,
          },
        }}
      >
        <DocsPage
          toc={toc}
          tableOfContent={{ style: "normal" }}
          tableOfContentPopover={{ style: "normal" }}
        >
          <DocsTitle>{title}</DocsTitle>
          <DocsDescription>{description}</DocsDescription>
          {children}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
            <EditOnGitHub href={editUrl}>
              <SquarePenIcon className="size-3.5" />
              Edit this page
            </EditOnGitHub>
            {lastModified && (
              // Fumadocs' `PageLastUpdate` only fills in the date after
              // hydration. UTC keeps the server and browser text the same.
              <p className="text-fd-muted-foreground text-sm">
                Last updated on{" "}
                {lastModified.toLocaleDateString("en-US", {
                  dateStyle: "long",
                  timeZone: "UTC",
                })}
              </p>
            )}
          </div>
        </DocsPage>
      </DocsLayout>
    </RootProvider>
  );
}

// The buttons at the top right of the page.
function Actions({ className, ...props }: ComponentProps<"div">) {
  const { menuItems } = useSpaciousLayout();
  const github = menuItems.find(
    (item) => item.type === "icon" && item.url === GITHUB_URL
  );

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {github?.type === "icon" && (
        <LinkItem
          item={github}
          aria-label={github.label}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "text-fd-muted-foreground"
          )}
        >
          {github.icon}
        </LinkItem>
      )}
      <ThemeSwitch />
    </div>
  );
}

// Fumadocs' sidebar with Discord pinned to its bottom, since the spacious
// layout has no sidebar footer.
function SidebarWithDiscord({ className, ...props }: SidebarProps) {
  const { collapsed } = useSidebar();

  return (
    <>
      <Sidebar className={cn("pb-12 text-[0.8125rem]", className)} {...props} />
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noreferrer noopener"
        className={cn(
          "text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-accent-foreground z-10 mx-3 mb-3 flex w-[calc(var(--fd-sidebar-width)-(--spacing(6)))] items-center gap-3 self-end rounded-lg px-2.5 py-2 text-[0.8125rem] transition-colors [grid-area:sidebar] max-md:hidden [&_svg]:size-4",
          collapsed && "invisible"
        )}
      >
        <DiscordIcon />
        Discord
      </a>
    </>
  );
}

// The Discord mark from Simple Icons.
function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}
