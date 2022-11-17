#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { AppsyncJsresolverTestStack } from '../lib/appsync-jsresolver-test-stack'

const app = new cdk.App()
new AppsyncJsresolverTestStack(app, 'AppsyncJsresolverTestStack', {})
