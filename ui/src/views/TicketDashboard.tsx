import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTicketStore, type TicketRecord } from "@/state/tickets";
import { useProjectStore } from "@/state/projects";
import { useAskStore, type AskRecord } from "@/state/asks";
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
import {
  Brain,
  ClipboardList,
  Folder,
  Layers,
  ListChecks,
  MessageCircle,
  MessageSquarePlus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type StageKey = "requirements" | "plan" | "execution" | "qa";

function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleString();
}

function StageCard({
  title,
  subtitle,
  icon: Icon,
  status,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  status?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/60 shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {subtitle && (
              <CardDescription className="text-xs">{subtitle}</CardDescription>
            )}
            {status && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{status}</Badge>
              </div>
            )}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TicketOverviewBar({ ticket }: { ticket: TicketRecord }) {
  return (
    <div className="grid gap-2 rounded-md border border-border/70 bg-muted/30 p-3 text-xs sm:grid-cols-4">
      <div className="space-y-1">
        <p className="text-[11px] uppercase text-muted-foreground">Ticket</p>
        <p className="font-semibold">{ticket.ticketId}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase text-muted-foreground">
          Requirements
        </p>
        <p className="font-semibold">
          {ticket.latestRequirements ? "Captured" : "Not captured"}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase text-muted-foreground">Plan</p>
        <p className="font-semibold">
          {ticket.latestPlan ? "Ready" : "Pending requirements"}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase text-muted-foreground">
          Updated at
        </p>
        <p className="font-semibold">{formatDate(ticket.updatedAt)}</p>
      </div>
    </div>
  );
}

function RequirementsView({
  ticket,
  onRun,
  busy,
}: {
  ticket: TicketRecord;
  onRun: (payload: { description?: string; notes?: string }) => void;
  busy: boolean;
}) {
  const [description, setDescription] = useState(
    ticket.latestRequirements?.payload.source.raw_description ?? "",
  );
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setDescription(ticket.latestRequirements?.payload.source.raw_description ?? "");
    setNotes("");
  }, [ticket.ticketId, ticket.latestRequirements]);

  const requirements = ticket.latestRequirements?.payload;

  return (
    <div className="space-y-4">
      {requirements ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4" />
              {requirements.title}
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {requirements.problem_statement}
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="outline">{requirements.classification.domain}</Badge>
              <Badge variant="outline">
                Priority {requirements.classification.priority}
              </Badge>
              <Badge variant="outline">
                Risk {requirements.classification.risk_level}
              </Badge>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4" />
              Acceptance criteria
            </div>
            {requirements.acceptance_criteria.length ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {requirements.acceptance_criteria.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-[3px]">
                      {item.id}
                    </Badge>
                    <div>
                      <p>{item.description}</p>
                      {!item.must_have && (
                        <p className="text-[11px] text-muted-foreground">
                          Nice-to-have
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No criteria listed.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          No requirements yet. Describe the ticket and capture them below.
        </div>
      )}

      <div className="rounded-md border border-border/70 bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Capture or regenerate</p>
            <p className="text-xs text-muted-foreground">
              Provide a description and optional notes to guide the agent.
            </p>
          </div>
          <Badge variant="outline" className="uppercase">
            Requirements
          </Badge>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Ticket description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain the problem, constraints, and goal."
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes for agent (optional)</Label>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Links, constraints, examples, stakeholders"
            />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={
                busy ||
                (!description.trim() &&
                  !ticket.latestRequirements?.payload.source.raw_description.trim())
              }
              onClick={() =>
                onRun({
                  description:
                    description.trim().length > 0 ? description.trim() : undefined,
                  notes: notes.trim() || undefined,
                })
              }
              className="gap-2"
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Running agent...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate requirements
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanView({ ticket }: { ticket: TicketRecord }) {
  const plan = ticket.latestPlan?.payload;
  if (!plan) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No plan yet. Capture requirements first, then run planning from the API.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">Plan {plan.plan_id}</Badge>
        <Badge variant="outline">v{plan.plan_version}</Badge>
        <Badge variant="muted">Risk {plan.overall_risk_level}</Badge>
        <Badge variant="muted">Complexity {plan.overall_complexity}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{plan.summary}</p>

      <div className="grid gap-3 md:grid-cols-2">
        {plan.assumptions.length > 0 && (
          <div className="rounded-md border border-border/70 bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Assumptions
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {plan.assumptions.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {plan.risks.length > 0 && (
          <div className="rounded-md border border-border/70 bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Risks
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {plan.risks.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border/70 bg-card/60 p-3">
        <p className="text-sm font-semibold mb-2">Steps</p>
        <div className="space-y-2">
          {plan.steps.length ? (
            plan.steps.map((step) => (
              <div
                key={step.id}
                className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{step.id}</Badge>
                  <Badge variant="muted">{step.kind}</Badge>
                  <Badge variant="muted">{step.owner_role}</Badge>
                  <Badge variant="muted">Risk {step.risk_level}</Badge>
                  {step.requires_review && <Badge variant="outline">Review</Badge>}
                </div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {step.description}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No steps defined.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExecutionView({ ticket }: { ticket: TicketRecord }) {
  if (!ticket.executionResults.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No execution runs yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ticket.executionResults.map((run, index) => (
        <div
          key={run.run_id ?? run.generated_at ?? index}
          className="rounded-md border border-border/70 bg-muted/30 p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              {run.payload.summary || `Execution #${index + 1}`}
            </div>
            <Badge variant="outline">{run.payload.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Generated {formatDate(run.generated_at)}
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Handled steps</p>
            {run.payload.handled_steps.length ? (
              <ul className="space-y-2">
                {run.payload.handled_steps.map((step) => (
                  <li
                    key={step.step_id}
                    className="rounded-md border border-border/60 bg-card/50 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{step.step_id}</Badge>
                      <Badge variant="muted">
                        {step.previous_status} {"->"} {step.new_status}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {step.work_summary}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No handled steps recorded.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function QaView({ ticket }: { ticket: TicketRecord }) {
  if (!ticket.qaReports.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No QA reports yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ticket.qaReports.map((report, index) => (
        <div
          key={report.run_id ?? report.generated_at ?? index}
          className="rounded-md border border-border/70 bg-muted/30 p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {report.payload.summary}
            </div>
            <Badge variant="outline">{report.payload.overall_status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Generated {formatDate(report.generated_at)}
          </p>
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Issues</p>
            {report.payload.issues_found.length ? (
              <ul className="space-y-2">
                {report.payload.issues_found.map((issue) => (
                  <li
                    key={issue.id}
                    className="rounded-md border border-border/60 bg-card/50 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{issue.id}</Badge>
                      <Badge variant="muted">{issue.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {issue.description}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No issues reported.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketDetailPanel({
  ticket,
  onCaptureRequirements,
  busy,
}: {
  ticket: TicketRecord;
  onCaptureRequirements: (payload: { description?: string; notes?: string }) => void;
  busy: boolean;
}) {
  const [activeTab, setActiveTab] = useState<StageKey>(
    ticket.latestRequirements ? "requirements" : "plan",
  );

  useEffect(() => {
    setActiveTab(ticket.latestRequirements ? "requirements" : "plan");
  }, [ticket.ticketId, ticket.latestRequirements]);

  return (
    <div className="space-y-4">
      <TicketOverviewBar ticket={ticket} />

      <div className="flex flex-wrap gap-2 text-xs">
        {["requirements", "plan", "execution", "qa"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab as StageKey)}
            className="capitalize"
          >
            {tab}
          </Button>
        ))}
      </div>

      {activeTab === "requirements" && (
        <StageCard
          title="Requirements"
          subtitle="Capture crisp requirements and acceptance criteria."
          icon={ClipboardList}
          status={
            ticket.latestRequirements
              ? `Last updated ${formatDate(ticket.latestRequirements.generated_at)}`
              : "Not captured"
          }
        >
          <RequirementsView
            ticket={ticket}
            onRun={onCaptureRequirements}
            busy={busy}
          />
        </StageCard>
      )}

      {activeTab === "plan" && (
        <StageCard
          title="Plan"
          subtitle="Execution blueprint with steps, risks, and assumptions."
          icon={Brain}
          status={ticket.latestPlan ? "Ready" : "Awaiting requirements"}
        >
          <PlanView ticket={ticket} />
        </StageCard>
      )}

      {activeTab === "execution" && (
        <StageCard
          title="Execution"
          subtitle="Agent runs and handled steps."
          icon={Rocket}
          status={`${ticket.executionResults.length} runs`}
        >
          <ExecutionView ticket={ticket} />
        </StageCard>
      )}

      {activeTab === "qa" && (
        <StageCard
          title="QA Reports"
          subtitle="Checks, issues, and recommendations."
          icon={ShieldCheck}
          status={`${ticket.qaReports.length} reports`}
        >
          <QaView ticket={ticket} />
        </StageCard>
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  isSelected,
  onSelect,
}: {
  ticket: TicketRecord;
  isSelected: boolean;
  onSelect: (projectId: string, ticketId: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(ticket.projectId, ticket.ticketId)}
      className={`flex w-full items-start justify-between rounded-lg border px-4 py-3 text-left transition ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50 hover:bg-muted/40"
      }`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="h-4 w-4" /> {ticket.ticketId}
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {formatDate(ticket.updatedAt)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant={ticket.latestRequirements ? "default" : "muted"}>
          {ticket.latestRequirements ? "Active" : "New"}
        </Badge>
        <p className="text-[11px] text-muted-foreground">{ticket.projectId}</p>
      </div>
    </button>
  );
}

function ProjectQuestions({
  projectId,
  questions,
  onAsk,
}: {
  projectId?: string;
  questions: AskRecord[];
  onAsk: (projectId: string, text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft("");
  }, [projectId]);

  if (!projectId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Q&A</CardTitle>
          <CardDescription>Select a project to ask questions.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const items = questions;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project Q&A</CardTitle>
        <CardDescription>
          Capture questions or notes for the team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Question or note</Label>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about scope, risks, stakeholders..."
            className="min-h-[90px]"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-2"
              disabled={!draft.trim()}
              onClick={async () => {
                if (!draft.trim()) return;
                await onAsk(projectId, draft.trim());
                setDraft("");
              }}
            >
              <Send className="h-4 w-4" /> Save note
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Recent entries
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {items
                .slice()
                .reverse()
                .map((item) => (
                  <div
                    key={item.askId}
                    className="rounded-md border border-border/60 bg-muted/30 p-3"
                  >
                    <p className="text-sm text-foreground">{item.question}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TicketDashboard() {
  const { tickets, selectedTicket, loading, error } = useTicketStore();
  const { projects, loadProjects, projectsById } = useProjectStore();
  const createTicket = useTicketStore((state) => state.createTicket);
  const selectTicket = useTicketStore((state) => state.selectTicket);
  const runRequirements = useTicketStore((state) => state.runRequirements);
  const loadTickets = useTicketStore((state) => state.loadTickets);
  const { asksByProject, loadAsks, createAsk } = useAskStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [ticketQuery, setTicketQuery] = useState("");

  useEffect(() => {
    void loadTickets();
    void loadProjects();
  }, [loadTickets, loadProjects]);

  useEffect(() => {
    if (projects.length && !selectedProjectId) {
      setSelectedProjectId(projects[0].projectId);
    }
  }, [projects, selectedProjectId]);

  const ticketsByProject = useMemo(() => {
    return tickets.reduce<Record<string, TicketRecord[]>>((acc, ticket) => {
      if (!acc[ticket.projectId]) acc[ticket.projectId] = [];
      acc[ticket.projectId].push(ticket);
      return acc;
    }, {});
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const base = selectedProjectId
      ? tickets.filter((t) => t.projectId === selectedProjectId)
      : tickets;
    const query = ticketQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter((ticket) => ticket.ticketId.toLowerCase().includes(query));
  }, [tickets, ticketQuery, selectedProjectId]);

  const selectedProject =
    selectedProjectId && projectsById[selectedProjectId]
      ? projectsById[selectedProjectId]
      : projects.find((p) => p.projectId === selectedProjectId);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadAsks(selectedProjectId);
  }, [selectedProjectId, loadAsks]);

  const handleAskQuestion = async (projectId: string, text: string) => {
    await createAsk(projectId, text);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Folder className="h-4 w-4" /> Projects
              </CardTitle>
              <CardDescription>
                Switch contexts and keep questions per project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void loadProjects();
                    void loadTickets();
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
                {selectedProject && (
                  <Badge variant="outline" className="text-xs">
                    <MessageCircle className="h-3 w-3" /> {selectedProject.name}
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No projects yet. Create a ticket to bootstrap a project.
                  </p>
                ) : (
                  projects.map((project) => {
                    const count = ticketsByProject[project.projectId]?.length ?? 0;
                    return (
                      <button
                        key={project.projectId}
                        onClick={() => setSelectedProjectId(project.projectId)}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                          project.projectId === selectedProjectId
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{project.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {project.projectId}
                          </p>
                        </div>
                        <Badge variant="muted">{count} tickets</Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <ProjectQuestions
            projectId={selectedProjectId}
            questions={selectedProjectId ? asksByProject[selectedProjectId] ?? [] : []}
            onAsk={handleAskQuestion}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4" /> Tickets
                </CardTitle>
                <CardDescription>
                  Create and explore tickets inside the selected project.
                </CardDescription>
              </div>
              {selectedProject && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {selectedProject.name}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={ticketQuery}
                    onChange={(event) => setTicketQuery(event.target.value)}
                    placeholder="Search tickets..."
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (!selectedProjectId) return;
                      void createTicket(selectedProjectId);
                    }}
                    disabled={loading || !selectedProjectId}
                    className="gap-1"
                  >
                    <MessageSquarePlus className="h-4 w-4" /> Create
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">
                    Total tickets
                  </p>
                  <p className="text-lg font-semibold">{filteredTickets.length}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">
                    With requirements
                  </p>
                  <p className="text-lg font-semibold">
                    {
                      filteredTickets.filter((t) => Boolean(t.latestRequirements))
                        .length
                    }
                  </p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">
                    With plans
                  </p>
                  <p className="text-lg font-semibold">
                    {filteredTickets.filter((t) => Boolean(t.latestPlan)).length}
                  </p>
                </div>
              </div>

              {filteredTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tickets.length === 0
                    ? "No tickets yet. Create the first one."
                    : "No tickets match this project/search."}
                </p>
              ) : (
                <div className="grid gap-2 lg:grid-cols-2">
                  {filteredTickets.map((ticket) => (
                    <TicketRow
                      key={ticket.ticketId}
                      ticket={ticket}
                      isSelected={selectedTicket?.ticketId === ticket.ticketId}
                      onSelect={(projectId, ticketId) =>
                        void selectTicket(projectId, ticketId)
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {selectedTicket ? (
            <TicketDetailPanel
              key={selectedTicket.ticketId}
              ticket={selectedTicket}
              busy={loading}
              onCaptureRequirements={(payload) =>
                runRequirements(selectedTicket.projectId, selectedTicket.ticketId, payload)
              }
            />
          ) : (
            <Card className="border-dashed border-border/70">
              <CardContent className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                <Layers className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select or create a ticket to see details.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
