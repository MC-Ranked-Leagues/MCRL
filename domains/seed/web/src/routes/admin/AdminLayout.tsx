import { useQuery } from "convex/react";
import { Navigate, Outlet } from "react-router";
import { api } from "@/convex/_generated/api";

export function AdminLayout() {
  const user = useQuery(api.users.currentUser);

  if (!user?.roles.includes("admin")) {
    return <Navigate replace to="/app" />;
  }
  return (
    <main>
      <Outlet />
    </main>
  );
}
