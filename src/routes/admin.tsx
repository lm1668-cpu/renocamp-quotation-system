import { createFileRoute } from "@tanstack/react-router";
import { AdminPanel } from "@/components/admin-panel";
import { RequireUser } from "@/components/require-user";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <RequireUser>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <AdminPanel />
      </div>
    </RequireUser>
  );
}
