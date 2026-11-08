# Shared settings for the local deployment scripts (sourced, not executed).
# Override any value with an environment variable of the same name.

: "${AWS_PROFILE:=hayaitech}"
: "${AWS_DEFAULT_REGION:=us-east-1}"
export AWS_PROFILE AWS_DEFAULT_REGION

: "${APP_DOMAIN:=freelanceflow.hayaix.tech}"
: "${HOSTED_ZONE_NAME:=hayaix.tech}"

: "${INSTANCE_NAME:=freelanceflow-prod}"
: "${STATIC_IP_NAME:=freelanceflow-prod-ip}"
: "${KEY_PAIR_NAME:=freelanceflow-prod-key}"
: "${BUNDLE_ID:=small_3_0}"          # 2 vCPU, 2 GB RAM, 60 GB SSD, 3 TB transfer, USD 12/month
: "${BLUEPRINT_ID:=ubuntu_24_04}"
: "${AVAILABILITY_ZONE:=us-east-1a}"

: "${SSH_KEY:=$HOME/.ssh/freelanceflow-prod}"
: "${SSH_USER:=ubuntu}"
: "${REMOTE_DIR:=/opt/freelanceflow}"

ssh_opts=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)

# Address used for SSH: the static IP (works before DNS propagates).
deploy_host() {
  if [[ -n "${DEPLOY_HOST:-}" ]]; then echo "$DEPLOY_HOST"; return; fi
  aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" --query 'staticIp.ipAddress' --output text
}
