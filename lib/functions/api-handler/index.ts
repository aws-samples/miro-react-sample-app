import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import httpCors from "@middy/http-cors";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpRouterHandler from "@middy/http-router";
import httpUrlEncodeBodyParser from "@middy/http-urlencode-body-parser";
import httpUrlEncodePathParser from "@middy/http-urlencode-path-parser";
import inputOutputLogger from "@middy/input-output-logger";
import { Route } from "./types";
import { healthRoutes } from "./routes/health";
import { summarizeRoutes } from "./routes/summarize";

const routes: Route[] = [...healthRoutes, ...summarizeRoutes];

export const handler = middy(httpRouterHandler(routes))
  .use(inputOutputLogger())
  .use(errorLogger())
  .use(httpCors())
  .use(httpHeaderNormalizer())
  .use(httpUrlEncodePathParser())
  .use(httpUrlEncodeBodyParser())
  .use(httpJsonBodyParser());
