export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "AutoWorker API",
    version: "1.0.0",
    description: "API for managing agents and tickets in AutoWorker.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local server",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy",
          },
        },
      },
    },
    "/api/agents": {
      get: {
        summary: "List agents",
        responses: {
          "200": {
            description: "List of agents",
          },
        },
      },
      post: {
        summary: "Create agent",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                },
                required: ["name", "role"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Agent created",
          },
          "400": {
            description: "Invalid input",
          },
        },
      },
    },
    "/api/agents/{id}": {
      get: {
        summary: "Get agent details",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Agent details",
          },
          "404": {
            description: "Agent not found",
          },
        },
      },
    },
    "/api/agents/{id}/assign-ticket": {
      post: {
        summary: "Assign ticket to agent",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ticketId: { type: "string" },
                },
                required: ["ticketId"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Ticket assignment result",
          },
          "400": {
            description: "Invalid input",
          },
          "404": {
            description: "Agent or ticket not found",
          },
        },
      },
    },
    "/api/agents/{id}/plan": {
      get: {
        summary: "Get current plan for agent",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Current plan",
          },
          "404": {
            description: "Agent or plan not found",
          },
        },
      },
      post: {
        summary: "Generate plan for agent",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ticketId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generated plan",
          },
          "400": {
            description: "Invalid input",
          },
          "404": {
            description: "Agent or ticket not found",
          },
          "500": {
            description: "Failed to generate plan",
          },
        },
      },
    },
    "/api/tickets": {
      get: {
        summary: "List tickets",
        responses: {
          "200": {
            description: "List of tickets",
          },
        },
      },
      post: {
        summary: "Create ticket",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                },
                required: ["title", "description"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Ticket created",
          },
          "400": {
            description: "Invalid input",
          },
        },
      },
    },
    "/api/tickets/{id}": {
      get: {
        summary: "Get ticket details",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Ticket details",
          },
          "404": {
            description: "Ticket not found",
          },
        },
      },
    },
  },
  components: {},
};
