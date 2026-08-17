# IT Service Request System

社内IT部門に対する問い合わせ・申請業務を想定した、IT Service Request Systemの設計・構築プロジェクトとする。

本プロジェクトでは、Applicationの実装だけでなく、業務要件・機能要件・非機能要件の整理、Architecture設計、Technology選定、Infrastructure構築、Monitoring、Backup、Securityまでを一連のSystem Designとして実施する。

また、Architecture Decision Record（ADR）を使用し、採用した構成だけでなく、代替案との比較、Trade-offおよび再評価条件を記録する。


## 1. システム概要

本システムは、社内IT部門に対する問い合わせ・申請業務をWeb上で受け付け、一元的に管理することを目的とする。

従来、メールやチャット等の複数経路で実施される問い合わせ・申請をWebへ集約し、受付、回答、承認、履歴管理等をSystem上で実施可能とする。

主な利用者は以下とする。

- 一般ユーザー
- 業務担当者
- システム管理者


## 2. 設計上の前提

本システムは、小規模な学習・検証環境として設計する。

Production Systemとして最大限の可用性・性能・Securityを実現することではなく、定義したRequirementsを満たしながら、構成および運用の複雑性を必要最小限とすることを基本方針とする。

そのため、初期構成では以下を対象外とする。

- Multi-AZによる物理冗長化
- Auto Scaling
- Application / Databaseの物理分離
- HTTPS
- AWS WAF
- 外部Identity Providerとの連携
- 24時間365日の運用監視
- Alarm発生時の外部通知

これらについては、System規模、可用性、Security、運用等のRequirementsが変化した場合にArchitectureを再評価する。


## 3. 設計・構築範囲

本プロジェクトでは以下を対象とする。

- 業務要件・機能要件・非機能要件の整理
- Architecture設計
- Architecture Decision RecordによるTechnology・方式選定
- TerraformによるAWS Infrastructure構築
- Docker / Docker ComposeによるApplication実行環境構築
- FastAPI / PostgreSQLによるApplication構築
- Authentication / Authorization
- Network分離
- Security設定
- Monitoring / Logging
- Backup / Restore
- System Test
- Git / GitHubによるSource CodeおよびDocument管理


## 4. 主な機能要件

本システムでは、問い合わせ・申請業務を中心として以下の機能を提供する。

### 4.1 問い合わせ

- 問い合わせの受付
- 問い合わせ内容の管理
- 問い合わせへの回答
- 対応履歴の管理

### 4.2 申請・承認

- IT Serviceに関する申請の受付
- 申請内容の管理
- 申請の承認・差戻し
- 処理履歴の管理

### 4.3 ユーザー・認証

- ユーザー認証
- ユーザー情報の管理
- Roleに基づくAccess Control

### 4.4 管理

- ユーザー管理
- Role管理
- 各種管理機能

機能要件の詳細については、`business-and-functional-requirements.md`を参照する。


## 5. 主な非機能要件

初期構成では、小規模な学習・検証環境として以下を主要な非機能要件とする。

| 項目 | 要件 |
|---|---|
| 同時利用者数 | 最大20名 |
| Response Time | 通常操作3秒以内を目標 |
| Availability | 99%以上 |
| RTO | 1日以内 |
| RPO | 1日以内 |
| Redundancy | 初期構成では物理冗長化を必須としない |
| Scaling | 初期構成ではAuto Scalingを必須としない |
| Infrastructure | AWS |
| Infrastructure Management | Terraform |

現在のRequirementsを満たすことに加え、現在必要としていない構成要素を追加せず、構成および運用の複雑性を必要最小限とすることをArchitecture設計の基本方針とする。

非機能要件の詳細については、`non-functional-requirements.md`を参照する。


## 6. Technology Stack

本システムで使用する主なTechnologyは以下とする。

| Category | Technology |
|---|---|
| Cloud | AWS |
| Compute | Amazon EC2 |
| Container | Docker / Docker Compose |
| Web | Nginx |
| Application | Python / FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| Schema Migration | Alembic |
| Storage | Amazon EBS |
| Backup | pg_dump / Amazon S3 |
| Monitoring | Amazon CloudWatch / CloudWatch Agent |
| Infrastructure as Code | Terraform |
| Version Control | Git / GitHub |

Technologyの採用理由、代替案との比較、Trade-offおよび再評価条件については、Architecture設計書および各ADRを参照する。


## 7. システム構成

初期構成では、AWS上の単一Amazon EC2にNginx、FastAPI Application、PostgreSQLをDocker Containerとして配置する。

```text
Internet
   |
   | HTTP : 80
   v
Security Group
   |
   v
Amazon EC2
   |
   ├─ Nginx Container
   │       |
   │       v
   ├─ FastAPI Application Container
   │       |
   │       v
   └─ PostgreSQL Container
           |
           v
      Docker Volume
           |
           v
          EBS

Amazon EC2
   |
   └────────> Amazon CloudWatch
                Metrics / Logs / Alarms

PostgreSQL
   |
   └────────> Amazon S3
                Backup
```

Web、Application、Databaseは単一EC2へ物理的に集約する一方で、ContainerおよびDocker Networkにより責務と通信経路を論理的に分離する。

現在の性能・可用性要件では物理冗長化やAuto Scalingを必須としないため、初期構成では構成の単純性を優先する。

Architectureの詳細および各Technologyの採用理由については、Architecture設計書およびADRを参照する。


## 8. ネットワーク構成

EC2をPublic Subnetへ配置し、InternetからEC2への通信をSecurity Groupにより制御する。

EC2内部では、Docker Networkを`frontend`と`backend`に分離する。

```text
Internet
   |
   | HTTP : 80
   | SSH  : 22（管理元IPのみ）
   v
Security Group
   |
   v
Amazon EC2
   |
   ├─ frontend
   │     |
   │     └─ Nginx
   │           |
   │           v
   └─ backend
         |
         ├─ Nginx
         ├─ Application
         └─ PostgreSQL
```

Networkの基本方針は以下とする。

- InternetからのHTTP通信はNginxのみで受け付ける
- Nginxは`frontend`および`backend`の両Networkへ接続する
- ApplicationおよびPostgreSQLは`backend`のみに接続する
- Applicationの8000番PortおよびPostgreSQLの5432番PortはHostへ公開しない
- SSHの22番Portは管理元IPからのみ許可する

Network構成の詳細、選定理由および再評価条件については、Architecture設計書および`ADR-003-network-separation.md`を参照する。


## 9. 認証・認可

初期構成では、Applicationによるローカル認証を採用する。

```text
User
 |
 | Login
 v
Nginx
 |
 v
FastAPI Application
 |
 | Authentication / Authorization
 v
PostgreSQL
 |
 ├─ User Information
 ├─ Authentication Information
 └─ Role Information
```

認証・認可の基本方針は以下とする。

- ユーザー認証はApplicationで実施する
- ユーザー情報および認証に必要な情報はPostgreSQLで管理する
- Passwordは平文で保存せず、Hash化して管理する
- 認証されたユーザーのRoleに基づいてApplicationでAccess Controlを実施する
- 初期構成ではActive DirectoryやAmazon Cognito等の外部認証基盤を使用しない

認証方式の詳細、選定理由および外部認証基盤への移行条件については、Architecture設計書および`ADR-005-authentication.md`を参照する。


## 10. セキュリティ

本システムでは、InternetからのAccess、Application、DatabaseおよびAWS ResourceへのAccessを必要最小限に制限することを基本方針とする。

主なSecurity対策は以下とする。

- Internetから直接アクセス可能なComponentをNginxに限定する
- ApplicationおよびPostgreSQLをInternetへ直接公開しない
- SSH接続元を管理元IPに限定する
- ApplicationによるAuthentication / Authorizationを実施する
- Passwordを平文で保存せず、Hash化して管理する
- Security Headerを設定する
- IAMによりAWS ResourceへのAccessを制御する
- SecretをGit Repositoryへ保存しない

初期構成は学習・検証環境であるためHTTPを使用する。

本番利用またはInternet経由で認証情報・機密情報を扱う場合はHTTPSを必須とし、必要に応じてApplication Load Balancer、AWS Certificate Manager、AWS WAF等を再評価する。

Securityの詳細については、Architecture設計書およびSecurity Checkを参照する。


## 11. Infrastructure as Code

AWS InfrastructureはTerraformで管理する。

InfrastructureをCodeとして管理することで、以下を実現する。

- Infrastructure構成のVersion管理
- 変更履歴の追跡
- 同一構成の再現
- 手動構築による設定差異の抑制

Terraformは環境単位の設定と再利用可能なModuleを分離して管理する。

```text
terraform/
├── environments/
│   ├── dev/
│   └── prod/
│
└── modules/
    ├── vpc/
    ├── security_group/
    ├── ecs/
    ├── rds/
    ├── alb/
    ├── iam/
    ├── cloudwatch/
    ├── sns/
    └── budgets/
```

Application Code、Docker構成およびInfrastructure CodeはGit / GitHubでVersion管理する。


## 12. Project Structure

本Repositoryの主要なDirectory構成は以下とする。

```text
.
├── application/
│   ├── app/
│   ├── alembic/
│   ├── Dockerfile
│   └── requirements.txt
│
├── nginx/
│   └── default.conf
│
├── terraform/
│   ├── environments/
│   └── modules/
│
├── docs/
│   ├── 01_requirements/
│   │   ├── business-and-functional-requirements.md
│   │   └── non-functional-requirements.md
│   │
│   ├── 02_architecture/
│   │   ├── architecture-design.md
│   │   └── diagrams/
│   │
│   ├── 03_decisions/
│   │   ├── ADR-001-compute-container-platform.md
│   │   ├── ADR-002-application-structure.md
│   │   ├── ADR-003-network-separation.md
│   │   ├── ADR-004-database.md
│   │   ├── ADR-005-authentication.md
│   │   └── ADR-006-observability.md
│   │
│   ├── 04_operations/
│   │   ├── backup-restore.md
│   │   ├── deployment.md
│   │   └── monitoring.md
│   │
│   ├── 05_tests/
│   │   └── phase1-system-test.md
│   │
│   └── 06_security/
│       └── security-check.md
│
├── docker-compose.yml
└── README.md
```


## 13. Documentation

本プロジェクトでは、Requirements、Architecture、設計判断、Operations、TestおよびSecurityに関するDocumentを以下の構成で管理する。

READMEではSystemの目的、主要Requirements、System構成および主要Technology等の全体像を記載する。

詳細なRequirements、Architectureの設計内容、Technology・方式の選定理由、運用方法およびTest結果等については、以下の各Documentを参照する。


### 13.1 Requirements

Systemが満たすべき業務要件、機能要件および非機能要件を定義する。

- `docs/01_requirements/business-and-functional-requirements.md`
  - System化の目的、利用者、業務要件および機能要件を記載する

- `docs/01_requirements/non-functional-requirements.md`
  - Availability、Performance、Scalability、Security、Operation、Backup等の非機能要件を記載する


### 13.2 Architecture

Requirementsを基に、System全体としてどのような構成・方式を採用するかを定義する。

- `docs/02_architecture/architecture-design.md`
  - System構成、Application、Network、Database、Security、Performance / Scaling、Observability、Backup等について、各Componentの責務およびArchitecture上の基本方針を記載する


### 13.3 Architecture Decision Records

Architecture設計における主要なTechnologyおよび方式について、選択肢の比較、採用理由、Trade-offおよび再評価条件を記録する。

- `docs/03_decisions/ADR-001-compute-container-platform.md`
  - Application等の実行方式およびContainer実行基盤の選定について記載する

- `docs/03_decisions/ADR-002-application-structure.md`
  - Applicationの構成単位および内部の責務分離方針について記載する

- `docs/03_decisions/ADR-003-network-separation.md`
  - AWS NetworkおよびDocker Networkによる通信経路・公開範囲の分離方針について記載する

- `docs/03_decisions/ADR-004-database.md`
  - Database製品、実行方式、永続化およびSchema管理方針について記載する

- `docs/03_decisions/ADR-005-authentication.md`
  - Authentication / Authorization方式および外部認証基盤を採用しない理由について記載する

- `docs/03_decisions/ADR-006-observability.md`
  - Metrics、Logs、Alarmsの収集・監視方式およびAmazon CloudWatchの採用理由について記載する


### 13.4 Test

構築したSystemがRequirementsおよびArchitecture設計に基づいて動作することを確認するためのTest内容および結果を記録する。

- `docs/04_tests/phase1-system-test.md`
  - Application、Infrastructure、Network、Security、Monitoring、Backup等のSystem Test内容および結果を記載する


### 13.5 Security

構築したSystemに対して実施したSecurity設定および確認内容を記録する。

- `docs/05_security/security-check.md`
  - Network公開範囲、Security Group、Authentication / Authorization、Security Header、Secret管理、IAM等のSecurity確認内容を記載する