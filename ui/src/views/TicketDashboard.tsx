import { useMemo, useState } from "react";
import { useTicketStore, type TicketRecord } from "@/state/tickets";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare, Plus, Sparkles, Ticket } from "lucide-react";

interface TicketListItemProps {
  ticket: TicketRecord;
  isSelected: boolean;
  onSelect: (ticketId: string) => void;
}

function TicketListItem({ ticket, isSelected, onSelect }: TicketListItemProps) {
  return (
    <button
      onClick={() => onSelect(ticket.ticketId)}
      className={`flex w-full items-start justify-between rounded-md border px-4 py-3 text-left transition hover:border-primary/70 hover:bg-muted ${isSelected ? "border-primary bg-muted" : "border-border"}`}
    >
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="h-4 w-4" /> {ticket.ticketId}
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(ticket.updatedAt).toLocaleString()}
        </p>
      </div>
      <Badge variant={ticket.latestRequirements ? "default" : "muted"}>
        {ticket.latestRequirements ? "Ready" : "New"}
      </Badge>
    </button>
  );
}

interface TicketDetailProps {
  ticket: TicketRecord;
  onCaptureRequirements: (data: { description: string; notes?: string }) => void;
  busy: boolean;
}

function TicketDetail({ ticket, onCaptureRequirements, busy }: TicketDetailProps) {
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const lastPlan = useMemo(
    () => ticket.planHistory[0] ?? ticket.latestPlan,
    [ticket],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" /> Ticket {ticket.ticketId}
          </CardTitle>
          <CardDescription>
            View requirements, plans, and QA results for this work item.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Requirements</p>
            {ticket.latestRequirements ? (
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                <p className="font-medium">{ticket.latestRequirements.payload.summary}</p>
                {ticket.latestRequirements.payload.acceptance_criteria.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    {ticket.latestRequirements.payload.acceptance_criteria.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No requirements captured yet.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Plan</p>
            {lastPlan ? (
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm space-y-2">
                <p className="font-medium">{lastPlan.payload.summary}</p>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {lastPlan.payload.steps.map((step) => (
                    <li key={step.id}>
                      <span className="font-medium text-foreground">{step.id}</span>: {step.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No plan available yet.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Execution</p>
            {ticket.executionResults.length ? (
              <div className="space-y-3">
                {ticket.executionResults.map((run) => (
                  <div
                    key={run.created_at ?? run.payload.summary}
                    className="rounded-md border border-border bg-muted/50 p-3"
                  >
                    <p className="text-sm font-semibold">{run.payload.summary}</p>
                    {run.payload.handled_steps.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                        {run.payload.handled_steps.map((step) => (
                          <li key={`${step.id}-${step.description}`}>{step.description}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No execution runs yet.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">QA Reports</p>
            {ticket.qaReports.length ? (
              <div className="space-y-3">
                {ticket.qaReports.map((report) => (
                  <div
                    key={report.created_at ?? report.payload.summary}
                    className="rounded-md border border-border bg-muted/50 p-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4" /> {report.payload.status}
                    </div>
                    <p className="text-sm text-muted-foreground">{report.payload.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No QA runs yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" /> Capture requirements
          </CardTitle>
          <CardDescription>
            Provide a description and optional notes for the requirements agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Raw description</Label>
            <Textarea
              id="description"
              placeholder="Describe the ticket in natural language"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes for the agent</Label>
            <Input
              id="notes"
              placeholder="Optional hints or constraints"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button
              onClick={() =>
                onCaptureRequirements({ description, notes: notes || undefined })
              }
              disabled={busy || description.trim().length === 0}
              className="gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Running agent…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate requirements
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TicketDashboard() {
  const [newTicketId, setNewTicketId] = useState("");
  const { tickets, selectedTicket, loading, error } = useTicketStore();
  const createTicket = useTicketStore((state) => state.createTicket);
  const selectTicket = useTicketStore((state) => state.selectTicket);
  const runRequirements = useTicketStore((state) => state.runRequirements);

  const handleCreate = () => {
    if (!newTicketId.trim()) return;
    void createTicket(newTicketId.trim());
    setNewTicketId("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4" /> Tickets
            </CardTitle>
            <CardDescription>
              Create a ticket ID and start capturing context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. TICKET-123"
                value={newTicketId}
                onChange={(event) => setNewTicketId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleCreate();
                  }
                }}
              />
              <Button onClick={handleCreate} disabled={loading || !newTicketId.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tickets yet. Create one to begin.
                </p>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <TicketListItem
                      key={ticket.ticketId}
                      ticket={ticket}
                      isSelected={selectedTicket?.ticketId === ticket.ticketId}
                      onSelect={(id) => void selectTicket(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div>
        {selectedTicket ? (
          <TicketDetail
            ticket={selectedTicket}
            busy={loading}
            onCaptureRequirements={(payload) =>
              runRequirements(selectedTicket.ticketId, payload)
            }
          />
        ) : (
          <Card className="flex h-full items-center justify-center">
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Select a ticket to view details and agent outputs.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
