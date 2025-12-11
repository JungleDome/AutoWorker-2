import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import type { TicketRecord } from "../../types";

interface TicketDetailsProps {
  ticket: TicketRecord;
}

function JsonViewer({ data }: { data?: unknown }) {
  if (!data) {
    return <p className="text-sm text-muted-foreground">No data yet</p>;
  }

  return <pre className="rounded-md bg-slate-50 p-3 text-xs text-slate-800">{JSON.stringify(data, null, 2)}</pre>;
}

export function TicketDetails({ ticket }: TicketDetailsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Ticket metadata</span>
            <Badge variant="outline">{ticket.ticketId}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <span className="font-semibold text-foreground">Created:</span>
            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-foreground">Updated:</span>
            <span>{new Date(ticket.updatedAt).toLocaleString()}</span>
          </div>
          <Separator className="my-2" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Feedback</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Requirements</p>
                <ul className="list-disc pl-4">
                  {ticket.feedback.requirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground">Plan</p>
                <ul className="list-disc pl-4">
                  {ticket.feedback.plan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground">Execution</p>
                <ul className="list-disc pl-4">
                  {ticket.feedback.execution.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground">QA</p>
                <ul className="list-disc pl-4">
                  {ticket.feedback.qa.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonViewer data={ticket.latestRequirements} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <JsonViewer data={ticket.latestPlan} />
          {ticket.planHistory.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Plan history</p>
              <JsonViewer data={ticket.planHistory} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution results</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonViewer data={ticket.executionResults} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>QA reports</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonViewer data={ticket.qaReports} />
        </CardContent>
      </Card>
    </div>
  );
}
