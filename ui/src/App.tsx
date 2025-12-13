import { useEffect } from "react";
import { TicketDashboard } from "@/views/TicketDashboard";
import { useTicketStore } from "@/state/tickets";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

function App() {
  const loadTickets = useTicketStore((state) => state.loadTickets);
  const loading = useTicketStore((state) => state.loading);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Autoworker
            </p>
            <h1 className="text-2xl font-semibold">Agent Control Room</h1>
            <p className="text-sm text-muted-foreground">
              Create tickets, capture requirements, and review agent outputs.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadTickets()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <TicketDashboard />
      </main>
    </div>
  );
}

export default App;
