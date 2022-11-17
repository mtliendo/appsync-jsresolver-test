import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { aws_appsync as appsync, CfnOutput } from 'aws-cdk-lib'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'

import * as path from 'path'
import * as fs from 'fs'
import {
	Effect,
	PolicyStatement,
	Role,
	ServicePrincipal,
} from 'aws-cdk-lib/aws-iam'

export class AppsyncJsresolverTestStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props)

		const todoTable = new Table(this, 'TodoDB', {
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			billingMode: BillingMode.PAY_PER_REQUEST,
			partitionKey: { name: 'id', type: AttributeType.STRING },
		})

		const cfnGraphQLApi = new appsync.CfnGraphQLApi(this, 'MyCfnGraphQLApi', {
			authenticationType: 'API_KEY',
			name: 'JS Resolver API',
		})

		const appsyncServiceRole = new Role(this, 'appsyncServiceRole', {
			assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
		})

		appsyncServiceRole.addToPolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['dynamodb:GetItem', 'dynamodb:Scan'],
				resources: [todoTable.tableArn],
			})
		)

		const cfnApiKey = new appsync.CfnApiKey(this, 'MyCfnApiKey', {
			apiId: cfnGraphQLApi.attrApiId,
		})

		const cfnGraphQLSchema = new appsync.CfnGraphQLSchema(
			this,
			'SampleSchema',
			{
				apiId: cfnGraphQLApi.attrApiId,
				definition: fs.readFileSync(
					path.join(__dirname, 'schema.graphql'),
					'utf8'
				),
			}
		)

		const todoTableDS = new appsync.CfnDataSource(this, 'MyCfnDataSource', {
			name: 'todoTableDS',
			apiId: cfnGraphQLApi.attrApiId,
			type: 'AMAZON_DYNAMODB',
			dynamoDbConfig: {
				awsRegion: 'us-east-1',
				tableName: todoTable.tableName,
			},
			serviceRoleArn: appsyncServiceRole.roleArn,
		})

		const getTodoFunction = new appsync.CfnFunctionConfiguration(
			this,
			'MyCfnFunctionConfiguration',
			{
				name: 'getTodoFunction',
				apiId: cfnGraphQLApi.attrApiId,
				dataSourceName: todoTableDS.attrName,
				functionVersion: '2018-05-29',
			}
		)

		getTodoFunction.addOverride('Properties.Runtime.Name', 'APPSYNC_JS')
		getTodoFunction.addOverride('Properties.Runtime.RuntimeVersion', '1.0.0')
		getTodoFunction.addOverride(
			'Properties.Code',
			fs.readFileSync(path.join(__dirname, '/getTodoMappings.js'), 'utf8')
		)

		const todoResolver = new appsync.CfnResolver(this, 'TodoResolver', {
			apiId: cfnGraphQLApi.attrApiId,
			typeName: 'Query',
			fieldName: 'getTodo',
			kind: 'PIPELINE',
			pipelineConfig: {
				functions: [getTodoFunction.attrFunctionId],
			},
		})

		todoResolver.addDependsOn(getTodoFunction)

		todoResolver.addOverride('Properties.Runtime.Name', 'APPSYNC_JS')
		todoResolver.addOverride('Properties.Runtime.RuntimeVersion', '1.0.0')
		todoResolver.addOverride(
			'Properties.Code',
			fs.readFileSync(path.join(__dirname, '/pipelineMappings.js'), 'utf8')
		)

		new CfnOutput(this, 'GRAPHQL_URL', {
			value: cfnGraphQLApi.attrGraphQlUrl,
		})
		new CfnOutput(this, 'GRAPHQL_APIKEY', {
			value: cfnApiKey.attrApiKey,
		})
	}
}
