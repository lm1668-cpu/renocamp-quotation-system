import { createFileRoute } from "@tanstack/react-router";
import { Home } from "@/components/home";
import { RequireUser } from "@/components/require-user";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <RequireUser>
      <Home />
    </RequireUser>
  );
}
