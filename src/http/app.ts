import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { generateOpenApiDocument } from "./openapi.js";
import { registerRoutes } from "./routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  registerRoutes(app);

  const openApiSpec = generateOpenApiDocument();

  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "AutoWorker API Docs",
    }),
  );

  app.get("/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  return app;
}
