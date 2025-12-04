import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

// This stack is designed to run in eu-west-2 where the EC2 instances are located.
// The Lambda function monitors EC2 instance state changes in this region and updates
// Route 53 DNS records accordingly.
export class Ec2DnsUpdateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table to store instance_id -> domain_name + hosted_zone_id mappings
    const mappingTable = new dynamodb.Table(this, 'DnsMappingTable', {
      partitionKey: {
        name: 'instance_id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      }
    });

    // Lambda function to update DNS records
    const updateDnsFunction = new nodejs.NodejsFunction(this, 'UpdateDnsFunction', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'handler',
      entry: path.join(__dirname, '../src/lambda/updateDnsRecord/index.ts'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: mappingTable.tableName,
        RECORD_TTL: '60'
      },
      tracing: lambda.Tracing.ACTIVE,
      logGroup: new logs.LogGroup(this, 'UpdateDnsFunctionLogGroup', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }),
      bundling: {
        externalModules: ['@aws-sdk/*'],
        minify: true
      }
    });

    // Grant Lambda permissions to read from DynamoDB
    mappingTable.grantReadData(updateDnsFunction);

    // Grant Lambda permissions to describe EC2 instances in eu-west-2
    updateDnsFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ec2:DescribeInstances'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'aws:RequestedRegion': 'eu-west-2'
        }
      }
    }));

    // Grant Lambda permissions to update Route 53 records
    // Note: Route 53 is a global service, so we scope by account only
    updateDnsFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'route53:ListResourceRecordSets',
        'route53:ChangeResourceRecordSets',
        'route53:GetChange'
      ],
      resources: [
        `arn:aws:route53:::hostedzone/*`,
        `arn:aws:route53:::change/*`
      ]
    }));

    // EventBridge rule to trigger on EC2 instance state change to 'running'
    const instanceStateRule = new events.Rule(this, 'InstanceStateRule', {
      eventPattern: {
        source: ['aws.ec2'],
        detailType: ['EC2 Instance State-change Notification'],
        detail: {
          state: ['running']
        }
      }
    });

    instanceStateRule.addTarget(new targets.LambdaFunction(updateDnsFunction));

    // Outputs
    new cdk.CfnOutput(this, 'DnsMappingTableName', {
      value: mappingTable.tableName,
      description: 'DynamoDB table name for instance-to-domain mappings'
    });

    new cdk.CfnOutput(this, 'UpdateDnsFunctionName', {
      value: updateDnsFunction.functionName,
      description: 'Lambda function name for DNS updates'
    });
  }
}
