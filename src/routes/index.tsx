import { createFileRoute } from "@tanstack/react-router";
import { DecideProApp } from "@/components/decidepro/DecideProApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DecideProApp />;
}
