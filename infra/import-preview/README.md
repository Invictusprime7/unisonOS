# Isolated imported preview worker

This stack runs uploaded Node/Vite projects in one non-root Fargate task per preview session. It does not route imported source through canonical Sandpack preparation or App Builder. The current worker adapter supports TanStack Start, React + Vite, and Vue + Vite with npm, pnpm, Yarn, or Bun; other frameworks remain blocked until a compatible adapter is added.

## Prerequisites

- AWS CLI v2 credentials with permission to create CloudFormation, VPC, ALB, ECS/Fargate, ECR, IAM, CloudWatch Logs, and S3 resources.
- Docker Desktop running locally, or another Docker engine, to build and push the two images.
- An ACM certificate in the deployment region covering `api.<PreviewBaseDomain>` and `*.<PreviewBaseDomain>`.
- DNS control for `api.<PreviewBaseDomain>` and `*.<PreviewBaseDomain>`.
- A preview domain on a registrable domain **different from Unison**. This gives each preview a separate browser origin, so the imported app can use its own storage without receiving Unison cookies.
- `VITE_SUPABASE_PUBLISHABLE_KEY` set in the shell. No Supabase secret/service key is used by this worker.

The current execution environment has neither working AWS CLI credentials nor a running Docker daemon, so deployment has not been attempted here.

## Deploy

From the repository root, set `AWS_REGION` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then run:

```powershell
./infra/import-preview/deploy.ps1 `
  -PreviewBaseDomain your-isolated-preview-domain.example `
  -CertificateArn arn:aws:acm:REGION:ACCOUNT:certificate/CERTIFICATE_ID
```

The script creates the stack with zero gateway tasks, builds and pushes immutable image tags, and then starts one gateway. Add CNAME records for `api.<PreviewBaseDomain>` and `*.<PreviewBaseDomain>` pointing to the ALB DNS name printed by the script. Set `PREVIEW_GATEWAY_URL` to the printed gateway URL in the Vercel server environment and redeploy the app.

The ALB and gateway are public; worker tasks receive public egress so package managers can install the imported project’s dependencies. Worker security groups accept inbound preview traffic only from the gateway. Each worker task has no ECS task role, no Supabase credentials, and a 30-minute lifetime. The separate VPC contains no application database or other Unison services. Public outbound access is still available to imported build scripts; do not inject secrets into imported projects or worker environments.

## Operations

The gateway keeps session routing in memory and is intentionally configured as a single ECS task. A gateway restart invalidates active preview URLs; the worker tasks self-terminate after their TTL. S3 source bundles are private, encrypted at rest, and expire after one day. The worker task’s dependency installation and app process run inside that task; they never execute in the Unison/Vercel process.