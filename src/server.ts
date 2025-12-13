import { config } from "./config.js";
import { createApp } from "./http/app.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`AutoWorker API listening on port ${config.port}`);
});
