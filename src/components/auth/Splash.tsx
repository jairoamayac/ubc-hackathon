import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/** Same frame as the app (see Shell in CrewsApp) so nothing jumps while signing in. */
export function AuthShell({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col overflow-x-clip bg-paper sm:my-6 sm:min-h-[860px] sm:rounded-[32px] sm:shadow-[0_24px_60px_rgba(46,34,96,0.18)]">
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

export function Splash({ text = "Getting things ready" }: { text?: string }) {
  return (
    <AuthShell>
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">{text}</p>
      </div>
    </AuthShell>
  );
}
