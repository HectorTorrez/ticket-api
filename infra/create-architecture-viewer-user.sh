#!/usr/bin/env bash
# Creates IAM user "architecture-viewer" for read-only access to present the Tide Tickets AWS stack.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-180294216289}"
USER_NAME="architecture-viewer"
POLICY_NAME="TideTicketsArchitectureViewer"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${SCRIPT_DIR}/architecture-viewer-policy.json"

echo "==> Creating IAM policy ${POLICY_NAME} (if missing)"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
if aws iam get-policy --policy-arn "${POLICY_ARN}" >/dev/null 2>&1; then
  echo "    Policy already exists: ${POLICY_ARN}"
else
  POLICY_ARN="$(aws iam create-policy \
    --policy-name "${POLICY_NAME}" \
    --policy-document "file://${POLICY_FILE}" \
    --description "Read-only access to Tide Tickets architecture (VPC, ALB, ASG, RDS, S3, CloudFront, CloudWatch)" \
    --query Policy.Arn \
    --output text)"
  echo "    Created: ${POLICY_ARN}"
fi

echo "==> Creating IAM user ${USER_NAME} (if missing)"
if aws iam get-user --user-name "${USER_NAME}" >/dev/null 2>&1; then
  echo "    User already exists"
else
  aws iam create-user \
    --user-name "${USER_NAME}" \
    --tags Key=Purpose,Value=architecture-presentation Key=Project,Value=tidetickets
  echo "    Created user ${USER_NAME}"
fi

echo "==> Attaching policy to user"
aws iam attach-user-policy \
  --user-name "${USER_NAME}" \
  --policy-arn "${POLICY_ARN}"

echo "==> Enabling AWS Console login (password reset required on first sign-in)"
if aws iam get-login-profile --user-name "${USER_NAME}" >/dev/null 2>&1; then
  echo "    Login profile already exists (skipping password creation)"
else
  TEMP_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)"
  aws iam create-login-profile \
    --user-name "${USER_NAME}" \
    --password "${TEMP_PASSWORD}" \
    --password-reset-required
  echo ""
  echo "    Console URL : https://${ACCOUNT_ID}.signin.aws.amazon.com/console"
  echo "    Username    : ${USER_NAME}"
  echo "    Temp password (save now — shown once): ${TEMP_PASSWORD}"
  echo ""
fi

echo "==> Creating programmatic access key (if none exists)"
EXISTING_KEYS="$(aws iam list-access-keys --user-name "${USER_NAME}" --query 'length(AccessKeyMetadata)' --output text)"
if [[ "${EXISTING_KEYS}" != "0" ]]; then
  echo "    User already has ${EXISTING_KEYS} access key(s). Skipping new key."
  echo "    List with: aws iam list-access-keys --user-name ${USER_NAME}"
else
  KEY_JSON="$(aws iam create-access-key --user-name "${USER_NAME}")"
  ACCESS_KEY_ID="$(echo "${KEY_JSON}" | jq -r '.AccessKey.AccessKeyId')"
  SECRET_ACCESS_KEY="$(echo "${KEY_JSON}" | jq -r '.AccessKey.SecretAccessKey')"
  echo ""
  echo "    AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}"
  echo "    AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}"
  echo "    (save now — secret shown once)"
  echo ""
fi

echo "Done. User ${USER_NAME} can browse the architecture in Console or CLI (region ${REGION})."
