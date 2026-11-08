#!/usr/bin/env bash
# Creates (or reuses) the Lightsail resources for FreelanceFlow AI. Safe to run again:
# every step checks for an existing resource first and never deletes anything.
#
#   deploy/provision.sh            # instance, key pair, static IP, firewall, DNS record
#   ADMIN_CIDR=1.2.3.4/32 deploy/provision.sh   # restrict SSH to a different admin IP
#
# Billable: one small_3_0 instance (USD 12/month). The static IP is free while attached.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/config.sh

log() { printf '\n==> %s\n' "$*"; }

log "AWS identity"
aws sts get-caller-identity --query Arn --output text
echo "Region: $AWS_DEFAULT_REGION"

log "Bundle $BUNDLE_ID"
aws lightsail get-bundles --query "bundles[?bundleId=='$BUNDLE_ID'].[bundleId,price,cpuCount,ramSizeInGb,diskSizeInGb]" --output text

log "SSH key pair"
if [[ ! -f "$SSH_KEY" ]]; then
  ssh-keygen -t rsa -b 4096 -N "" -C "$KEY_PAIR_NAME" -f "$SSH_KEY" >/dev/null
  echo "Created $SSH_KEY"
fi
if ! aws lightsail get-key-pair --key-pair-name "$KEY_PAIR_NAME" >/dev/null 2>&1; then
  aws lightsail import-key-pair --key-pair-name "$KEY_PAIR_NAME" --public-key-base64 "$(cat "$SSH_KEY.pub")" >/dev/null
  echo "Imported $KEY_PAIR_NAME"
else
  echo "Key pair $KEY_PAIR_NAME exists"
fi

log "Instance $INSTANCE_NAME"
if ! aws lightsail get-instance --instance-name "$INSTANCE_NAME" >/dev/null 2>&1; then
  aws lightsail create-instances \
    --instance-names "$INSTANCE_NAME" \
    --availability-zone "$AVAILABILITY_ZONE" \
    --blueprint-id "$BLUEPRINT_ID" \
    --bundle-id "$BUNDLE_ID" \
    --key-pair-name "$KEY_PAIR_NAME" \
    --ip-address-type dualstack \
    --tags key=project,value=freelanceflow key=environment,value=production key=purpose,value=paypal-ai-hackathon-2026 \
    --query 'operations[0].status' --output text
fi
for _ in $(seq 1 60); do
  state=$(aws lightsail get-instance --instance-name "$INSTANCE_NAME" --query 'instance.state.name' --output text)
  [[ "$state" == "running" ]] && break
  sleep 5
done
echo "State: $state"

log "Static IP $STATIC_IP_NAME"
if ! aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" >/dev/null 2>&1; then
  aws lightsail allocate-static-ip --static-ip-name "$STATIC_IP_NAME" >/dev/null
fi
attached_to=$(aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" --query 'staticIp.attachedTo' --output text)
if [[ "$attached_to" != "$INSTANCE_NAME" ]]; then
  aws lightsail attach-static-ip --static-ip-name "$STATIC_IP_NAME" --instance-name "$INSTANCE_NAME" >/dev/null
fi
IP=$(aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" --query 'staticIp.ipAddress' --output text)
echo "Static IP: $IP"

log "Firewall (80, 443 public; 22 restricted)"
ADMIN_CIDR="${ADMIN_CIDR:-$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32}"
aws lightsail put-instance-public-ports --instance-name "$INSTANCE_NAME" --port-infos \
  "fromPort=80,toPort=80,protocol=tcp,cidrs=0.0.0.0/0,ipv6Cidrs=::/0" \
  "fromPort=443,toPort=443,protocol=tcp,cidrs=0.0.0.0/0,ipv6Cidrs=::/0" \
  "fromPort=443,toPort=443,protocol=udp,cidrs=0.0.0.0/0,ipv6Cidrs=::/0" \
  "fromPort=22,toPort=22,protocol=tcp,cidrs=$ADMIN_CIDR,cidrListAliases=lightsail-connect" >/dev/null
echo "SSH allowed from $ADMIN_CIDR and the Lightsail browser console"

log "DNS A record $APP_DOMAIN → $IP (Route 53)"
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$HOSTED_ZONE_NAME" --query "HostedZones[?Name=='$HOSTED_ZONE_NAME.'].Id" --output text | sed 's#/hostedzone/##')
[[ -n "$ZONE_ID" ]] || { echo "Hosted zone $HOSTED_ZONE_NAME not found" >&2; exit 1; }
current=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?Name=='$APP_DOMAIN.' && Type=='A'].ResourceRecords[0].Value" --output text)
if [[ "$current" == "$IP" ]]; then
  echo "Record already points to $IP"
else
  # UPSERT touches only this one name; no other records in the zone are changed.
  aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "{
    \"Comment\": \"FreelanceFlow AI production\",
    \"Changes\": [{\"Action\": \"UPSERT\", \"ResourceRecordSet\": {
      \"Name\": \"$APP_DOMAIN\", \"Type\": \"A\", \"TTL\": 300,
      \"ResourceRecords\": [{\"Value\": \"$IP\"}]}}]}" --query 'ChangeInfo.Status' --output text
fi

log "Done. Next: deploy/server-setup (via deploy/deploy.sh --setup), then deploy/deploy.sh"
