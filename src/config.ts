import "dotenv/config";

export interface CodexConfig {
  model: string | undefined;
  sandboxMode: string | undefined;
  approvalPolicy: string | undefined;
  workingDirectory: string | undefined;
  networkAccessEnabled: boolean | undefined;
  webSearchEnabled: boolean | undefined;
}

export interface AppConfig {
  port: number;
  codex: CodexConfig;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  return value.toLowerCase() === "true";
}

function getPort(): number {
  const raw = process.env.PORT ?? "3000";
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 3000 : parsed;
}

export const config: AppConfig = {
  port: getPort(),
  codex: {
    model: process.env.CODEX_MODEL,
    sandboxMode: process.env.CODEX_SANDBOX,
    approvalPolicy: process.env.CODEX_APPROVAL,
    workingDirectory: process.env.CODEX_WORKDIR,
    networkAccessEnabled: parseBoolean(process.env.CODEX_NETWORK_ENABLED),
    webSearchEnabled: parseBoolean(process.env.CODEX_WEBSEARCH_ENABLED),
  },
};

