# ADR-001 Compute / Container Platform

## 1. 前提と要件

本システムでは、Web、Application、Databaseを実行するための実行方式およびコンテナ実行基盤を決定する必要がある。

本システムの主要な前提および要件は以下の通りである。

- AWS上に構築する小規模な学習・検証環境である
- 同時利用者数は最大20名とする
- 通常操作は3秒以内を目標とする
- 稼働率は99%以上とする
- RTO / RPOは1日以内とする
- 初期構成では物理冗長化およびAuto Scalingを必須としない
- Web、Application、Database、Storageを論理的に分離する
- ApplicationのRuntime、Library、Dependencyを再現可能な形で管理する
- 現在の要件を超える構成要素を追加せず、構成および運用の複雑性を必要最小限とする

これらを踏まえ、以下の2段階で実行基盤を検討する。

1. Application等をどの方式で実行するか
2. Containerを採用する場合、AWS上のどのContainer実行基盤を使用するか

## 2. 主な判断基準

本判断では以下を主要な判断基準とする。

- 要件適合性
  - 現在のシステム規模に適した構成であること
  - 過剰な構成・機能でなく、要件に適した構成であること

- コンポーネント分離
  - Web、Application、Databaseを論理的に分離できること

- 実行環境の再現性
  - Applicationの実行環境を再現可能であること

- 構成の単純性
  - 構成要素および運用対象を必要以上に増加させないこと


## 3. 採用アーキテクチャ

初期構成では、Application等の実行方式としてContainerを採用し、その実行基盤としてAmazon EC2 + Docker Composeを採用する。

```text
Amazon EC2
│
├─ Nginx Container
├─ FastAPI Application Container
└─ PostgreSQL Container
      │
      v
 Docker Volume
      │
      v
     EBS
```

- Web、Application、DatabaseをそれぞれContainerとして論理的に分離し、単一EC2上でDocker Composeにより管理する

- PostgreSQLの永続データはDocker Volumeを介してEBS上へ保持する。


## 4. 実行方式の比較

Web、Application、Databaseの実行方式について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| OSへの直接配置 | 構成要素が少なく、比較的容易に構築できる | RuntimeやDependencyが同一OS上に混在し、Component単位の分離や実行環境の再現性がContainerより低い | △ |
| VM分離 | OS単位でComponentを強く分離できる | ComponentごとにGuest OSが必要となり、Resource消費およびOS管理対象が増加する | △ |
| Container | Componentを個別の実行単位として分離でき、VMより軽量である。Dockerfile等により実行環境を再現しやすい | Container Runtime、Network、Volume等の管理が必要となる | ◎ |
| AWS Lambda | ServerおよびOSの管理が不要で、断続的なアクセスや自動Scaleとの親和性が高い | PostgreSQLを利用する場合はLambdaとは独立したDatabase実行基盤および永続化方式を別途構成する必要がある。API受付やDatabase接続を含めたServerless Architectureの設計が必要 | △ |


以上より、論理分離、実行環境の再現性、Resource効率および構成複雑性のバランスが最も現要件に適しているため、**Container方式を採用する。**


## 5. コンテナ実行基盤の比較

Container方式を採用した上で、AWS上のContainer実行基盤について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| EC2 + Docker Compose | 単一EC2上でWeb、Application、Databaseを実行でき、構成要素を比較的少なくできる。PostgreSQL DataをDocker Volume経由でEBSへ永続化できる | EC2、OS、Docker Runtimeの管理が必要。単一EC2がSPOFとなり、自動的なContainer再配置や水平Scale機能を持たない | ◎ |
| ECS on EC2 | ECSによるTask管理、再配置、水平Scale等へ拡張しやすい | EC2およびOS管理が引き続き必要であり、ECS Cluster、Task Definition、Service等の管理対象が追加される | ○ |
| ECS + Fargate | EC2 Hostの直接管理が不要で、OS管理負荷を削減できる。Task管理や水平Scaleへ対応しやすい | Databaseの実行基盤および永続化方式をApplication実行基盤とは独立して設計する必要があり、構成要素が増加する | ○ |
| EKS | Kubernetesによる高度なContainer Orchestration、Scale、障害復旧等が可能 | Kubernetes Cluster等の追加設計・運用が必要となり、現在の小規模構成に対して複雑性が高い | △ |

以上より、現在の性能・可用性要件を満たしながら構成を最も単純に保つことができるため、**Amazon EC2 + Docker Composeを採用する。**


## 6. 採用による影響

### 6.1 メリット

- Web、Application、DatabaseをContainer単位で論理的に分離できる
- Dockerfile、requirements.txt、Docker Compose等により実行環境を再現できる
- VM方式と比較してResource消費を抑えられる
- Web、Application、Databaseを単一EC2へ集約できる
- PostgreSQL DataをEBS上へ永続化できる
- 現在必要としていない高度なContainer Orchestrationを導入せず、構成を比較的単純に保てる

### 6.2 デメリット・受容する制約

- 単一EC2がSPOFとなる
- EC2障害時にはWeb、Application、Databaseが同時に停止する
- 単一AZ障害に耐えられない
- EC2 OSおよびDocker Runtimeの保守が必要となる
- Web、Application、Databaseが同一EC2のCPU、Memory、Disk等のResourceを共有する
- Applicationの水平Scaleを自動的に行えない

これらは、現在のシステム規模、性能・可用性要件および学習・検証環境という前提とのTrade-offとして受容する。


## 7. 再評価条件

以下の条件が発生した場合、本決定を再評価する。

- 稼働率要件が99.9%以上へ引き上げられる
- RTO / RPOの大幅な短縮が必要となる
- 単一EC2または単一AZをSPOFとして許容できなくなる
- 同時利用者数が現要件の20名を継続的に上回る
- 単一EC2のScale Upのみでは性能要件を満たせなくなる
- Applicationを複数Taskへ水平展開する必要が生じる
- EC2 OSの保守負荷を大幅に削減する必要が生じる
- Container数が増加し、Docker Composeによる管理が困難となる
- ApplicationとDatabaseの物理分離が必要となる
- Serverless Architectureへ移行する明確な要件が発生する

これらの条件が発生した場合は、Amazon ECS、AWS Fargate、Amazon RDS、AWS Lambda、必要に応じてAmazon EKS等を候補として再評価する。


## 8. 関連ドキュメント

- `docs/01_requirements/business-and-functional-requirements.md`
- `docs/01_requirements/non-functional-requirements.md`
- `docs/02_architecture/architecture-design.md`
- `docs/03_decisions/ADR-002-application-structure.md`
- `docs/03_decisions/ADR-003-network-separation.md`
- `docs/03_decisions/ADR-004-database.md`