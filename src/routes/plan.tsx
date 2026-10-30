import { createFileRoute } from "@tanstack/react-router";
import { PlanPanel } from "@/components/plan-panel";
import { RequireUser } from "@/components/require-user";

export const Route = createFileRoute("/plan")({
  component: PlanPage,
});

function PlanPage() {
  return (
    <RequireUser>
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <PlanPanel />
      </div>
    </RequireUser>
  );
}
