import { httpRouter } from "convex/server";
import handleClerkWebhook from "./clerk";

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: handleClerkWebhook,
});

export default http; 