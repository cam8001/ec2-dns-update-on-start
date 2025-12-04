# Deployment Guide

## Prerequisites

1. AWS CLI configured with credentials for eu-west-2
2. Node.js and npm installed
3. CDK CLI installed (`npm install -g aws-cdk`)
4. esbuild installed globally (already confirmed: v0.24.0)

## Deployment Steps

### 1. Bootstrap CDK (if not already done)

```bash
npx cdk bootstrap aws://ACCOUNT-ID/eu-west-2
```

Replace `ACCOUNT-ID` with your AWS account ID.

### 2. Deploy the Stack

```bash
cd ec2_dns_update
npx cdk deploy
```

Review the changes and confirm when prompted.

### 3. Note the Outputs

After deployment, note the following outputs:
- `DnsMappingTableName` - You'll need this to add mappings
- `UpdateDnsFunctionName` - Useful for testing and monitoring

### 4. Add Instance Mappings

Use the helper script to add your instance-to-domain mappings:

```bash
./scripts/add-mapping.sh <DnsMappingTableName> <instance-id> <domain-name> <hosted-zone-id>
```

Example:
```bash
./scripts/add-mapping.sh \
  Ec2DnsUpdateStack-DnsMappingTable3874E75D-ABCD1234 \
  i-0123456789abcdef0 \
  myserver.example.com \
  Z1234567890ABC
```

Or manually via AWS CLI:
```bash
aws dynamodb put-item \
  --table-name <DnsMappingTableName> \
  --item '{
    "instance_id": {"S": "i-0123456789abcdef0"},
    "domain_name": {"S": "myserver.example.com"},
    "hosted_zone_id": {"S": "Z1234567890ABC"}
  }' \
  --region eu-west-2
```

## Testing

### Manual Lambda Test

You can test the Lambda function manually using the test event:

1. Edit `scripts/test-event.json` and replace the instance ID with one of your instances
2. Invoke the Lambda:

```bash
aws lambda invoke \
  --function-name <UpdateDnsFunctionName> \
  --payload file://scripts/test-event.json \
  --region eu-west-2 \
  response.json

cat response.json
```

### Test with Real Instance

1. Stop an EC2 instance that has a mapping in the DynamoDB table
2. Start the instance
3. Check CloudWatch Logs for the Lambda function
4. Verify the Route 53 record was updated:

```bash
aws route53 list-resource-record-sets \
  --hosted-zone-id <your-zone-id> \
  --query "ResourceRecordSets[?Name=='myserver.example.com.']"
```

## Monitoring

### CloudWatch Logs

View Lambda logs:
```bash
aws logs tail /aws/lambda/<UpdateDnsFunctionName> --follow --region eu-west-2
```

### X-Ray Traces

The Lambda function has X-Ray tracing enabled. View traces in the AWS Console:
- Navigate to X-Ray → Traces
- Filter by the Lambda function name

## Troubleshooting

### Lambda Not Triggering

1. Check EventBridge rule is enabled:
```bash
aws events describe-rule --name <rule-name> --region eu-west-2
```

2. Verify the instance is in eu-west-2 (this stack only monitors that region)

### DNS Not Updating

1. Check Lambda logs for errors
2. Verify the instance has a public IP address
3. Confirm the hosted zone ID is correct
4. Check IAM permissions for the Lambda function

### No Mapping Found

Verify the mapping exists in DynamoDB:
```bash
aws dynamodb get-item \
  --table-name <DnsMappingTableName> \
  --key '{"instance_id": {"S": "i-0123456789abcdef0"}}' \
  --region eu-west-2
```

## Cleanup

To remove all resources:

```bash
npx cdk destroy
```

Note: The DynamoDB table has a `RETAIN` deletion policy, so it will not be automatically deleted. Delete it manually if needed:

```bash
aws dynamodb delete-table --table-name <DnsMappingTableName> --region eu-west-2
```
