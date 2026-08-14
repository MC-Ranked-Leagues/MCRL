import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./index.css";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { AdminLayout } from "./routes/admin/AdminLayout";
import { AdminIndexPage } from "./routes/admin/AdminIndexPage";
import { AdminLeaguesPage } from "./routes/admin/leagues/AdminLeaguesPage";
import { AdminLogsPage } from "./routes/admin/AdminLogsPage";
import { AdminSeedDetailsPage } from "./routes/admin/seeds/AdminSeedDetailsPage";
import { AdminSeedsPage } from "./routes/admin/seeds/AdminSeedsPage";
import { AdminActiveUserDetailsPage } from "./routes/admin/users/AdminActiveUserDetailsPage";
import { AdminActiveUsersPage } from "./routes/admin/users/AdminActiveUsersPage";
import { AdminPendingUserDetailsPage } from "./routes/admin/users/AdminPendingUserDetailsPage";
import { AdminPendingUsersPage } from "./routes/admin/users/AdminPendingUsersPage";
import { AccountPage } from "./routes/app/AccountPage";
import { AppIndexPage } from "./routes/app/AppIndexPage";
import { AppLayout } from "./routes/app/AppLayout";
import { LeaguePage } from "./routes/app/LeaguePage";
import { LeagueSeedsRedirect } from "./routes/app/LeagueSeedsRedirect";
import { SeedPage } from "./routes/app/SeedPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { LoginPage } from "./routes/public/LoginPage";
import { PendingPage } from "./routes/public/PendingPage";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

document.documentElement.classList.add("dark");
document.documentElement.style.colorScheme = "dark";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/pending" element={<PendingPage />} />

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<AppIndexPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route
                path="settings"
                element={<Navigate replace to="/app/account" />}
              />
              <Route path="league" element={<Navigate replace to="/app" />} />

              <Route path="league/:leagueId" element={<LeaguePage />}>
                <Route path="seed" element={<LeagueSeedsRedirect />} />
                <Route path="seed/:seedId" element={<SeedPage />} />
              </Route>

              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminIndexPage />} />

                <Route path="users">
                  <Route
                    index
                    element={<Navigate replace to="/app/admin/users/active" />}
                  />
                  <Route path="active" element={<AdminActiveUsersPage />}>
                    <Route
                      path=":userId"
                      element={<AdminActiveUserDetailsPage />}
                    />
                  </Route>
                  <Route path="pending" element={<AdminPendingUsersPage />}>
                    <Route
                      path=":userId"
                      element={<AdminPendingUserDetailsPage />}
                    />
                  </Route>
                </Route>

                <Route path="seeds" element={<AdminSeedsPage />} />
                <Route
                  path="seeds/:seedId"
                  element={<AdminSeedDetailsPage />}
                />

                <Route path="leagues" element={<AdminLeaguesPage />} />
                <Route path="logs" element={<AdminLogsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster richColors />
        </BrowserRouter>
      </TooltipProvider>
    </ConvexAuthProvider>
  </StrictMode>
);
