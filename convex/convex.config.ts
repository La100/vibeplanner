import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";
import rag from "@convex-dev/rag/convex.config";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(r2);
app.use(prosemirrorSync);
app.use(rag);
app.use(agent);

export default app; 