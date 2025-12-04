# EC2 DNS Update - Project Summary

## What This Does

Automatically updates Route 53 DNS A records when EC2 instances start, ensuring domain names always point to the current public IP address of your instances.

## Architecture Overview

```
EC2 Instance Starts (eu-west-2)
    ↓
EventBridge Rule (detects state change to 'running')
    ↓
Lambda Function
    ↓
1. Query DynamoDB for instance mapping
2. Get instance public IP from EC2 API
3. Update Route 53 A record
```

## Key Components

| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **DynamoDB Table** | Stores instance_id → domain_name + hosted_zone_id mappings | On-demand billing, PITR enabled, RETAIN policy |
| **Lambda Function** | Orchestrates the DNS update process | Node.js 22.x, 30s timeout, X-Ray enabled |
| **EventBridge Rule** | Triggers Lambda on EC2 state change to 'running' | Monitors eu-west-2 only |

## IAM Permissions

The Lambda function has least-privilege permissions:

- **DynamoDB**: Read-only access to the mapping table
- **EC2**: `DescribeInstances` scoped to eu-west-2 region only
- **Route 53**: `ChangeResourceRecordSets` and `GetChange` for all hosted zones (Route 53 is global)
- **X-Ray**: Standard tracing permissions

## Region Configuration

**Deployed to**: eu-west-2 (London)
**Monitors**: EC2 instances in eu-west-2 only

This is intentional for simplicity. If you need to monitor instances in other regions, you have two options:
1. Deploy this stack to each region
2. Set up cross-region EventBridge event forwarding

## DNS Record Configuration

- **Record Type**: A record
- **TTL**: 300 seconds (5 minutes)
- **Action**: UPSERT (creates if doesn't exist, updates if it does)

## Files Created

```
ec2_dns_update/
├── bin/
│   └── ec2_dns_update.ts          # CDK app entry point
├── lib/
│   └── ec2_dns_update-stack.ts    # Main stack definition
├── src/
│   └── lambda/
│       └── updateDnsRecord/
│           └── index.ts           # Lambda function code
├── scripts/
│   ├── add-mapping.sh             # Helper to add DynamoDB mappings
│   └── test-event.json            # Sample EventBridge event for testing
├── cdk.json                       # CDK configuration
├── README.md                      # User documentation
├── DEPLOYMENT.md                  # Deployment guide
└── PROJECT_SUMMARY.md             # This file
```

## Next Steps

1. **Deploy**: `npx cdk deploy`
2. **Add Mappings**: Use `scripts/add-mapping.sh` to populate the DynamoDB table
3. **Test**: Start an EC2 instance and verify the DNS record updates
4. **Monitor**: Check CloudWatch Logs and X-Ray traces

## Cost Considerations

- **DynamoDB**: Pay-per-request pricing (very low for this use case)
- **Lambda**: Free tier covers most usage (1M requests/month free)
- **EventBridge**: Free for AWS service events
- **Route 53**: $0.40 per million queries + $0.50 per hosted zone/month
- **CloudWatch Logs**: 7-day retention, minimal cost

Expected monthly cost: < $1 for typical usage (excluding Route 53 hosted zone costs)
