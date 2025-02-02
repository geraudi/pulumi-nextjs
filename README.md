# Deploy a NextJS application on AWS using Pulumi

## What is this?
This is an example of how to deploy a NextJS application (v15) on AWS using Pulumi and OpenNext (v3).


*This is a work in progress.*

## Based on
- Open Next (v3) - https://opennext.js.org/aws/inner_workings/architecture
- Pulumi nextjs example: https://www.pulumi.com/registry/packages/aws/how-to-guides/aws-ts-nextjs/



## Get Started

[Get started with Pulumi and Aws](https://www.pulumi.com/docs/iac/get-started/aws/)

```
cd nextjs-app
npm i
rm -rf .open-next && npx open-next@latest build
cd ../pulumi
pulumi up
```

