# ADR-004 Database

## 1. 前提と要件

本システムでは、申請、承認、ユーザー、認証情報等の業務データを永続的に管理するためのDatabaseおよびDatabase実行方式を決定する必要がある。

本システムの主要な前提および要件は以下の通りである。

- AWS上に構築する小規模な学習・検証環境である
- 同時利用者数は最大20名とする
- 申請、承認、ユーザー等の構造化されたデータを管理する
- 申請とユーザー、申請と承認等のデータ間の関連を管理する
- 複数データの更新において整合性を維持できること
- DatabaseのデータをApplicationやContainerの再作成後も保持できること
- Databaseの構造変更を再現可能な形で管理できること
- RPO / RTOは1日以内とする
- 初期構成ではDatabaseの物理冗長化を必須としない
- 現在の要件を超える構成要素を追加せず、構成および運用の複雑性を必要最小限とする

これらを踏まえ、以下の3段階でDatabase構成を検討する。

1. 業務データをどのDatabase方式で管理するか
2. DatabaseをAWS上のどの実行基盤へ配置するか
3. Databaseの構造変更をどのように管理するか


## 2. 主な判断基準

本判断では以下を主要な判断基準とする。

- データ構造への適合性
  - 申請、承認、ユーザー等の構造化されたデータおよびデータ間の関連を適切に管理できること

- データ整合性
  - TransactionやConstraint等を利用し、業務データの整合性を維持できること

- データ永続性
  - Containerの停止・再作成等によってDatabaseのデータが消失しないこと

- 変更の再現性
  - Databaseの構造変更を再現可能な形で管理できること

- 要件適合性
  - 現在のシステム規模、可用性および復旧要件に適した構成であること
  - 過剰な構成・機能でなく、要件に適した構成であること

- 構成の単純性
  - Database Resourceおよび運用対象を必要以上に増加させないこと


## 3. 採用アーキテクチャ

初期構成では、DatabaseとしてPostgreSQLを採用し、Amazon EC2上のPostgreSQL Containerとして実行する。

PostgreSQLのデータはDocker Volumeを介してEC2のEBS上へ永続化する。

また、Databaseのスキーマ変更はAlembicのMigration Fileとして管理する。

```text
FastAPI Application
        |
        v
PostgreSQL Container
        |
        v
  Docker Volume
        |
        v
       EBS

Database Schema
        |
        v
Alembic Migration
        |
        v
       Git
```

- ApplicationからPostgreSQLへ接続し、業務データを読み書きする
- PostgreSQL Container自体と永続データを分離する
- Containerを再作成した場合もDocker Volumeを介してデータを保持する
- Databaseのスキーマ変更はAlembic Migrationとして管理する
- Migration FileをGitでVersion管理し、同一のDatabase変更を再現可能とする
- Databaseの論理Backupは`pg_dump`により取得し、Amazon S3へ保存する

具体的なTable、Column、Primary Key、Foreign Key、Index、Migration方式等はDatabase設計で定義する。


## 4. Database方式の比較

業務データを管理するDatabase方式について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| PostgreSQL | Relation、Transaction、Constraint等により構造化された業務データを管理しやすい。標準SQLへの準拠度が高く、JSON等の拡張的なデータ型にも対応している | Schema設計、Migration、Backup等のDatabase管理が必要となる | ◎ |
| MySQL | Relation、Transaction、Constraint等に対応しており、一般的なWeb Applicationで広く利用されている。構造化された業務データを管理できる | Schema設計、Migration、Backup等のDatabase管理が必要となる。一部のSQL仕様、データ型、制約等にPostgreSQLとの違いがあり、Database固有仕様を考慮する必要がある | ○ |
| DynamoDB | Server管理が不要で、高いScale性能および可用性を利用できる | Relationを持つ業務データではAccess Patternを考慮したデータモデル設計が必要となり、RDBとは異なる設計が必要 | △ |

PostgreSQLおよびMySQLはいずれも本システムの主要な要件を満たすことができる。

本システムでは、Relation、Transaction、Constraint等によるデータ整合性管理に加え、将来的なデータ構造の拡張にも対応しやすいことから、**PostgreSQLを採用する。**


## 5. Database実行基盤の比較

PostgreSQLを採用した上で、AWS上のDatabase実行基盤について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| EC2 + PostgreSQL Container | Applicationと同一EC2上へ配置でき、追加のDatabase Serviceを必要としない。Docker Volumeを介してEBSへデータを永続化できる | EC2、PostgreSQL、Backup等を利用者側で管理する必要がある。EC2障害時にはApplicationとDatabaseが同時に停止する | ◎ |
| Amazon RDS for PostgreSQL | Backup、Patch、障害復旧等のDatabase運用をマネージドサービスとして利用でき、ApplicationとDatabaseを物理的に分離できる | Database Resourceが追加され、現在の小規模な学習・検証環境では構成およびコストが増加する | ○ |
| PostgreSQL専用EC2 | ApplicationとDatabaseを物理的に分離でき、OSやPostgreSQLを柔軟に管理できる | EC2が追加となり、OS、Patch、Monitoring、Backup等の管理対象が増加する | △ |

以上より、現在の性能・可用性要件を満たしながら追加のDatabase Resourceを持たず、構成を単純に保つことができるため、**EC2上のPostgreSQL Containerを採用する。**


## 6. スキーマ変更方式の比較

Databaseのスキーマ変更方式について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| 手動SQL | 小規模な変更では容易に実施できる | 実施した変更の追跡や環境間での同一変更の再現が難しい | △ |
| SQL Migration File | Database変更をFileとして管理でき、GitによるVersion管理が可能 | SQLを直接作成・管理する必要がある | ○ |
| Alembic Migration | SQLAlchemy Modelとの連携が可能で、Database変更をMigration Fileとして管理できる | Alembic固有のMigration管理が必要となる | ◎ |

以上より、Databaseの構造変更を再現可能な形で管理でき、Applicationで使用するSQLAlchemyとも連携しやすいため、**AlembicによるMigration管理を採用する。**


## 7. 採用による影響

### 7.1 メリット

- Relationを持つ構造化された業務データをPostgreSQLで管理できる
- TransactionやConstraint等を利用してデータ整合性を維持できる
- Applicationで利用するSQLAlchemyとの親和性が高い
- PostgreSQL Containerと永続データを分離できる
- Containerを再作成してもDocker Volumeを介してデータを保持できる
- 追加のDatabase Serviceを使用せず、単一EC2へ構成を集約できる
- AlembicによりDatabaseのスキーマ変更を再現可能な形で管理できる
- Migration FileをGitでVersion管理し、変更履歴を追跡できる

### 7.2 デメリット・受容する制約

- PostgreSQLのVersion管理、Patch、設定等を利用者側で管理する必要がある
- EC2障害時にはApplicationとDatabaseが同時に停止する
- 単一EC2および単一EBSに依存するため、Database単独の高可用構成を持たない
- ApplicationとDatabaseが同一EC2のCPU、Memory、Disk I/O等のResourceを共有する
- Database単体で独立してScaleすることが難しい
- RDSと比較してBackup、Patch、障害復旧等の運用負荷が大きい
- Migration適用時にはApplication CodeとDatabase Schemaの互換性を考慮する必要がある

これらは、現在のシステム規模、性能・可用性要件および学習・検証環境という前提とのTrade-offとして受容する。


## 8. 再評価条件

以下の条件が発生した場合、本決定を再評価する。

- Databaseの可用性要件が現在より高くなる
- RTO / RPOの大幅な短縮が必要となる
- ApplicationとDatabaseの物理分離が必要となる
- Database障害の影響をApplication実行基盤から分離する必要が生じる
- Databaseのデータ量またはRead / Write量が増加する
- ApplicationとDatabaseのResource競合により性能要件を満たせなくなる
- DatabaseをApplicationとは独立してScaleする必要が生じる
- PostgreSQLのPatch、Backup、障害復旧等の運用負荷を削減する必要が生じる
- Applicationを複数Instance / Taskへ水平展開する必要が生じる

これらの条件が発生した場合は、Amazon RDS for PostgreSQL、Multi-AZ構成、Read Replica等を候補としてDatabase構成を再評価する。


## 9. 関連ドキュメント

- `docs/01_requirements/business-and-functional-requirements.md`
- `docs/01_requirements/non-functional-requirements.md`
- `docs/02_architecture/architecture-design.md`
- `docs/03_decisions/ADR-001-compute-container-platform.md`
- `docs/03_decisions/ADR-002-application-structure.md`
- `docs/03_decisions/ADR-003-network-separation.md`
- `docs/03_decisions/ADR-005-authentication.md`