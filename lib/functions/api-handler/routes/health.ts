import middy from "@middy/core";
import { API_ROUTE_BASE_PATH, Route } from "../types";

export const healthRoutes: Route[] = [
  {
    method: "GET",
    path: `${API_ROUTE_BASE_PATH}/health`,
    handler: middy(getHealth),
  },
];

function getHealth() {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
}
