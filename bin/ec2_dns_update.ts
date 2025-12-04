#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Ec2DnsUpdateStack } from '../lib/ec2_dns_update-stack';

const app = new cdk.App();

// Deploy to eu-west-2 where the EC2 instances are located
new Ec2DnsUpdateStack(app, 'Ec2DnsUpdateStack', {
  env: {
    region: 'eu-west-2'
  },
  description: 'Automatically updates Route 53 DNS records when EC2 instances start'
});
