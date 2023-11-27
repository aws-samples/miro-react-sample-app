import middy from "@middy/core";
import { API_ROUTE_BASE_PATH, MiroAuthorizerContext, Route } from "../types";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockRegion = process.env.BEDROCK_REGION ?? "";
const bedrockModelId = process.env.BEDROCK_MODEL_ID ?? "";

const client = new BedrockRuntimeClient({ region: bedrockRegion });

export const summarizeRoutes: Route[] = [
  {
    method: "POST",
    path: `${API_ROUTE_BASE_PATH}/summarize`,
    handler: middy(postSummarize),
  },
];

async function postSummarize(event: {
  body: string;
  requestContext: { authorizer: MiroAuthorizerContext };
}) {
  const { text } = JSON.parse(event.body);
  const { team, user } = event.requestContext.authorizer;
  console.log(`Summarizing text for team ${team} and user ${user}`);

  try {
    const command = new InvokeModelCommand({
      modelId: bedrockModelId,
      contentType: "application/json",
      accept: "*/*",
      body: JSON.stringify({
        prompt: `\n\nHuman: Summarize following text:\n"${text}"\n\nAssistant:`,
        max_tokens_to_sample: 500,
        temperature: 0.5,
        top_k: 250,
        top_p: 1,
        stop_sequences: ["\\n\\nHuman:"],
        anthropic_version: "bedrock-2023-05-31",
      }),
    });

    const result = await client.send(command);
    const summaryStr = result.body.transformToString("utf-8");
    const { completion } = JSON.parse(summaryStr) as { completion: string };
    console.log(summaryStr);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, data: completion.trim() }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error }),
    };
  }
}
