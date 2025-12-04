import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Route53Client, ChangeResourceRecordSetsCommand, ListResourceRecordSetsCommand } from '@aws-sdk/client-route-53';

const ec2Client = new EC2Client({ region: process.env.AWS_REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const route53Client = new Route53Client({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.TABLE_NAME!;
const RECORD_TTL = parseInt(process.env.RECORD_TTL || '300');

interface DnsMapping {
  instance_id: string;
  domain_name: string;
  hosted_zone_id: string;
}

export const handler = async (event: any): Promise<void> => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  const instanceId = event.detail['instance-id'];
  console.log(`Processing instance: ${instanceId}`);

  // Look up the domain mapping in DynamoDB
  const getCommand = new GetCommand({
    TableName: TABLE_NAME,
    Key: { instance_id: instanceId }
  });

  const result = await dynamoClient.send(getCommand);

  if (!result.Item) {
    console.log(`No DNS mapping found for instance ${instanceId}`);
    return;
  }

  const mapping = result.Item as DnsMapping;
  console.log(`Found mapping: ${mapping.domain_name} -> ${instanceId}`);

  // Get the public IP of the instance
  const describeCommand = new DescribeInstancesCommand({
    InstanceIds: [instanceId]
  });

  const instanceData = await ec2Client.send(describeCommand);
  const instance = instanceData.Reservations?.[0]?.Instances?.[0];

  if (!instance?.PublicIpAddress) {
    console.log(`No public IP found for instance ${instanceId}`);
    return;
  }

  const publicIp = instance.PublicIpAddress;
  console.log(`Instance public IP: ${publicIp}`);

  // Get existing records for this domain name
  const listRecordsCommand = new ListResourceRecordSetsCommand({
    HostedZoneId: mapping.hosted_zone_id,
    StartRecordName: mapping.domain_name,
    MaxItems: 10
  });

  const existingRecords = await route53Client.send(listRecordsCommand);
  const existingRecord = existingRecords.ResourceRecordSets?.find(
    r => r.Name === `${mapping.domain_name}.` && (r.Type === 'A' || r.Type === 'CNAME' || r.Type === 'AAAA')
  );

  const changes: any[] = [];

  // If any record exists, delete it first
  if (existingRecord) {
    console.log(`Found existing ${existingRecord.Type} record, will delete it`);
    changes.push({
      Action: 'DELETE',
      ResourceRecordSet: existingRecord
    });
  }

  // Add the A record
  changes.push({
    Action: 'UPSERT',
    ResourceRecordSet: {
      Name: mapping.domain_name,
      Type: 'A',
      TTL: RECORD_TTL,
      ResourceRecords: [{ Value: publicIp }]
    }
  });

  // Execute the change batch
  const changeCommand = new ChangeResourceRecordSetsCommand({
    HostedZoneId: mapping.hosted_zone_id,
    ChangeBatch: { Changes: changes }
  });

  const changeResult = await route53Client.send(changeCommand);
  console.log(`Route 53 update successful. Change ID: ${changeResult.ChangeInfo?.Id}`);
  console.log(`Updated ${mapping.domain_name} to point to ${publicIp}`);
};
