#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/ticket-api"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Logging in to ECR (${ACCOUNT_ID})"
aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "==> Building image"
cd "${ROOT_DIR}"
docker build -t ticket-api:latest .

echo "==> Pushing ${ECR_URI}:latest"
docker tag ticket-api:latest "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"

echo "==> Refreshing ASG instances"
ASG_NAME="${ASG_NAME:-ticket-api-asg}"
aws autoscaling start-instance-refresh \
  --region "${REGION}" \
  --auto-scaling-group-name "${ASG_NAME}" \
  --preferences '{"MinHealthyPercentage": 0, "InstanceWarmup": 300}'

echo "Done. Image pushed and instance refresh started."
