#!/bin/bash

# Watch DNS changes for a domain in both public DNS (1.1.1.1) and Route 53
# Usage: ./watch-dns.sh <domain-name> <hosted-zone-id>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <domain-name> <hosted-zone-id>"
    echo "Example: $0 server.example.com Z1234567890ABC"
    exit 1
fi

DOMAIN=$1
ZONE_ID=$2

echo "Watching DNS changes for: $DOMAIN"
echo "Route 53 Zone ID: $ZONE_ID"
echo "Press Ctrl+C to stop"
echo ""
echo "$(date '+%Y-%m-%d %H:%M:%S') | Public DNS (1.1.1.1) | Route 53 Record"
echo "-------------------------------------------------------------------"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    # Query public DNS using 1.1.1.1
    PUBLIC_IP=$(dig +short @1.1.1.1 "$DOMAIN" A | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n1)
    if [ -z "$PUBLIC_IP" ]; then
        PUBLIC_IP="(no record)"
    fi

    # Query Route 53 for A record
    R53_A=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$ZONE_ID" \
        --query "ResourceRecordSets[?Name=='${DOMAIN}.' && Type=='A'].ResourceRecords[*].Value" \
        --output text 2>&1)

    # Query Route 53 for CNAME record
    R53_CNAME=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$ZONE_ID" \
        --query "ResourceRecordSets[?Name=='${DOMAIN}.' && Type=='CNAME'].ResourceRecords[*].Value" \
        --output text 2>&1)

    if [ ! -z "$R53_A" ] && [ "$R53_A" != "None" ] && [ "$R53_A" != "" ]; then
        R53_IP=$(echo "$R53_A" | tr '\t' ',' | tr '\n' ',')
        R53_IP="${R53_IP%,} (A)"
    elif [ ! -z "$R53_CNAME" ] && [ "$R53_CNAME" != "None" ] && [ "$R53_CNAME" != "" ]; then
        R53_IP=$(echo "$R53_CNAME" | tr '\t' ',' | tr '\n' ',')
        R53_IP="${R53_IP%,} (CNAME)"
    else
        R53_IP="(no record)"
    fi

    echo "$TIMESTAMP | $PUBLIC_IP | $R53_IP"

    sleep 5
done
