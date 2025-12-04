#!/bin/bash

# Helper script to add instance-to-domain mappings to DynamoDB
# Usage: ./add-mapping.sh <table-name> <instance-id> <domain-name> <hosted-zone-id>

if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <table-name> <instance-id> <domain-name> <hosted-zone-id>"
    echo "Example: $0 Ec2DnsUpdateStack-DnsMappingTable i-1234567890abcdef0 server.example.com Z1234567890ABC"
    exit 1
fi

TABLE_NAME=$1
INSTANCE_ID=$2
DOMAIN_NAME=$3
HOSTED_ZONE_ID=$4

echo "Adding mapping to DynamoDB:"
echo "  Instance ID: $INSTANCE_ID"
echo "  Domain Name: $DOMAIN_NAME"
echo "  Hosted Zone ID: $HOSTED_ZONE_ID"
echo ""

aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --item "{
    \"instance_id\": {\"S\": \"$INSTANCE_ID\"},
    \"domain_name\": {\"S\": \"$DOMAIN_NAME\"},
    \"hosted_zone_id\": {\"S\": \"$HOSTED_ZONE_ID\"}
  }" \
  --region eu-west-2

if [ $? -eq 0 ]; then
    echo "✓ Mapping added successfully"
else
    echo "✗ Failed to add mapping"
    exit 1
fi
