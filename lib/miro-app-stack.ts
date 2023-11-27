import { Construct } from "constructs";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import { Utils } from "./common/utils";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3Deployment from "aws-cdk-lib/aws-s3-deployment";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as secretManager from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface MiroAppStackProps extends cdk.StackProps {
  bedrockRegion: string;
  bedrockModelId: string;
}

export class MiroAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MiroAppStackProps) {
    super(scope, id, props);

    /*
    {
      "clientSecrets": ["FIST_APP_SECRET", "SECOND_APP_SECRET"]
    }
   */
    const miroAppSecret = new secretManager.Secret(this, "MiroAppSecret");

    const assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const originAccessIdentity = new cf.OriginAccessIdentity(this, "S3OAI");
    assetsBucket.grantRead(originAccessIdentity);

    const xOriginVerifySecret = new secretsmanager.Secret(
      this,
      "X-Origin-Verify-Secret",
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        generateSecretString: {
          excludePunctuation: true,
          generateStringKey: "headerValue",
          secretStringTemplate: "{}",
        },
      }
    );

    const authFunction = new lambdaNodeJs.NodejsFunction(this, "AuthFunction", {
      entry: path.join(__dirname, "./functions/authorizer/index.ts"),
      architecture: lambda.Architecture.X86_64,
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        LOG_LEVEL: "DEBUG",
        SECRET_ID: miroAppSecret.secretName,
        X_ORIGIN_VERIFY_SECRET_ID: xOriginVerifySecret.secretName,
      },
    });

    miroAppSecret.grantRead(authFunction);
    xOriginVerifySecret.grantRead(authFunction);

    const apiHandler = new lambdaNodeJs.NodejsFunction(
      this,
      "ApiHandlerFunction",
      {
        entry: path.join(__dirname, "./functions/api-handler/index.ts"),
        architecture: lambda.Architecture.X86_64,
        logRetention: logs.RetentionDays.ONE_DAY,
        timeout: cdk.Duration.seconds(60),
        environment: {
          LOG_LEVEL: "DEBUG",
          BEDROCK_REGION: props.bedrockRegion,
          BEDROCK_MODEL_ID: props.bedrockModelId,
        },
      }
    );

    apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    const authorizer = new apigateway.RequestAuthorizer(
      this,
      "APIGWAuthorizer",
      {
        handler: authFunction,
        identitySources: [apigateway.IdentitySource.header("Authorization")],
        resultsCacheTtl: cdk.Duration.seconds(0),
      }
    );

    const restApi = new apigateway.RestApi(this, "ApiGateway", {
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      cloudWatchRole: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date"],
        maxAge: cdk.Duration.minutes(10),
      },
      deploy: true,
      defaultMethodOptions: {
        authorizer,
      },
      deployOptions: {
        stageName: "api",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true,
        metricsEnabled: true,
        throttlingRateLimit: 2500,
      },
    });

    const v1Resource = restApi.root.addResource("v1");
    const v1ProxyResource = v1Resource.addResource("{proxy+}");
    v1ProxyResource.addMethod(
      "ANY",
      new apigateway.LambdaIntegration(apiHandler, {
        proxy: true,
      })
    );

    const distribution = new cf.CloudFrontWebDistribution(
      this,
      "Distirbution",
      {
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        priceClass: cf.PriceClass.PRICE_CLASS_ALL,
        httpVersion: cf.HttpVersion.HTTP2_AND_3,
        originConfigs: [
          {
            behaviors: [{ isDefaultBehavior: true }],
            s3OriginSource: {
              s3BucketSource: assetsBucket,
              originAccessIdentity,
            },
          },
          {
            behaviors: [
              {
                pathPattern: "/api/*",
                allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                defaultTtl: cdk.Duration.seconds(0),
                forwardedValues: {
                  queryString: true,
                  headers: [
                    "Referer",
                    "Origin",
                    "Authorization",
                    "Content-Type",
                    "x-forwarded-user",
                    "Access-Control-Request-Headers",
                    "Access-Control-Request-Method",
                  ],
                },
              },
            ],
            customOriginSource: {
              domainName: `${restApi.restApiId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}`,
              originHeaders: {
                "X-Origin-Verify": xOriginVerifySecret
                  .secretValueFromJson("headerValue")
                  .unsafeUnwrap(),
              },
            },
          },
        ],
        errorConfigurations: [
          {
            errorCode: 404,
            errorCachingMinTtl: 0,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    const appPath = path.join(__dirname, "..", "react-app");
    const buildPath = path.join(appPath, "dist");

    const asset = s3Deployment.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          process.arch === "x64"
            ? "public.ecr.aws/sam/build-nodejs18.x:latest"
            : "public.ecr.aws/sam/build-nodejs18.x:latest-arm64"
        ),
        command: [
          "sh",
          "-c",
          [
            "npm --cache /tmp/.npm install",
            `npm --cache /tmp/.npm run build`,
            "cp -aur /asset-input/build/* /asset-output/",
          ].join(" && "),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: "inherit",
                env: {
                  ...process.env,
                },
              };

              execSync(`npm --silent --prefix "${appPath}" ci`, options);
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
              Utils.copyDirRecursive(buildPath, outputDir);
            } catch (e) {
              console.error(e);
              return false;
            }

            return true;
          },
        },
      },
    });

    new s3Deployment.BucketDeployment(this, "bucket-deployment", {
      sources: [asset],
      destinationBucket: assetsBucket,
      distribution,
    });

    // ###################################################
    // Outputs
    // ###################################################
    new cdk.CfnOutput(this, "SecretName", {
      value: miroAppSecret.secretName,
    });

    new cdk.CfnOutput(this, "DomainName", {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
