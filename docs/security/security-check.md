# Security Check

## Network

- SSH source IP is restricted to /32.
- HTTP is exposed for the learning environment.
- Application port 8000 is not exposed externally.
- PostgreSQL port 5432 is not exposed externally.
- Docker frontend/backend networks are separated.

## IAM

- EC2 uses an IAM Role / Instance Profile.
- Static AWS access keys are not stored on EC2.
- S3 backup permissions are limited to required operations.

## S3

- Public Access Block is enabled.
- Server-side encryption is enabled.
- Versioning is enabled.

## Secrets

- .env is excluded from Git.
- PEM private keys are excluded from Git.
- Passwords and tokens are not intentionally written to application logs.

## Application

- SQLAlchemy ORM / parameterized queries are used.
- Pydantic input validation is used.
- RBAC is implemented.
- Passwords are stored as hashes.
- Basic HTTP security headers are configured in Nginx.

## Vulnerability Management

- OS security updates are checked/applied.
- Python dependencies are checked with pip-audit.
- Container/base image versions are reviewed.

## DDoS / WAF

- Shield Standard is relied upon where applicable.
- Shield Advanced is not used.
- AWS WAF is not used in this learning environment.

## Known Gaps

- HTTPS/TLS is not yet implemented in the current Public-IP-based Phase1 environment.
- Application non-root container execution may remain a future improvement.
- ECR image scanning is deferred until ECR is introduced.
