# Phase1 System Test

## Infrastructure
- [ ] Terraform validate succeeded
- [ ] Terraform plan has no unintended changes
- [ ] EC2 starts successfully
- [ ] SSH access works
- [ ] Docker containers start successfully
- [ ] Docker frontend/backend networks are correct
- [ ] Only Nginx port 80 is externally exposed

## Health
- [ ] GET /health returns 200
- [ ] GET /health/db returns 200
- [ ] PostgreSQL is healthy
- [ ] Alembic current revision equals head revision

## Authentication / Authorization
- [ ] POST /auth/login succeeds with valid credentials
- [ ] Protected API rejects unauthenticated access
- [ ] Invalid token is rejected
- [ ] General user cannot access administrator APIs
- [ ] Administrator can access administrator APIs

## Request Function
- [ ] Request creation succeeds
- [ ] Invalid request returns 422
- [ ] Request is persisted in PostgreSQL
- [ ] Request list works if implemented
- [ ] Request detail works if implemented
- [ ] Nonexistent request returns 404 if detail API is implemented

## Workflow
- [ ] Approval works if implemented
- [ ] Rejection works if implemented
- [ ] Comment works if implemented
- [ ] Cancellation works if implemented
- [ ] State changes are persisted in PostgreSQL

## Persistence
- [ ] Data survives PostgreSQL container restart
- [ ] Data survives Docker Compose down/up
- [ ] Data survives EC2 reboot

## Backup / Restore
- [ ] Backup succeeds
- [ ] Backup object exists in S3
- [ ] Restore succeeds
- [ ] API works after restore

## Monitoring / Logging
- [ ] CloudWatch Agent is running
- [ ] CloudWatch Log Groups exist
- [ ] CloudWatch Alarms exist
- [ ] Nginx logs are available
- [ ] Application logs are available
- [ ] PostgreSQL logs are available
- [ ] Secrets are not intentionally written to logs

## Security
- [ ] SSH is restricted to the permitted /32 address
- [ ] Port 8000 is not externally exposed
- [ ] Port 5432 is not externally exposed
- [ ] Security headers are returned
- [ ] Input validation works
- [ ] RBAC works

## Performance
- [ ] Health endpoint responds successfully in repeated tests
- [ ] Simple response-time test completed
- [ ] No errors occurred in 50 sequential health requests

## Failure / Recovery
- [ ] Application stop causes an expected error response
- [ ] Application recovery restores service
- [ ] PostgreSQL stop causes DB health failure
- [ ] PostgreSQL recovery restores DB health

## Known Phase1 Limitations
- HTTPS/TLS is not yet implemented
- Multi-AZ is not implemented
- Physical server/container host redundancy is not implemented
- Automatic scaling is not implemented
- AWS WAF is not implemented
- ECR image scanning is deferred until ECR is introduced