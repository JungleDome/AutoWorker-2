import { useMemo, useState, type ReactNode } from "react";
import { useTicketStore, type TicketRecord } from "@/state/tickets";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare, Plus, Sparkles, Ticket } from "lucide-react";

type DetailTabKey = "requirements" | "plan" | "execution" | "qa";

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
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="h-4 w-4" /> {ticket.ticketId}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          Updated {new Date(ticket.updatedAt).toLocaleString()}
        </p>
      </div>
      <Badge variant={ticket.latestRequirements ? "default" : "muted"}>
        {ticket.latestRequirements ? "Ready" : "New"}
      </Badge>
    </button>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="whitespace-nowrap"
    >
      {label}
    </Button>
  );
}

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-muted/60"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="truncate">{title}</p>
          {subtitle && (
            <p className="truncate text-xs font-normal text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && <div className="border-t border-border px-4 py-3">{children}</div>}
    </div>
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
  const [activeTab, setActiveTab] = useState<DetailTabKey>(
    ticket.latestRequirements ? "requirements" : "plan",
  );
  const [showCapture, setShowCapture] = useState(false);

  const lastPlan = useMemo(
    () => ticket.planHistory[0] ?? ticket.latestPlan,
    [ticket],
  );

  const requirementsPayload = ticket.latestRequirements?.payload;
  const planPayload = lastPlan?.payload;

  const latestRequirementTitle = requirementsPayload?.title;
  const latestRequirementCount =
    requirementsPayload?.acceptance_criteria.length ?? 0;
  const planStepCount = lastPlan?.payload.steps.length ?? 0;

  type PlanStepType = NonNullable<typeof planPayload>["steps"][number];

  const renderPlanStep = (step: PlanStepType): ReactNode => {
    const children = (step.children ?? []) as PlanStepType[];
    return (
      <li key={step.id} className="space-y-2">
        <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{step.id}</Badge>
            <p className="text-sm font-medium">{step.title}</p>
            <Badge variant="muted">{step.status}</Badge>
            <Badge variant="muted">{step.kind}</Badge>
            <Badge variant="muted">{step.owner_role}</Badge>
            <Badge variant="muted">Risk {step.risk_level}</Badge>
            {step.requires_review && <Badge variant="outline">Review</Badge>}
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {step.description}
          </p>
          {(step.depends_on.length > 0 ||
            step.related_acceptance_criteria.length > 0) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {step.depends_on.length > 0 && (
                <span>
                  Depends on: {step.depends_on.join(", ")}
                </span>
              )}
              {step.related_acceptance_criteria.length > 0 && (
                <span>
                  Criteria: {step.related_acceptance_criteria.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
        {children.length > 0 && (
          <ul className="ml-4 space-y-2 border-l border-border pl-4">
            {children.map((child) => renderPlanStep(child))}
          </ul>
        )}
      </li>
    );
  };

  const renderPlanPayload = (payload: typeof planPayload) => {
    if (!payload) return null;
    return (
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Plan {payload.plan_id}</Badge>
          <Badge variant="outline">v{payload.plan_version}</Badge>
          <Badge variant="muted">Risk {payload.overall_risk_level}</Badge>
          <Badge variant="muted">Complexity {payload.overall_complexity}</Badge>
          <Badge variant="muted">Review {payload.recommended_review_mode}</Badge>
        </div>

        {payload.assumptions.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium">Assumptions</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {payload.assumptions.map((assumption, idx) => (
                <li key={`${assumption}-${idx}`}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}

        {payload.risks.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium">Risks</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {payload.risks.map((risk, idx) => (
                <li key={`${risk}-${idx}`}>{risk}</li>
              ))}
            </ul>
          </div>
        )}

        {payload.questions_for_human.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium">Questions for human</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {payload.questions_for_human.map((question, idx) => (
                <li key={`${question}-${idx}`}>{question}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium">Steps</p>
          {payload.steps.length > 0 ? (
            <ul className="space-y-2">{payload.steps.map(renderPlanStep)}</ul>
          ) : (
            <p className="text-muted-foreground">No steps provided.</p>
          )}
        </div>

        {payload.freeform_notes && (
          <div className="space-y-1">
            <p className="font-medium">Notes</p>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {payload.freeform_notes}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" /> Ticket {ticket.ticketId}
              </CardTitle>
              <CardDescription>
                Review requirements, plans, execution, and QA outputs.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={ticket.latestRequirements ? "default" : "muted"}>
                {ticket.latestRequirements
                  ? "Requirements ready"
                  : "Needs requirements"}
              </Badge>
              <span className="rounded-full bg-muted px-2 py-1">
                {latestRequirementCount} criteria
              </span>
              <span className="rounded-full bg-muted px-2 py-1">
                {planStepCount} plan steps
              </span>
              <span className="rounded-full bg-muted px-2 py-1">
                {ticket.executionResults.length} executions
              </span>
              <span className="rounded-full bg-muted px-2 py-1">
                {ticket.qaReports.length} QA reports
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <TabButton
              label="Requirements"
              active={activeTab === "requirements"}
              onClick={() => setActiveTab("requirements")}
            />
            <TabButton
              label="Plan"
              active={activeTab === "plan"}
              onClick={() => setActiveTab("plan")}
            />
            <TabButton
              label="Execution"
              active={activeTab === "execution"}
              onClick={() => setActiveTab("execution")}
            />
            <TabButton
              label="QA Reports"
              active={activeTab === "qa"}
              onClick={() => setActiveTab("qa")}
            />
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "requirements" && (
            <div className="space-y-4">
              {requirementsPayload ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-border bg-muted/50 p-4 text-sm space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-base font-semibold">
                          {latestRequirementTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source: {requirementsPayload.source.raw_description}
                        </p>
                      </div>
                      <Badge variant="outline">Latest</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Classification
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {requirementsPayload.classification.type}
                          </Badge>
                          <Badge variant="outline">
                            {requirementsPayload.classification.domain}
                          </Badge>
                          <Badge variant="outline">
                            Priority {requirementsPayload.classification.priority}
                          </Badge>
                          <Badge variant="outline">
                            Risk {requirementsPayload.classification.risk_level}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Suggested review mode
                        </p>
                        <p>{requirementsPayload.suggested_review_mode}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Problem statement</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {requirementsPayload.problem_statement}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Goal statement</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {requirementsPayload.goal_statement}
                      </p>
                    </div>
                  </div>

                  {requirementsPayload.context_summary && (
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Context summary</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {requirementsPayload.context_summary}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Non-goals</p>
                      {requirementsPayload.non_goals.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {requirementsPayload.non_goals.map((item, idx) => (
                            <li key={`${item}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">None listed.</p>
                      )}
                    </div>
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Constraints</p>
                      {requirementsPayload.constraints.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {requirementsPayload.constraints.map((item, idx) => (
                            <li key={`${item}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No constraints listed.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Dependencies</p>
                      {requirementsPayload.dependencies.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {requirementsPayload.dependencies.map((item, idx) => (
                            <li key={`${item}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No dependencies listed.
                        </p>
                      )}
                    </div>
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Open questions</p>
                      {requirementsPayload.open_questions_for_stakeholders.length >
                      0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {requirementsPayload.open_questions_for_stakeholders.map(
                            (item, idx) => (
                              <li key={`${item}-${idx}`}>{item}</li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No open questions.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card p-4 space-y-2">
                    <p className="text-sm font-medium">Acceptance criteria</p>
                    {latestRequirementCount > 0 ? (
                      <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                        {requirementsPayload.acceptance_criteria.map((item) => (
                          <li key={item.id}>
                            {item.description}
                            {!item.must_have && (
                              <span className="ml-2 text-xs">
                                (nice-to-have)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No acceptance criteria listed.
                      </p>
                    )}
                  </div>

                  {requirementsPayload.freeform_notes && (
                    <div className="rounded-md border border-border bg-card p-4 space-y-2">
                      <p className="text-sm font-medium">Notes</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {requirementsPayload.freeform_notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  No requirements captured yet. Use the form below to generate
                  them.
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Capture / regenerate</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCapture((value) => !value)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {showCapture ? "Hide form" : "Open form"}
                </Button>
              </div>

              {showCapture && (
                <Card className="bg-card/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4" /> Requirements input
                    </CardTitle>
                    <CardDescription>
                      Provide a description and optional notes for the
                      requirements agent.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="description">
                        Ticket description (required)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Explain the problem and desired outcome. This drives the
                        generated requirements.
                      </p>
                      <Textarea
                        id="description"
                        placeholder="Describe the problem, goals, and any relevant context"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="min-h-[120px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">
                        Additional context / constraints (optional)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Add links, limitations, or preferences the agent should
                        consider.
                      </p>
                      <Input
                        id="notes"
                        placeholder="e.g. tech constraints, stakeholders, examples"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="justify-end">
                    <Button
                      onClick={() =>
                        onCaptureRequirements({
                          description,
                          notes: notes || undefined,
                        })
                      }
                      disabled={busy || description.trim().length === 0}
                      className="gap-2"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Running
                          agent...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" /> Generate requirements
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>
          )}

          {activeTab === "plan" && (
            <div className="space-y-4">
              {planPayload ? (
                <div className="rounded-md border border-border bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold">
                      {planPayload.summary}
                    </p>
                    <Badge variant="outline">Latest</Badge>
                  </div>
                  {renderPlanPayload(planPayload)}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  No plan available yet.
                </div>
              )}

              {ticket.planHistory.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Plan history</p>
                  <div className="space-y-2">
                    {ticket.planHistory.slice(1).map((plan) => (
                      <CollapsibleSection
                        key={plan.run_id ?? plan.generated_at}
                        title={plan.payload.summary}
                        subtitle={`Generated ${new Date(
                          plan.generated_at,
                        ).toLocaleString()}`}
                      >
                        {renderPlanPayload(plan.payload)}
                      </CollapsibleSection>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "execution" && (
            <div className="space-y-3">
              {ticket.executionResults.length ? (
                ticket.executionResults.map((run, index) => (
                  <CollapsibleSection
                    key={run.run_id ?? run.generated_at ?? run.payload.summary}
                    title={run.payload.summary || `Execution #${index + 1}`}
                    subtitle={`Status: ${run.payload.status}${
                      run.payload.time_spent_minutes != null
                        ? ` - ${run.payload.time_spent_minutes} min`
                        : ""
                    } - Plan ${run.payload.plan_id} - Generated ${new Date(
                      run.generated_at,
                    ).toLocaleString()}`}
                    defaultOpen={index === 0}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">Plan {run.payload.plan_id}</Badge>
                      <Badge variant="muted">{run.payload.status}</Badge>
                      {run.payload.time_spent_minutes != null && (
                        <Badge variant="outline">
                          {run.payload.time_spent_minutes} min
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Handled steps</p>
                      {run.payload.handled_steps.length > 0 ? (
                        <ul className="space-y-3">
                          {run.payload.handled_steps.map((step) => (
                            <li
                              key={`${step.step_id}`}
                              className="rounded-md border border-border bg-muted/40 p-3 space-y-2 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{step.step_id}</Badge>
                                <Badge variant="muted">
                                  {step.previous_status} -&gt; {step.new_status}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground whitespace-pre-wrap">
                                {step.work_summary}
                              </p>
                              {step.artifacts.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Artifacts
                                  </p>
                                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                                    {step.artifacts.map((artifact, idx) => (
                                      <li key={`${artifact}-${idx}`}>
                                        {artifact}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {step.notes_for_next_run.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Notes for next run
                                  </p>
                                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                                    {step.notes_for_next_run.map((note, idx) => (
                                      <li key={`${note}-${idx}`}>{note}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No handled steps recorded.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Plan feedback</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">
                          Sufficiency{" "}
                          {run.payload.plan_feedback.sufficient_for_execution}
                        </Badge>
                        {run.payload.plan_feedback.replan_recommended != null && (
                          <Badge variant="outline">
                            Replan{" "}
                            {run.payload.plan_feedback.replan_recommended
                              ? "recommended"
                              : "not recommended"}
                          </Badge>
                        )}
                      </div>
                      {run.payload.plan_feedback.issues.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {run.payload.plan_feedback.issues.map(
                            (issue, idx) => (
                              <li key={`${issue.category}-${idx}`}>
                                <span className="font-medium text-foreground">
                                  {issue.category}
                                </span>
                                : {issue.description}
                                {issue.related_steps.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {" "}
                                    (steps:{" "}
                                    {issue.related_steps.join(", ")})
                                  </span>
                                )}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No feedback issues.
                        </p>
                      )}
                    </div>

                    {(run.payload.blockers.length > 0 ||
                      run.payload.questions_for_human.length > 0) && (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {run.payload.blockers.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Blockers</p>
                            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                              {run.payload.blockers.map((blocker, idx) => (
                                <li key={`${blocker}-${idx}`}>{blocker}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {run.payload.questions_for_human.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Questions for human
                            </p>
                            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                              {run.payload.questions_for_human.map(
                                (question, idx) => (
                                  <li key={`${question}-${idx}`}>{question}</li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {run.payload.next_recommended_actions.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-medium">Next actions</p>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {run.payload.next_recommended_actions.map(
                            (action, idx) => (
                              <li key={`${action}-${idx}`}>{action}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    {run.payload.human_review.suggested && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">
                          Human review suggested
                        </p>
                        {run.payload.human_review.reason && (
                          <p className="text-sm text-muted-foreground">
                            {run.payload.human_review.reason}
                          </p>
                        )}
                        {run.payload.human_review.review_focus.length > 0 && (
                          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                            {run.payload.human_review.review_focus.map(
                              (focus, idx) => (
                                <li key={`${focus}-${idx}`}>{focus}</li>
                              ),
                            )}
                          </ul>
                        )}
                      </div>
                    )}

                    {run.payload.freeform_notes && (
                      <div className="mt-4 space-y-1">
                        <p className="text-sm font-medium">Notes</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {run.payload.freeform_notes}
                        </p>
                      </div>
                    )}
                  </CollapsibleSection>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  No execution runs yet.
                </div>
              )}
            </div>
          )}

          {activeTab === "qa" && (
            <div className="space-y-3">
              {ticket.qaReports.length ? (
                ticket.qaReports.map((report, index) => (
                  <CollapsibleSection
                    key={
                      report.run_id ??
                      report.generated_at ??
                      report.payload.summary
                    }
                    title={`${report.payload.overall_status}: ${report.payload.summary}`}
                    subtitle={`Generated ${new Date(
                      report.generated_at,
	                    ).toLocaleString()}`}
	                    defaultOpen={index === 0}
	                  >
	                    <div className="flex flex-wrap items-center gap-2 text-xs">
	                      <Badge variant="outline">
	                        Plan {report.payload.plan_id}
	                      </Badge>
	                      <Badge variant="muted">
	                        {report.payload.overall_status}
	                      </Badge>
	                      <Badge variant="outline">
	                        {report.payload.tested_acceptance_criteria.length}{" "}
	                        criteria tested
	                      </Badge>
	                      <Badge variant="outline">
	                        {report.payload.checks.length} checks
	                      </Badge>
	                    </div>
	
	                    {report.payload.tested_acceptance_criteria.length > 0 && (
	                      <div className="mt-4 space-y-2">
	                        <p className="text-sm font-medium">
	                          Tested acceptance criteria
	                        </p>
	                        <ul className="space-y-2 text-sm">
	                          {report.payload.tested_acceptance_criteria.map(
	                            (criterion) => (
	                              <li
	                                key={criterion.id}
	                                className="rounded-md border border-border bg-muted/40 p-3 space-y-1"
	                              >
	                                <div className="flex flex-wrap items-center gap-2">
	                                  <Badge variant="outline">
	                                    {criterion.id}
	                                  </Badge>
	                                  <Badge variant="muted">
	                                    {criterion.status}
	                                  </Badge>
	                                </div>
	                                {criterion.notes && (
	                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
	                                    {criterion.notes}
	                                  </p>
	                                )}
	                              </li>
	                            ),
	                          )}
	                        </ul>
	                      </div>
	                    )}
	
	                    {report.payload.checks.length > 0 && (
	                      <div className="mt-4 space-y-2">
	                        <p className="text-sm font-medium">Checks</p>
	                        <ul className="space-y-3 text-sm">
	                          {report.payload.checks.map((check) => (
	                            <li
	                              key={check.id}
	                              className="rounded-md border border-border bg-muted/40 p-3 space-y-2"
	                            >
	                              <div className="flex flex-wrap items-center gap-2">
	                                <Badge variant="outline">{check.id}</Badge>
	                                <Badge variant="muted">{check.status}</Badge>
	                                {check.related_steps.length > 0 && (
	                                  <span className="text-xs text-muted-foreground">
	                                    Steps: {check.related_steps.join(", ")}
	                                  </span>
	                                )}
	                              </div>
	                              <p className="text-sm font-medium">
	                                {check.description}
	                              </p>
	                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
	                                {check.details}
	                              </p>
	                            </li>
	                          ))}
	                        </ul>
	                      </div>
	                    )}
	
	                    {report.payload.issues_found.length > 0 ? (
	                      <div className="mt-4 space-y-2 text-sm">
	                        <p className="font-medium">Issues found</p>
	                        <ul className="space-y-3">
	                          {report.payload.issues_found.map((issue) => (
	                            <li
	                              key={issue.id}
	                              className="rounded-md border border-border bg-muted/40 p-3 space-y-1"
	                            >
	                              <div className="flex flex-wrap items-center gap-2">
	                                <Badge variant="outline">{issue.id}</Badge>
	                                <Badge variant="muted">
	                                  {issue.severity}
	                                </Badge>
	                              </div>
	                              <p className="text-muted-foreground whitespace-pre-wrap">
	                                {issue.description}
	                              </p>
	                              {issue.related_steps.length > 0 && (
	                                <p className="text-xs text-muted-foreground">
	                                  Related steps:{" "}
	                                  {issue.related_steps.join(", ")}
	                                </p>
	                              )}
	                              {issue.suspected_cause && (
	                                <p className="text-xs text-muted-foreground">
	                                  Suspected cause: {issue.suspected_cause}
	                                </p>
	                              )}
	                              {issue.suggested_fix && (
	                                <p className="text-xs text-muted-foreground">
	                                  Suggested fix: {issue.suggested_fix}
	                                </p>
	                              )}
	                            </li>
	                          ))}
	                        </ul>
	                      </div>
	                    ) : (
	                      <p className="mt-4 text-sm text-muted-foreground">
	                        No issues reported.
	                      </p>
	                    )}
	
	                    <div className="mt-4 space-y-1">
	                      <p className="text-sm font-medium">Recommendation</p>
	                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
	                        {report.payload.recommendation}
	                      </p>
	                    </div>
	
	                    {report.payload.questions_for_human.length > 0 && (
	                      <div className="mt-4 space-y-1">
	                        <p className="text-sm font-medium">
	                          Questions for human
	                        </p>
	                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
	                          {report.payload.questions_for_human.map(
	                            (question, idx) => (
	                              <li key={`${question}-${idx}`}>{question}</li>
	                            ),
	                          )}
	                        </ul>
	                      </div>
	                    )}
	
	                    {report.payload.freeform_notes && (
	                      <div className="mt-4 space-y-1">
	                        <p className="text-sm font-medium">Notes</p>
	                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
	                          {report.payload.freeform_notes}
	                        </p>
	                      </div>
	                    )}
	                  </CollapsibleSection>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  No QA runs yet.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TicketDashboard() {
  const [newTicketId, setNewTicketId] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const { tickets, selectedTicket, loading, error } = useTicketStore();
  const createTicket = useTicketStore((state) => state.createTicket);
  const selectTicket = useTicketStore((state) => state.selectTicket);
  const runRequirements = useTicketStore((state) => state.runRequirements);

  const handleCreate = () => {
    if (!newTicketId.trim()) return;
    void createTicket(newTicketId.trim());
    setNewTicketId("");
  };

  const filteredTickets = useMemo(() => {
    const query = ticketQuery.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((ticket) =>
      ticket.ticketId.toLowerCase().includes(query),
    );
  }, [tickets, ticketQuery]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] xl:grid-cols-[400px_1fr]">
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4" /> Tickets
            </CardTitle>
            <CardDescription>
              Create, search, and select a ticket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Button
                onClick={handleCreate}
                disabled={loading || !newTicketId.trim()}
                size="icon"
                aria-label="Create ticket"
	              >
	                <Plus className="h-4 w-4" />
	              </Button>
	            </div>

            <Input
              placeholder="Search tickets..."
              value={ticketQuery}
              onChange={(event) => setTicketQuery(event.target.value)}
            />

            <div className="space-y-2">
              {filteredTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tickets.length === 0
                    ? "No tickets yet. Create one to begin."
                    : "No tickets match your search."}
                </p>
              ) : (
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {filteredTickets.map((ticket) => (
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
            key={selectedTicket.ticketId}
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
