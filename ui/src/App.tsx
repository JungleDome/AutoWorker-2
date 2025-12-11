import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Server, ShieldCheck } from "lucide-react";

import { TicketActions } from "./components/sections/TicketActions";
import { TicketDetails } from "./components/sections/TicketDetails";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Separator } from "./components/ui/separator";
import { useTicketsStore } from "./store/useTicketsStore";

function Header() {
  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline" className="flex items-center gap-1">
          <ShieldCheck className="h-4 w-4" /> AutoWorker
        </Badge>
        <span>•</span>
        <span>Agent control center</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Ticket orchestrator
          </h1>
          <p className="text-muted-foreground">
            Create a ticket, dispatch agents, and inspect their outputs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-4 w-4" />
          <span>Backend driven by src/server.ts</span>
        </div>
      </div>
    </div>
  );
}

function BaseUrlForm() {
  const { baseUrl, setBaseUrl, loadTickets, error } = useTicketsStore();
  const [value, setValue] = useState(baseUrl);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-1">
          <Label htmlFor="api_base">Base URL</Label>
          <Input
            id="api_base"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="http://localhost:3000"
          />
          <p className="text-xs text-muted-foreground">
            Update this if your AutoWorker backend runs on a different host or port.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setBaseUrl(value);
              loadTickets();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Save & refresh
          </Button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function TicketSidebar() {
  const { tickets, selectedTicketId, selectTicket, ensureTicket, refreshTicket, loading } =
    useTicketsStore();
  const [newTicketId, setNewTicketId] = useState("");

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.ticketId === selectedTicketId),
    [tickets, selectedTicketId],
  );

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Tickets</CardTitle>
          <p className="text-sm text-muted-foreground">Create or pick a ticket to manage</p>
        </div>
        <Badge variant="outline">{tickets.length} total</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ticket_id">Create or load ticket</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="ticket_id"
              placeholder="ticket-123"
              value={newTicketId}
              onChange={(event) => setNewTicketId(event.target.value)}
            />
            <Button
              disabled={!newTicketId}
              onClick={async () => {
                await ensureTicket(newTicketId.trim());
                setNewTicketId("");
              }}
            >
              Create/Load
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Existing tickets</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshTicket(selectedTicketId ?? tickets[0]?.ticketId ?? "")}
              disabled={loading || (!selectedTicketId && tickets.length === 0)}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
          {tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          )}
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.ticketId}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary/50 hover:bg-secondary ${
                  ticket.ticketId === selectedTicket?.ticketId
                    ? "border-primary bg-secondary"
                    : "border-border"
                }`}
                onClick={() => selectTicket(ticket.ticketId)}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{ticket.ticketId}</span>
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(ticket.updatedAt).toLocaleTimeString()}
                  </span>
                </div>
                <Badge variant="outline">{ticket.planHistory.length} plans</Badge>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const { loadTickets, selectedTicketId, tickets } = useTicketsStore();

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.ticketId === selectedTicketId),
    [tickets, selectedTicketId],
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Header />
        <BaseUrlForm />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <TicketSidebar />
          <div className="space-y-4">
            {selectedTicket ? (
              <>
                <TicketActions ticketId={selectedTicket.ticketId} />
                <TicketDetails ticket={selectedTicket} />
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No ticket selected</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Use the sidebar to create or select a ticket.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
