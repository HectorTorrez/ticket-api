#!/usr/bin/env bash
# Deploy Tide Tickets infrastructure to AWS (us-east-1)
# Requires: AWS CLI authenticated, Docker for API image push
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
STACK_NAME="${STACK_NAME:-ticket-platform-prod}"
CERT_ARN="${CERT_ARN:-arn:aws:acm:us-east-1:180294216289:certificate/3786ab52-2089-4fc7-9383-28b084d3949e}"
FRONTEND_BUCKET="${FRONTEND_BUCKET:-tidetickets-frontend-${ACCOUNT_ID}}"
ASSETS_BUCKET="${ASSETS_BUCKET:-tidetickets-assets-${ACCOUNT_ID}}"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/ticket-api"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CFN_TEMPLATE="${ROOT_DIR}/infra/cloudformation/ticket-platform.yaml"

if [[ -z "${DB_PASSWORD:-}" ]]; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)"
  echo "Generated DB_PASSWORD (save this): ${DB_PASSWORD}"
fi
if [[ -z "${JWT_ACCESS_SECRET:-}" ]]; then
  JWT_ACCESS_SECRET="$(openssl rand -base64 32)"
  echo "Generated JWT_ACCESS_SECRET (save this): ${JWT_ACCESS_SECRET}"
fi
if [[ -z "${JWT_REFRESH_SECRET:-}" ]]; then
  JWT_REFRESH_SECRET="$(openssl rand -base64 32)"
  echo "Generated JWT_REFRESH_SECRET (save this): ${JWT_REFRESH_SECRET}"
fi

echo "==> Uploading CloudFormation template"
aws s3 cp "${CFN_TEMPLATE}" "s3://${ASSETS_BUCKET}/cloudformation/ticket-platform.yaml" --region "${REGION}"

echo "==> Deploying stack ${STACK_NAME}"
if aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" >/dev/null 2>&1; then
  aws cloudformation update-stack \
    --region "${REGION}" \
    --stack-name "${STACK_NAME}" \
    --template-url "https://${ASSETS_BUCKET}.s3.${REGION}.amazonaws.com/cloudformation/ticket-platform.yaml" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameters \
      ParameterKey=CertificateArn,ParameterValue="${CERT_ARN}" \
      ParameterKey=DbPassword,ParameterValue="${DB_PASSWORD}" \
      ParameterKey=JwtAccessSecret,ParameterValue="${JWT_ACCESS_SECRET}" \
      ParameterKey=JwtRefreshSecret,ParameterValue="${JWT_REFRESH_SECRET}" \
      ParameterKey=AssetsBucketName,ParameterValue="${ASSETS_BUCKET}"
else
  aws cloudformation create-stack \
    --region "${REGION}" \
    --stack-name "${STACK_NAME}" \
    --template-url "https://${ASSETS_BUCKET}.s3.${REGION}.amazonaws.com/cloudformation/ticket-platform.yaml" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameters \
      ParameterKey=CertificateArn,ParameterValue="${CERT_ARN}" \
      ParameterKey=DbPassword,ParameterValue="${DB_PASSWORD}" \
      ParameterKey=JwtAccessSecret,ParameterValue="${JWT_ACCESS_SECRET}" \
      ParameterKey=JwtRefreshSecret,ParameterValue="${JWT_REFRESH_SECRET}" \
      ParameterKey=AssetsBucketName,ParameterValue="${ASSETS_BUCKET}"
fi

echo "==> Waiting for stack (15-20 min for RDS)..."
aws cloudformation wait stack-create-complete --region "${REGION}" --stack-name "${STACK_NAME}" 2>/dev/null \
  || aws cloudformation wait stack-update-complete --region "${REGION}" --stack-name "${STACK_NAME}"

echo "==> Building and pushing API image"
cd "${ROOT_DIR}"
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
docker build -t ticket-api .
docker tag ticket-api:latest "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"

echo "==> Refreshing ASG instance"
ASG_NAME="$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='AsgName'].OutputValue" --output text)"
aws autoscaling start-instance-refresh --region "${REGION}" --auto-scaling-group-name "${ASG_NAME}" --preferences '{"MinHealthyPercentage": 0, "InstanceWarmup": 300}'

ALB_DNS="$(aws cloudformation describe-stacks --region "${REGION}" --stack-name "${STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='AlbDnsName'].OutputValue" --output text)"
echo ""
echo "Stack deployed."
echo "ALB DNS: ${ALB_DNS}"
echo "Add Cloudflare CNAME api -> ${ALB_DNS} (DNS only)"
