param(
  [string]$StackName = 'unison-import-preview',
  [string]$Region = $env:AWS_REGION,
  [string]$PreviewBaseDomain,
  [string]$CertificateArn,
  [string]$AppOrigin = 'https://www.unisontasks.com',
  [string]$SupabaseUrl = 'https://nfrdomdvyrbwuokathtw.supabase.co',
  [string]$SupabasePublishableKey = $env:VITE_SUPABASE_PUBLISHABLE_KEY
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw 'AWS CLI v2 is required. Install/configure it, then rerun this script.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker is required to build the gateway and worker images.'
}
if (-not $Region -or -not $PreviewBaseDomain -or -not $CertificateArn -or -not $SupabasePublishableKey) {
  throw 'Set AWS_REGION, VITE_SUPABASE_PUBLISHABLE_KEY and provide PreviewBaseDomain plus CertificateArn.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$template = Join-Path $PSScriptRoot 'template.yaml'
$sourceRevision = (git rev-parse --short HEAD 2>$null)
if (-not $sourceRevision) { $sourceRevision = 'local' }
$imageTag = "$(Get-Date -Format 'yyyyMMddHHmmss')-$sourceRevision"
$parameters = @(
  "PreviewBaseDomain=$PreviewBaseDomain",
  "CertificateArn=$CertificateArn",
  "AppOrigin=$AppOrigin",
  "SupabaseUrl=$SupabaseUrl",
  "SupabasePublishableKey=$SupabasePublishableKey",
  "GatewayImageTag=$imageTag",
  "WorkerImageTag=$imageTag"
)

Push-Location $repoRoot
try {
  aws cloudformation describe-stacks --stack-name $StackName --region $Region *> $null
  $stackExists = $LASTEXITCODE -eq 0
  if (-not $stackExists) {
    aws cloudformation deploy `
      --template-file $template `
      --stack-name $StackName `
      --region $Region `
      --capabilities CAPABILITY_IAM `
      --parameter-overrides @parameters "GatewayDesiredCount=0"
    if ($LASTEXITCODE -ne 0) { throw 'CloudFormation bootstrap failed.' }
  }

  $gatewayRepository = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='GatewayRepositoryUri'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw 'Could not read the gateway ECR repository.' }
  $workerRepository = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='WorkerRepositoryUri'].OutputValue | [0]" --output text
  if ($LASTEXITCODE -ne 0) { throw 'Could not read the worker ECR repository.' }
  $accountId = aws sts get-caller-identity --query Account --output text
  if ($LASTEXITCODE -ne 0) { throw 'AWS credentials are not configured.' }

  aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$accountId.dkr.ecr.$Region.amazonaws.com"
  if ($LASTEXITCODE -ne 0) { throw 'ECR login failed.' }

  docker build -f services/import-preview-worker/Dockerfile.gateway -t "${gatewayRepository}:${imageTag}" services/import-preview-worker
  if ($LASTEXITCODE -ne 0) { throw 'Gateway image build failed.' }
  docker push "${gatewayRepository}:${imageTag}"
  if ($LASTEXITCODE -ne 0) { throw 'Gateway image push failed.' }

  docker build -f services/import-preview-worker/Dockerfile.worker -t "${workerRepository}:${imageTag}" services/import-preview-worker
  if ($LASTEXITCODE -ne 0) { throw 'Worker image build failed.' }
  docker push "${workerRepository}:${imageTag}"
  if ($LASTEXITCODE -ne 0) { throw 'Worker image push failed.' }

  aws cloudformation deploy `
    --template-file $template `
    --stack-name $StackName `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides @parameters "GatewayDesiredCount=1"
  if ($LASTEXITCODE -ne 0) { throw 'Gateway service deployment failed.' }

  $gatewayUrl = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='GatewayUrl'].OutputValue | [0]" --output text
  $albDns = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDnsName'].OutputValue | [0]" --output text
  Write-Host "Preview gateway: $gatewayUrl"
  Write-Host "Create DNS CNAME records for api.$PreviewBaseDomain and *.$PreviewBaseDomain pointing to $albDns"
  Write-Host "Set PREVIEW_GATEWAY_URL=$gatewayUrl in the Vercel server environment, then redeploy the app."
} finally {
  Pop-Location
}