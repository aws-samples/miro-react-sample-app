#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MiroAppStack } from "../lib/miro-app-stack";

const app = new cdk.App();
new MiroAppStack(app, "MiroAppStack", {
  bedrockRegion: "us-east-1",
  bedrockModelId: "anthropic.claude-instant-v1",
});
