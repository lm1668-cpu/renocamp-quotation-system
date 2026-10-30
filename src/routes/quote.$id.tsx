import { createFileRoute } from "@tanstack/react-router";
import { Builder } from "@/components/builder";
import { RequireUser } from "@/components/require-user";

export const Route = createFileRoute("/quote/$id")({
  component: QuotePage,
});

function QuotePage() {
  const { id } = Route.useParams();
  return (
    <RequireUser>
      <Builder id={id} />
    </RequireUser>
  );
}
