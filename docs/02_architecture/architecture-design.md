# アーキテクチャ設計書

## 1. 文書目的

本書は、`/home/koutoku/workspace/it-service-request-system/docs/01_requirements/`に基づき、システム全体の構造、主要コンポーネント、実行方式、および主要な技術選定方針を定義する。  

また、詳細な個別判断は`docs/03_decisions/ADR-xxx.md` に記録する。


## 2. システム概要
※マスタは`/home/koutoku/workspace/it-service-request-system/docs/01_requirements/`を参照

本システムは、情報システム部門でメールやチャットにより受け付けているITサービス申請をWeb化し、申請、承認、対応履歴および管理情報を一元管理するシステムである。

対象とする主な業務は以下とする。

- アカウント登録申請
- アカウント変更申請
- アカウント削除申請
- ソフトウェア利用申請
- PC貸出申請
- 申請状況確認

利用者は以下の3種類とする。

| 利用者 | 役割 |
|---|---|
| 一般利用者 | 申請を実施する |
| 承認者 | 申請を承認・却下する |
| システム管理者 | ユーザー、権限、マスタ等を管理する |

主要機能は、以下の3領域で構成する。
- 申請
- 承認
- 管理


## 3. アーキテクチャドライバ
※マスタは`/home/koutoku/workspace/it-service-request-system/docs/01_requirements/`を参照

アーキテクチャへ大きく影響する要件を以下に整理する。

### 3.1 業務・機能面

- ITサービス申請をWebから実施できること
- 承認状況を可視化できること
- 対応履歴を管理できること
- 将来的な自動処理へ拡張可能であること
- 申請、承認、管理を役割ごとに提供すること

### 3.2 可用性・復旧

- 稼働率99%以上
- RTO 1日以内
- RPO 1日以内
- 初期構成では物理的な冗長化および自動スケーリングを必須としない

### 3.3 性能・規模

- 同時利用者数20名
- 通常操作3秒以内
- DB SQL実行時間1秒以内を目標
- 画面表示5秒以内

### 3.4 拡張性

- Web、アプリケーション、データベース、ストレージを論理的に分離する
- コンポーネントを独立して変更・追加できる構造とする
- 業務機能を可能な範囲で分離し、将来的な機能追加に対応する
- APIまたは標準的なプロトコルによりコンポーネント間を連携する
- 実行に必要なランタイム、ライブラリ、依存関係を再現可能な形で管理する
- 将来的にアプリケーション、データベース、ストレージを個別に拡張できる構造とする

### 3.5 保守性・運用性

- コンポーネント単位で起動、停止、再起動、更新、ログ確認を行えること
- インフラ、アプリケーション、DBスキーマ、ドキュメントをバージョン管理すること
- 障害箇所をログ、監視情報、変更履歴から切り分けられること
- 定型作業を可能な範囲で自動化すること

### 3.6 セキュリティ

- ログイン認証とRBACを実装する
- 管理者機能は管理者権限に限定する
- 学習環境ではHTTPを使用し、HTTPS/TLSは本番相当環境への拡張時に対応する
- DBパスワード等の秘密情報をソースコードやGitリポジトリへ登録しない
- SQLインジェクション、XSS、入力値異常への対策を行う
- WAF、Shield Advanced、Inspector等の有料機能は初期構成では採用しない

### 3.7 監視・バックアップ

- Web、Application、Database、OSのログを確認可能とする
- CPU、メモリ、ディスク、PostgreSQL、Webアプリケーションを監視する
- DBバックアップを1日1回取得し、7日間保持する
- バックアップからリストア可能とする



## 4. アーキテクチャ基本方針

本システムでは、以下をアーキテクチャ全体に共通する設計原則とする。

- 現在の要件に対して必要十分な構成とし、将来要件を先取りした過剰な複雑性を持ち込まない。
- コンポーネント間の責務と依存関係を明確化し、変更および障害の影響範囲を可能な限り限定する。
- インフラ、アプリケーション、データベース等を再現可能な形で管理する。
- セキュリティ上不要な外部公開および権限を持たせない。

具体的な実現方式および技術選定については、以降の各章で要件との対応および代替案との比較を行った上で決定する。


## 5. 実行環境
本システムの実行環境としてAWSを採用する。

本システムは小規模な学習・検証環境であり、物理サーバの調達・設置を行わず短期間で環境を構築・変更・廃止できることを重視する。

また、TerraformによるInfrastructure as Code、CloudWatchによる監視、S3によるバックアップ等、後続のアーキテクチャで必要となる機能をマネージドサービスとして利用可能であることを考慮する。

以上から、物理機器の調達・保守を必要とするオンプレミス環境ではなく、クラウド環境を採用する。

※クラウドサービスについては、設計構築、運用保守のノウハウがあるAWSを採用する。

## 6. 実行基盤

次の通り、EC2インスタンスへの直接範囲、VM分離、コンテナ、サーバレス環境の4つの観点で検討する。

| 選択肢 | 論理分離 | 実行環境の再現性 | 運用負荷 | 構成の単純性 | 現要件への適合 |
|---|---:|---:|---:|---:|---:|
| OSへの直接配置 | △ | △ | △ | ◎ | △ |
| VM分離 | ○ | ○ | × | △ | △ |
| コンテナ | ◎ | ◎ | ○ | ○ | ◎ |
| Lambda等のFunctions | ◎ | ○ | ◎ | ○ | △ |

表より、要件への適合性が高く、減点が少ないコンテナを実行基盤として採用する。

- OSへの直接配置
  - Web、Application、Databaseを同一OSへ直接インストールする構成でも動作は可能
  - コンポーネント間の実行環境が混在し、ランタイム・ライブラリの差異や個別更新の影響を局所化しにくい
  - 拡張性・保守性・再現性の要求に対して相対的に弱い

→機能要件は満たせるものの、拡張性・保守性・実行環境の再現性においてコンテナ方式より適合度が低いため採用しない。

- VM分離
  - Web、Application、DatabaseをOS単位で強く分離できる
  - 本システムは小規模であり、各コンポーネントごとにGuest OSを持つことは、CPU・メモリ消費の点でオーバースペック
  - OS管理、構成管理の増加につながる

→要件は満たせるが、現規模に対して構成が重くなる。

- コンテナ
  - Web、Application、Databaseを個別の実行単位として分離しながら、VMより軽量に構成できる
  - 本システムの規模が小規模であるため、VM分離と比較してリソースの最適化が期待できる
  - Applicationのランタイム、ライブラリ、依存関係をDockerfileやrequirements等で管理でき、実行環境を再現しやすい。

→要件を満たすことができ、リソースの最適利用が期待できる。

- Lambda
  - サーバおよびOSを利用者が管理する必要がなく、基盤運用負荷を削減できる。
  - アクセスが断続的な小規模システムとの親和性が高い。
  - ApplicationをLambdaへ配置する場合は、API受付、Function実行、Database接続等をサーバレスアーキテクチャに合わせて設計する必要がある。
  - データ保持のためにLambdaの実行環境とは独立した永続データストアが必要である
  - 同時実行数の増加によりDatabase Connection数が増加する場合は、RDS Proxy等によるConnection Poolingの検討も必要となる


→運用負荷の面では優れるものの、現在の小規模システムでは構成変更および構成要素増加の影響が大きいため採用しない。

**したがって初期構成ではコンテナ方式を採用する**

ただし、将来的に、以下の条件が強くなった場合、Lambdaを再検討する。

- アクセスが断続的で常時稼働が不要
- イベント駆動処理が中心となる
- サーバ・コンテナ基盤の運用負荷削減を最優先する
- 業務処理をFunction単位へ分割することが妥当になる


## 7. コンテナ実行基盤

コンテナ方式を採用した上で、AWS上の実行基盤を比較する。

| 選択肢 | サーバ管理 | オーケストレーション | スケーリング | 構成複雑性 | 現要件への適合 |
|---|---:|---:|---:|---:|---:|
| EC2 + Docker Compose | 必要 | 最小 | 手動 | 低 | ◎ |
| ECS on EC2 | 必要 | あり | 高 | 中 | ○ |
| ECS + Fargate | 不要に近い | あり | 高 | 中 | ○ |
| EKS | 一部必要 | 高度 | 高 | 高 | △ |

- EC2 + Docker Compose
  - 同時利用者20名、RTO/RPO 1日以内であり、自動スケーリングや物理冗長化は必須ではない
  - 学習用として構築要素を抑えて構築可能である
  - Databaseの永続データストアとしてEC2（EBS）を利用できる

→要件を満たしており、初期構成として最も要求と性能のバランスがよい。

- ECS on EC2
  - コンテナのService管理、再配置、スケーリング等を行える点で優れる一方で、Dockerと比較して構成要素が多くなる
  - Databaseの永続データストアとしてEC2（EBS）を利用できる

→要件は満たすことができ、スケーリング機能があるものの、ECS Cluster、Task Definition、Service等の追加構成が現要件に対して過剰となる。

- ECS + Fargate
  - EC2ホストを利用者が直接管理する必要がなく、OSパッチやホスト容量管理等の運用負荷を削減できる
  - Applicationを複数Taskへ展開する場合の水平スケーリングにも対応しやすい
  - ApplicationをFargateへ配置する場合は、DatabaseをRDS等へ分離する構成が自然となり、ECS Service、Task Definition、Load Balancer、Database等の構成要素が増加する

→運用負荷の面ではEC2 + Docker Composeより優れるものの、構成複雑性が現在の要求を上回る。

- EKS
  - 高度なオーケストレーションが可能

→要件は満たせるものの、Kubernetes Cluster、Deployment、Service等の運用複雑性が現在の要求を上回る。
  

**したがって初期構成ではEC2+Docker Composeを採用する。**

ただし、将来的に、以下の条件が強くなった場合、コンテナ実行基盤を再検討する。

- EC2 OSの保守負荷を大きく削減したい
- Applicationを複数Taskへ水平スケールしたい
- ApplicationとDatabaseの物理分離が必要
- 可用性要件が現在より高くなる

---

## 8. 採用アーキテクチャ

以上の比較から、初期構成として以下を採用する。

| 分類           | 採用方式             |
| ------------ | ---------------- |
| 実行環境         | AWS              |
| コンピューティング基盤  | Amazon EC2       |
| アプリケーション実行方式 | Docker Container |
| コンテナ管理       | Docker Compose   |

また、その他主要技術は以下を採用する。

| 分類                     | 採用技術                                 |
| ---------------------- | ------------------------------------ |
| Web                    | Nginx                                |
| Application            | FastAPI                              |
| Database               | PostgreSQL                           |
| Infrastructure as Code | Terraform                            |
| DB Schema Migration    | Alembic                              |
| Backup                 | pg_dump + Amazon S3                  |
| Monitoring / Logging   | Amazon CloudWatch + CloudWatch Agent |
| Version Control        | Git / GitHub                         |

各技術の詳細な採用理由についてはADRに記録する。

## 9. 論理アーキテクチャ

システムを以下の責務に分離する。

| コンポーネント | 主な責務 |
|---|---|
| Web | HTTP受付、ApplicationへのReverse Proxy、Security Header |
| Application | 認証・認可、申請、承認、管理等の業務ロジックとAPI |
| Database | ユーザー、申請、承認、マスタ等の永続化 |
| Backup | DB論理バックアップの取得・保存 |
| Monitoring | メトリクス、ログ、ヘルス状態の収集 |
| Infrastructure | VPC、EC2、IAM、S3、CloudWatch等のAWS基盤 |

基本依存方向は以下とする。

```text
利用者
  |
  v
Web
  |
  v
Application
  |
  v
Database
```

横断機能：

```text
Infrastructure / OS / Web / Application / Database
                         |
                         v
                    Monitoring

Database
   |
   v
 Backup
```

## 10. AWS物理構成

初期構成は単一AZ・単一EC2を基本とする。

```text
Internet
   |
   v
Security Group
   |
   v
VPC
   |
Public Subnet
   |
   v
EC2
│
├─ nginx container
├─ application container
├─ postgres container
│    └─ PostgreSQL Data
│         |
│         v
│     Docker Volume
│
└─ EBS
    ├─ OS / Docker関連データ
    └─ Docker Volume

EC2 / PostgreSQL
   |
   +------> Amazon S3
   |         DB Backup
   |
   +------> Amazon CloudWatch
             Metrics / Logs
```


- EBSはEC2インスタンスの永続ブロックストレージとして使用する
- PostgreSQLのデータはDocker Volumeへ保存することで、PostgreSQLコンテナを再作成した場合でもDBデータを保持できるようにする
- 単一EC2はシステム全体の単一障害点（SPOF：Single Point of Failure）となるが、非機能要件で物理冗長化を初期構成の対象外としているため許容する

## 11. ネットワークアーキテクチャ

AWSおよびDockerの双方で、外部公開する通信と内部通信を分離する。

### 11.1 AWSネットワーク

初期構成ではVPC内のPublic SubnetへEC2を配置する。
外部からEC2へ到達可能な通信はSecurity Groupで制御する。

| 通信 | ポート | 公開方針 |
|---|---:|---|
| HTTP | TCP/80 | Webアクセス用として許可し、EC2上のNginxへ転送する |
| SSH | TCP/22 | 管理用として接続元IPアドレスを限定して許可する |
| Application | TCP/8000 | インターネットへ直接公開しない |
| PostgreSQL | TCP/5432 | インターネットへ直接公開しない |

- 外部からのHTTP通信はEC2のTCP/80で受け付け、DockerのPort Mappingを介してNginxコンテナへ転送する。
- ApplicationおよびPostgreSQLはインターネットへ直接公開しない。
- 初期構成では単一AZ・単一EC2で構成するため、複数AZへのSubnet配置は行わない。
- 初期構成は接続元を限定した学習・検証環境であり、本番データを扱わないためHTTPを使用する

※本番相当環境へ拡張する場合は、HTTPS/TLSによる通信暗号化を実装する。

※可用性要件が引き上げられ、複数AZ構成やApplication / Databaseの物理分離を行う場合は、Public SubnetおよびPrivate Subnetを含むネットワーク構成を再検討する。

### 11.2 Dockerネットワーク

Docker Networkとして `frontend` と `backend` を使用する。

``` text
Internet
   |
   v
 nginx
 /    \
frontend backend
          |
       application
          |
       postgres
```

nginxはfrontend/backendの双方へ接続し、ApplicationおよびPostgreSQLはbackendのみへ接続する。これにより、外部からApplicationおよびDatabaseへ直接アクセスさせず、Web層を経由した通信に限定する。

## 12. 処理・連携アーキテクチャ

### 12.1 基本処理方式

初期構成では、申請登録、承認、却下、ユーザー管理、マスタ管理等の主要処理を同期処理として実装する。

```text
Client
   |
   v
Nginx
   |
   | Reverse Proxy
   v
FastAPI Application
   |
   v
PostgreSQL
   |
   v
FastAPI Application
   |
   v
Nginx
   |
   v
Client
```

- Nginxは外部からのHTTPリクエストを受け付け、Reverse ProxyとしてFastAPI Applicationへ転送する
- 初期構成では構成要素を増加させないことを優先し、Nginx + FastAPIによるAPI公開方式を採用する（Amazon API Gatewayは採用しない）

※現要件ではAPIのルーティング、レート制御等の高度なAPI管理機能を必要としておらず、API Gatewayの利用は必須でない。

ただし、将来的に以下の条件が発生した場合はAPI Gatewayの利用を再検討する。

- 複数のBackend APIを統合して公開する必要がある
- API単位のレート制御や利用量制御が必要となる
- API Key等による外部利用者向けAPI管理が必要となる
- Lambda等のServerless ApplicationをAPIとして公開する
- APIの認証・認可をApplication外部で一元的に管理する必要がある

### 12.2 Application機能の分離方針

Applicationは、申請、承認、認証・認可、管理等の複数の業務機能を提供する。

初期構成では、これらを機能単位の独立したコンテナまたはサービスとして分離せず、単一Applicationコンテナ内で論理的に分離する。

```text
Application Container
├─ 認証・認可
├─ 申請
├─ 承認
└─ 管理
```

機能単位でコンテナ分離しない理由は、下記要件が現要件では求められていないためである。

- 機能単位の独立したスケーリング
- 機能単位の独立したデプロイ
- 機能単位の物理的な障害分離
- 複数チームによる機能単位の独立開発・運用

一方、単一Application内部では以下の2つの観点で責務を論理的に分離する。

#### 業務機能単位

- 認証・認可
- 申請
- 承認
- 管理

#### システム機能単位

- API受付・入力値Validation
- 業務ロジック
- Databaseアクセス

各業務機能およびシステム機能をモジュール単位で分離し、ある機能の変更によって他機能の実装を直接変更する範囲を可能な限り限定する。

具体的なPackage構成、Module構成、Class構成等はApplication設計で定義する。

ただし、将来的に以下の条件が発生した場合は、機能単位のコンテナまたはサービス分離を再検討する。

- 特定機能のみ処理量が大幅に増加する
- 機能単位の独立デプロイが必要となる
- 機能単位で障害影響を分離する必要がある
- 異なるチームが機能単位で開発・運用する


### 12.3 キュー利用
初期構成ではAmazon SQS等のメッセージキューを採用しない。

主要業務処理は、申請登録、承認、却下、管理処理等で比較的短時間で完了するDB処理が中心である点と、同時利用者数が最大20人であることから、同期処理で対応可能と考える。

- 長時間実行されるバックグラウンド処理がない
- 大量の同時実行が不要

また、以下のようなメッセージキューの利点を現要件に含めていない。

-   処理要求の一時的な集中を吸収する必要性
-   外部システム障害時のメッセージ保持・再実行

メッセージキューを導入した場合は、Producer / Consumer、Retry、DeadLetterQueue、重複処理対策、冪等性、非同期処理の状態管理、監視等の追加設計が必要となる。
したがって、現要件では非同期化によるメリットより構成・運用複雑性の増加が大きいと判断し、同期処理を採用する。



### 12.4 将来的な非同期処理

将来的に以下の機能を実装する場合は、Amazon
SQS等を利用した非同期処理を再検討する。

-   承認後のアカウント作成等、処理完了まで時間を要する自動処理
-   メール、Teams等への通知
-   外部システムAPIとの連携
-   外部システム障害時に再実行が必要となる処理
-   大量の処理要求を平準化する必要がある処理

``` text
Application
     |
     v
   Queue
     |
     +------> Automation Worker
     |
     +------> Notification Worker
     |
     +------> External System Worker
```

これにより、API処理とバックグラウンド処理を疎結合化し、外部システム障害等がユーザー向けAPIへ直接影響する範囲を限定する。


## 13. データアーキテクチャ

### 13.1 Database

- 業務データはPostgreSQLへ保存する。PostgreSQLは初期構成ではEC2上のコンテナとして稼働する
- 主な管理対象は、ユーザー、ロール・権限、申請、承認、コメント、各種マスタとする

### 13.2 データ永続化

- PostgreSQLのデータはDocker Volumeへ保存する。
- Docker Volumeを利用することで、PostgreSQLコンテナのライフサイクルとDBデータのライフサイクルを分離する。

※PostgreSQLコンテナを再作成した場合でも、DockerVolumeを削除しない限りデータを保持できる構成とする。
※Docker Volumeの実体はEC2のファイルシステムを介してEBS上に保持する。

### 13.3 DBスキーマ変更

- DBスキーマ変更はAlembic Migrationで管理する。
- スキーマ変更をMigration FileとしてGit管理することで、DBスキーマ変更履歴の確認、環境ごとの同一変更の再現、ApplicationCodeとDB Schema変更の対応関係の管理を可能とする


## 14. 可用性・復旧アーキテクチャ

### 14.1 可用性

- 初期構成は単一AZ・単一EC2で構成する。Web、Application、Databaseを同一EC2上へ配置するため、EC2障害または対象AZの障害時にはシステム全体が停止する。

これは、現要件で物理的なサーバ分離・冗長化を初期構成の対象外としており、RTO/RPOを1日以内としていることを踏まえ、構成複雑性およびコストとのトレードオフとして受容する。

### 14.2 復旧方針

初期構成では、RTO/RPOが1日以内であることから、バックアップ＆リストア方式を採用する。
リストアに伴う復旧元は次の通りである。

| 対象 | 復旧元 |
|---|---|
| AWS Infrastructure | Terraform |
| Application | Git / GitHub |
| Container Configuration | Dockerfile / Docker Compose |
| DB Schema | Alembic Migration |
| DB Data | Amazon S3上のDB Backup |


将来的に稼働率、RTO/RPO要件が引き上げられた場合は、以下を検討することとする。
- Multi-AZ、複数Application
- Instance、Application Load Balancer、Amazon ECS/Fargate、Amazon RDS Multi-AZ等の利用


## 15. 性能・スケーリングアーキテクチャ

### 15.1 初期性能設計

現要件では以下のシステム規模を想定する。

| 項目 | 要件 |
|---|---|
| 同時利用者数 | 最大20名 |
| 通常操作 | 3秒以内 |
| DB SQL実行時間 | 1秒以内を目標 |
| 画面表示 | 5秒以内 |


- 初期構成ではWeb、Application、Databaseを単一EC2上で稼働させる。
- EC2には、Nginx、FastAPI、PostgreSQL、DockerおよびCloudWatch Agentを同時稼働できるCPU・メモリ容量を確保する。
- 初期インスタンスサイズは小規模な学習・検証環境として必要十分な構成とし、CloudWatchによるCPU・メモリ・ディスク等の監視結果を基に必要に応じてサイズを見直す。

### 15.2 スケーリング方針

-現要件では同時利用者数が最大20名であり、急激なアクセス増加を想定していないため、自動スケーリングは採用しない
-性能不足が確認された場合は、初期対応としてEC2インスタンスタイプを変更する垂直スケーリング（Scale Up）を検討する

### 15.3 スケーリング再評価条件

以下の条件が発生した場合は、スケーリング方式を再評価する。

- 同時利用者数が現要件の20名を継続的に上回る
- CPUまたはメモリ使用率が継続的に高い状態となる
- 通常操作3秒以内等の性能要件を満たせなくなる
- 特定時間帯にアクセスが集中する
- 単一EC2の性能向上だけでは対応が困難となる
- Applicationのみを独立して拡張する必要が生じる

※初期段階では垂直スケーリングを基本とし、それでは対応が困難となった場合はApplicationの物理分離および水平スケーリング（Scale Out）を検討する。

※水平スケーリングが必要となった場合は、Application Load Balancer、Amazon ECS / Fargate等の利用を候補として再評価する。


## 16. セキュリティアーキテクチャ

セキュリティはNetwork、Application、Data、Secret等の複数レイヤで実装する。

### 16.1 Network / Communication

- Security Groupで必要な通信のみ許可する。
- SSHは管理用として接続元IPアドレスを限定する。
- Application Portをインターネットへ直接公開しない。
- PostgreSQL Portをインターネットへ直接公開しない。
- 外部からのWebアクセスはNginxを経由させる。
- 初期構成は接続元を限定した学習・検証環境であり、本番データを扱わないためHTTPを使用する

※本番相当環境へ拡張する場合は、HTTPS/TLSによる通信暗号化を実装する。

### 16.2 Authentication / Authorization

- 本システムではApplicationによるローカル認証を採用する
- ユーザー情報および認証に必要な情報をADatabaseで管理し、ログイン時にApplicationが認証を実施する
- 認証後の権限制御にはRBACを使用し、一般利用者、承認者、システム管理者等の役割に応じて利用可能な機能を制御する
- 管理者向け機能はシステム管理者権限を持つユーザーのみに限定する

現要件では利用者数が最大20名程度の学習・検証環境であり、以下のような外部認証基盤との連携を要求していない。
そのため、外部認証基盤を追加することによる構成複雑性に対して得られる効果が限定的であると判断し、初期構成ではApplicationによるローカル認証を採用する。

- Active Directory / LDAP
- Amazon Cognito
- その他の外部Identity Provider

将来的に以下の条件が発生した場合は外部認証基盤との連携を再検討する。

- 社内Active Directory / LDAPとのユーザー統合が必要となる
- Single Sign-Onが必要となる
- 利用者数が増加し、Application内でのユーザー管理負荷が高くなる
- MFA等の高度な認証機能が必要となる
- 複数システムで認証基盤を共通化する必要がある

### 16.3 Application Protection

- ORM等を利用したSQL Injection対策
- 入力値Validation
- XSS対策
- Security Headerの付与
- 不正な入力値に対する適切なエラー処理

### 16.4 Secret Management

- 現要件では秘密情報の自動ローテションが要求されていおらず、本システムは小規模な学習・検証環境であるため、環境変数等を利用して秘密情報を管理する。
- DBパスワード等の秘密情報をApplication CodeおよびGit Repositoryへ直接登録しない。


ただし、将来的に以下の条件が発生した場合はSecrets Manager等の専用Secret管理サービスを再検討する。

- 管理する秘密情報が増加する
- 複数Applicationから秘密情報を共有する
- 秘密情報の自動ローテーションが必要となる
- 秘密情報へのアクセスをIAM等で厳密に制御する必要がある


### 16.5 WAF / DDoS対策

- 初期構成ではAWS Shield StandardによるAWS標準の基本的なDDoS保護を前提とする

※AWS WAFおよびAWS Shield Advanced等の追加サービスは、現在の学習環境に対する必要性とコストを考慮し採用しない。



## 17. 監視・ログアーキテクチャ

AWS上の監視・ログ基盤としてAmazon CloudWatchを使用する。

### 17.1 監視対象

主な監視対象を以下とする。

| 対象 | 監視項目 | 取得方式 | 目的 |
|---|---|---|---|
| EC2 | CPU使用率 | CloudWatch標準メトリクス | CPUリソース不足の検知 |
| EC2 / OS | メモリ使用率 | CloudWatch Agent | メモリ不足の検知 |
| EC2 / OS | ディスク使用率 | CloudWatch Agent | ディスク容量不足の検知 |
| Nginx | 稼働状態・エラー | ログ / ヘルス確認 | Web層異常の検知 |
| Application | 稼働状態・エラー | ログ / ヘルス確認 | Application異常の検知 |
| PostgreSQL | 稼働状態・エラー | ログ / ヘルス確認 | Database異常の検知 |

- EC2のCPU使用率等、CloudWatchが標準で提供するメトリクスは標準メトリクスを利用する
- メモリ使用率、ディスク使用率等、EC2標準メトリクスとして取得できないOS内部の情報についてはCloudWatch Agentを利用する
- カスタムメトリクスは追加コストが発生するため、標準メトリクスおよびログで監視可能な項目はそれらを優先し、カスタムメトリクスの利用対象を必要最小限とする

### 17.2 ログ

障害発生時にコンポーネント単位で原因を切り分けられるよう、以下のログを取得する。

| 対象 | 主なログ | 利用目的 |
|---|---|---|
| OS | System Log | OS障害、サービス異常等の調査 |
| Nginx | Access Log / Error Log | HTTPアクセスおよびWeb層エラーの調査 |
| Application | Application Log | API処理、Application Error等の調査 |
| PostgreSQL | PostgreSQL Log | Database Error、接続異常等の調査 |

- ログはコンポーネントごとに識別可能な形でAmazon CloudWatch Logsへ集約し、障害発生時に横断的に確認できる構成とする

### 17.3 アラーム方針

利用者影響またはシステム停止につながる可能性がある異常について、CloudWatch Alarmによる検知を行う。

主なアラーム対象を以下とする。

| 対象 | アラーム対象 | 理由 |
|---|---|---|
| EC2 | CPU高負荷 | Application応答性能低下やリソース不足を検知するため |
| EC2 / OS | メモリ使用率上昇 | ApplicationやDatabaseの停止につながるメモリ不足を検知するため |
| EC2 / OS | ディスク使用率上昇 | ログやDatabaseデータによるディスク枯渇を事前に検知するため |
| Application | ヘルスチェック異常 | Application停止を検知するため |
| PostgreSQL | 接続・稼働異常 | Database障害による業務機能停止を検知するため |

- アラーム閾値、評価期間、通知先等の具体的な設定値は監視設計で定義する


## 18. バックアップ・リストアアーキテクチャ

Database BackupにはPostgreSQLの論理バックアップを使用する。

``` text
PostgreSQL
   |
 pg_dump
   |
   v
EC2 Local Backup
   |
   v
Amazon S3
```

### 18.1 バックアップ方針

-   取得対象：PostgreSQL Database
-   取得方式：pg_dump
-   取得頻度：1日1回
-   保存先：Amazon S3
-   保持期間：7日

1日1回バックアップを取得することで、RPO 1日以内の要件へ対応する。

### 18.2 リストア方針

Amazon S3に保存したバックアップからPostgreSQL
Databaseを復元できることを確認する。バックアップを取得するだけではなく、リストア試験を実施し、実際に復旧可能であることを確認する。


## 19. 構成管理・変更管理アーキテクチャ

Infrastructure、Application、Database
SchemaおよびDocumentをGitで管理し、変更履歴を追跡可能とする。

### 19.1 Infrastructure

AWS InfrastructureはTerraformで管理する。

``` text
Code Change
   |
terraform fmt
   |
terraform validate
   |
terraform plan
   |
Review
   |
terraform apply
```

これにより、AWS Management
Consoleによる手作業を可能な範囲で削減し、Infrastructure構成を再現可能とする。

### 19.2 Application / Container

- Application Code、Dockerfile、Docker Compose、Nginx Configuration、Application依存関係をGitで管理する

### 19.3 Database

- DB Schema変更はAlembic Migrationで管理する
- Application Codeの変更とDB Schema変更の対応関係をGit上で追跡可能とする。


## 20. 主要ADR

本書ではシステム全体の構造および主要な設計結論を記載し、個別の技術選定における詳細な比較・判断はADRへ分離する。

| ADR | 主題 |
|---|---|
| ADR-001 | Compute基盤として単一EC2を採用する理由 |
| ADR-002 | Application実行方式としてDocker / Docker Composeを採用する理由 |
| ADR-003 | frontend / backend Networkを分離する理由 |
| ADR-004 | Infrastructure as CodeとしてTerraformを採用する理由 |
| ADR-005 | DatabaseとしてPostgreSQLを採用する理由 |
| ADR-006 | AWS監視基盤としてCloudWatchを採用する理由 |


## 21. まとめ

### 21.1 現構成で受容する制約

初期構成では以下を既知の制約として受容する。

-   単一EC2がSPOFとなる。
-   単一AZ障害に耐えられない。
-   Web、Application、Databaseが同一EC2のCPU、Memory、Disk等のリソースを共有する。
-   Applicationを機能単位の独立サービスとして分離していない。
-   自動スケーリングを行わない。
-   OSおよびDocker Hostの運用が必要となる。
-   HTTPS/TLSを実装していない。
-   AWS WAF、Shield Advanced等の追加セキュリティサービスを利用しない。
-   メッセージキューを利用せず、主要業務処理を同期処理としている。
-   Lambda/Fargate等のマネージド実行基盤と比較して、EC2およびOSの運用負荷が残る。

これらは、現在のシステム規模、可用性要件、性能要件、学習・検証環境という前提とのトレードオフとして受容する。

### 21.2 将来の再評価条件

現在のアーキテクチャを固定的なものとはせず、要件変更に応じて再評価する。

- 可用性向上
  - 稼働率99.9%以上
  - RTO/RPOの短縮
  - 単一障害点を許容できない
  
    →Multi-AZ、ApplicationLoad Balancer、複数Application Instance、ECS/Fargate、Amazon RDS Multi-AZ等を候補として再評価する。

- 運用負荷低減
  - OSパッチ等のEC2管理負荷を大幅に削減する
  
    →Applicationを複数Taskへ水平展開する必要がある場合は、AmazonECS + AWS Fargateを候補として再評価する。

- 非同期・イベント駆動処理
  - 長時間処理、外部システム連携、通知処理、処理要求の平準化
  - 外部障害時の再実行等が必要
  
    →Amazon SQS、Worker Container、AWS Lambda等を候補として再評価する。

- Application機能分離
  - 特定機能のみ処理量が増加する
  - 機能ごとの独立リリースが必要となる
  - 障害影響を機能単位で分離する必要がある
  - 異なるチームが機能単位で担当する
  
    →機能単位のContainer分離、AmazonECS/Fargate、必要に応じたMicroservices化を再評価する。

- セキュリティ強化
  - 本番相当環境へ移行する
  - 本番データまたは機密情報を扱う
  - インターネットから不特定多数の利用者がアクセスする
  - 外部公開範囲が拡大する
  - セキュリティ要件または監査要件が強化される
  
    →本番相当環境への移行時はHTTPS / TLSによる通信暗号化を実施する。
    
    →その他の要件に応じて、以下を再評価する。
    
    - AWS WAFによるWeb Application保護
    - AWS Shield Advanced等によるDDoS対策強化
    - AWS Secrets Manager等によるSecret管理
    - MFAおよび外部認証基盤
    - 脆弱性管理・継続的なSecurity Scan
    - Security Logおよび監査Logの強化

- 外部認証基盤との連携
  - 社内Active Directory / LDAPとのユーザー統合が必要となる
  - Single Sign-Onが必要となる
  - 利用者数が増加し、Application内でのユーザー管理負荷が高くなる
  - MFA等の高度な認証機能が必要となる
  - 複数システムで認証基盤を共通化する必要がある
    
    →Active Directory / LDAP、Amazon Cognito、その他の外部IdP利用を再評価する。


- 大規模なコンテナ運用
  - 多数のサービス、複数チーム、高度なオーケストレーション要求等が発生した
  
    →Amazon ECSまたはAmazon EKSを再評価する。


### 21.3 要件トレーサビリティ

| 要件 | アーキテクチャ対応 |
|---|---|
| Web / Application / Database / Storageの論理分離 | Docker ContainerおよびDocker Networkで責務を分離 |
| 業務機能を可能な範囲で分離 | 単一Application内部で機能単位に論理分離 |
| コンポーネント独立変更 | Containerおよび設定ファイル単位で管理 |
| 実行環境の再現 | Dockerfile、requirements.txt、Docker Compose |
| APIによる連携 | FastAPI REST API |
| DB Schema変更の再現 | Alembic Migration |
| RTO/RPO 1日以内 | Terraformによる再構築 + Amazon S3上のDB Backup |
| 同時利用者20名 | 単一EC2を初期Compute基盤として採用 |
| 不要な外部公開の抑止 | Security Group + Docker Network |
| RBAC | Application層で認証・認可 |
| ログ・障害解析 | CloudWatch + CloudWatch Agent + コンポーネント別ログ |
| DB日次Backup | pg_dump + Amazon S3 |
| 定型作業自動化 | Terraform、Docker Compose、Script |
| Gitによる変更管理 | Code / IaC / Migration / DocumentをGit管理 |
| 将来的な自動処理への拡張 | 現在は同期処理とし、必要時にSQS / Worker / Lambda等を再検討 |

------------------------------------------------------------------------

# 24. 関連ドキュメント

-   `docs/01_requirements/business-and-functional-requirements.md`
-   `docs/01_requirements/non-functional-requirements.md`
-   `docs/03_decisions/ADR-001-compute-container-platform.md`
-   `docs/03_decisions/ADR-002-application-structure.md`
-   `docs/03_decisions/ADR-003-network-separation.md`
-   `docs/03_decisions/ADR-004-database.md`
-   `docs/03_decisions/ADR-005-authentication.md`
-   `docs/03_decisions/ADR-006-observability.md`
-   `docs/04_operations/monitoring.md`
-   `docs/04_operations/backup-restore.md`
-   `docs/04_operations/deployment.md`
-   `docs/05_tests/phase1-system-test.md`
-   `docs/06_security/security-check.md`
