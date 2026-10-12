import "./shared/env.js";

import { app } from "./app.js";
import { assertProductionConfig } from "./shared/config.js";

assertProductionConfig();

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
