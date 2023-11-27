import {
  Context,
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
} from "aws-lambda";
import { verify, Jwt, JwtPayload } from "jsonwebtoken";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";

const secretId = process.env.SECRET_ID ?? "";
const xOriginVerifySecretId = process.env.X_ORIGIN_VERIFY_SECRET_ID ?? "";

interface MiroJwtToken extends Jwt {
  payload: MiroJwtTokenPayload;
}

interface MiroJwtTokenPayload extends JwtPayload {
  team: string; // ID of the Miro team that the JWT is assigned to
  user: string; //ID of the Miro user that the JWT is assigned to
}

export async function handler(
  event: APIGatewayRequestAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> {
  const secretValue = await getSecret(secretId, {
    maxAge: 300,
  });

  const xOriginVerifySecretValue = await getSecret(xOriginVerifySecretId, {
    maxAge: 300,
  });

  if (
    !event.headers ||
    !secretValue ||
    typeof secretValue !== "string" ||
    typeof xOriginVerifySecretValue !== "string"
  ) {
    return generatePolicy("user", "Deny", event.methodArn);
  }

  const secretJson = JSON.parse(secretValue);
  const xOriginVerifySecretJson = JSON.parse(xOriginVerifySecretValue);
  const clientSecrets: string[] = secretJson?.clientSecrets;
  const xOriginVerifyValue: string = xOriginVerifySecretJson?.headerValue;

  const authHeader = event.headers["Authorization"] ?? "";
  const xOriginVerifyHeader = event.headers["X-Origin-Verify"] ?? "";

  if (xOriginVerifyHeader !== xOriginVerifyValue) {
    return generatePolicy("user", "Deny", event.methodArn);
  }

  const headerParts = authHeader.split(" ");
  if (headerParts.length === 2) {
    const jwtToken: string = authHeader.split(" ")[1];
    for (let clientSecret of clientSecrets) {
      try {
        const decoded = verify(jwtToken, clientSecret ?? "", {
          issuer: "miro",
          algorithms: ["HS256"],
        }) as MiroJwtToken;

        console.log(decoded);
        return generatePolicy("user", "Allow", event.methodArn, decoded);
      } catch (err) {
        console.log(err);
      }
    }
  }

  return generatePolicy("user", "Deny", event.methodArn);
}

function generatePolicy(
  principalId: string,
  effect: string,
  resource: string,
  context?: any
) {
  const policy = {
    principalId: principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };

  return policy;
}
