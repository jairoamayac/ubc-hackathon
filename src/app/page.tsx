import CrewsApp from "@/components/CrewsApp";
import { AuthGate } from "@/components/auth/AuthGate";

export default function Page() {
  return (
    <main className="flex min-h-dvh justify-center">
      <AuthGate>
        <CrewsApp />
      </AuthGate>
    </main>
  );
}
