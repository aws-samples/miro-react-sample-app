import { MiddyfiedHandler } from "@middy/core";
import { Method } from "@middy/http-router";

export const API_ROUTE_BASE_PATH = "/v1";

export interface Route {
  method: Method;
  path: string;
  handler: MiddyfiedHandler;
}

export interface MiroAuthorizerContext {
  team: string; // ID of the Miro team that the JWT is assigned to
  user: string; //ID of the Miro user that the JWT is assigned to
}
