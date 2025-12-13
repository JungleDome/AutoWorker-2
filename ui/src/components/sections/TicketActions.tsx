import { useState } from "react";

import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import type { ExecutionRequest, PlanRequest, QaRequest, RequirementsRequest } from "../../types";
import { useTicketsStore } from "../../store/useTicketsStore";

interface TicketActionsProps {
  ticketId: string;
}

export function TicketActions({ ticketId }: TicketActionsProps) {
  const [requirementsPayload, setRequirementsPayload] = useState<RequirementsRequest>({
    raw_description: "",
    notes_for_agent: "",
  });
  const [planPayload, setPlanPayload] = useState<PlanRequest>({ notes_for_agent: "" });
  const [executionPayload, setExecutionPayload] = useState<ExecutionRequest>({
    plan_id: "",
    step_ids: [],
    notes_for_agent: "",
  });
  const [qaPayload, setQaPayload] = useState<QaRequest>({ plan_id: "", notes_for_agent: "" });
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>();

  const { runRequirements, runPlan, runExecution, runQa } = useTicketsStore();

  const handleSubmit = async (kind: string, action: () => Promise<void>) => {
    setSubmitting(kind);
    setMessage(undefined);
    try {
      await action();
      setMessage(`${kind} request dispatched`);
    } catch (error) {
      const text = error instanceof Error ? error.message : `Failed to run ${kind}`;
      setMessage(text);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Requirements agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="raw_description">Raw description</Label>
            <Textarea
              id="raw_description"
              placeholder="Paste the ticket description"
              value={requirementsPayload.raw_description}
              onChange={(event) =>
                setRequirementsPayload((state) => ({
                  ...state,
                  raw_description: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="requirements_notes">Notes</Label>
            <Textarea
              id="requirements_notes"
              placeholder="Optional hints for the requirements agent"
              value={requirementsPayload.notes_for_agent ?? ""}
              onChange={(event) =>
                setRequirementsPayload((state) => ({
                  ...state,
                  notes_for_agent: event.target.value,
                }))
              }
            />
          </div>
          <Button
            disabled={!requirementsPayload.raw_description || submitting === "requirements"}
            onClick={() => handleSubmit("requirements", () => runRequirements(ticketId, requirementsPayload))}
          >
            {submitting === "requirements" ? "Dispatching..." : "Run requirements"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planning agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="plan_notes">Notes</Label>
            <Textarea
              id="plan_notes"
              placeholder="Context for the planner"
              value={planPayload.notes_for_agent ?? ""}
              onChange={(event) =>
                setPlanPayload({
                  notes_for_agent: event.target.value,
                })
              }
            />
          </div>
          <Button disabled={submitting === "plan"} onClick={() => handleSubmit("plan", () => runPlan(ticketId, planPayload))}>
            {submitting === "plan" ? "Dispatching..." : "Run planner"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="execution_plan">Plan ID</Label>
              <Input
                id="execution_plan"
                placeholder="Optional plan ID"
                value={executionPayload.plan_id ?? ""}
                onChange={(event) =>
                  setExecutionPayload((state) => ({
                    ...state,
                    plan_id: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="execution_steps">Step IDs</Label>
              <Input
                id="execution_steps"
                placeholder="Comma separated"
                value={(executionPayload.step_ids ?? []).join(", ")}
                onChange={(event) => {
                  const { value } = event.target;
                  const steps = value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setExecutionPayload((state) => ({
                    ...state,
                    step_ids: steps,
                  }));
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="execution_notes">Notes</Label>
            <Textarea
              id="execution_notes"
              placeholder="Notes for the executor"
              value={executionPayload.notes_for_agent ?? ""}
              onChange={(event) =>
                setExecutionPayload((state) => ({
                  ...state,
                  notes_for_agent: event.target.value,
                }))
              }
            />
          </div>
          <Button disabled={submitting === "execution"} onClick={() => handleSubmit("execution", () => runExecution(ticketId, executionPayload))}>
            {submitting === "execution" ? "Dispatching..." : "Run execution"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QA agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qa_plan">Plan ID</Label>
            <Input
              id="qa_plan"
              placeholder="Optional plan to evaluate"
              value={qaPayload.plan_id ?? ""}
              onChange={(event) => setQaPayload((state) => ({ ...state, plan_id: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qa_notes">Notes</Label>
            <Textarea
              id="qa_notes"
              placeholder="Notes for QA"
              value={qaPayload.notes_for_agent ?? ""}
              onChange={(event) =>
                setQaPayload((state) => ({
                  ...state,
                  notes_for_agent: event.target.value,
                }))
              }
            />
          </div>
          <Button disabled={submitting === "qa"} onClick={() => handleSubmit("qa", () => runQa(ticketId, qaPayload))}>
            {submitting === "qa" ? "Dispatching..." : "Run QA"}
          </Button>
        </CardContent>
      </Card>

      {message && <div className="lg:col-span-2 text-sm text-muted-foreground">{message}</div>}
    </div>
  );
}
