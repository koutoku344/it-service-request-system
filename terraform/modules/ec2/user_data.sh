#!/bin/bash
set -euxo pipefail

dnf update -y
dnf install -y docker

systemctl enable docker
systemctl start docker

usermod -aG docker ec2-user

mkdir -p /usr/local/lib/docker/cli-plugins

COMPOSE_VERSION="v2.39.1"

curl -SL   "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64"   -o /usr/local/lib/docker/cli-plugins/docker-compose

chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p /opt/it-service-request-system
chown -R ec2-user:ec2-user /opt/it-service-request-system
