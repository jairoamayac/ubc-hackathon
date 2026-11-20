import type { Metadata } from "next";
import DemoApp from "@/components/demo/DemoApp";
import { PROJECT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PROJECT_NAME} demo: the whole story in 75 seconds`,
  description: "A clickable, offline walkthrough of Kept. Everything is simulated.",
};

export default function DemoPage() {
  return (
    <main className="flex min-h-dvh justify-center bg-paper">
      <DemoApp />
    </main>
  );
}
