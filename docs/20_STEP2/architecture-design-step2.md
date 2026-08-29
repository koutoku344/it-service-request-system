# アーキテクチャ設計書　STEP2

## 1. 文書目的

本書は、既存の `docs/02_architecture/architecture-design.md` に対し、システムランク引き上げに伴って変更となるアーキテクチャのみを差分として定義する。

既存要件および本書に記載しない設計方針は、原則として既存のアーキテクチャ設計書を継承する。

今回の変更背景は以下とする。

- システムランクを引き上げる

- 業務量および利用者数は変更しない

- 全社的な認証元統一に伴い、Active Directoryとの認証連携が必要となる

- 有料プランは原則として利用しない

- セキュリティレベルは現行以下へ低下させない

## 2. 変更対象要件

### 2.1 引き上げ要件

| 項目 | 変更前 | 変更後 |
|---|---|---|
| RTO | 1日以内 | 数分以内 |
| RPO | 1日以内 | 数分以内 |
| 単一障害点 | 単一EC2・単一AZを許容 | 単一EC2・単一AZ障害を許容しない |
| ~~認証~~ | ~~Applicationによるローカル認証~~ | ~~Active Directoryを認証元とする外部IdP連携~~ |

※ Active Directoryとの認証元統一について、Microsoft Entra IDとの連携にはHTTPS通信が必要となる。HTTPS通信に使用するPublic Certificateの発行には管理可能な独自ドメインが必要であり、独自ドメインの取得には料金が発生する。また、ALB等に付与されるAWS標準DNS名はAWSが所有・管理するドメインであるため、利用者側で証明書発行に必要なドメイン検証を実施できない。以上より、「有料プランを原則利用しない」という制約を優先し、Entra ID連携およびHTTPS化は今回の構築対象外とする。認証元統一については、別途内部Active Directoryを構築する方式で対応する方針とし、内部Active Directoryの構築および認証連携は次STEP以降の検討対象とする。

### 2.2 現状維持要件

- 業務量は増加しない

- 利用者数は増加しない

- 性能要件は現状維持とする

- 有料プランを原則利用しない

- セキュリティレベルを現行以下へ低下させない

- Applicationの業務機能分割は行わない

- Databaseの業務領域別分割は行わない

- 主要業務処理は同期処理を継続する

上記より、以下は今回の変更対象外とする。

- 利用者数増加を目的としたAuto Scaling、Lambda等へのServerless化による並行実行

- 大量Requestの平準化を目的としたAmazon SQS等のQueue


## 3. 変更後アーキテクチャ基本方針

今回の変更では、既存のEC2 + Docker Composeを基本構成として継続し、以下を変更する。

- EC2を単一AZ・単一Instanceから、2AZ・4Instance構成へ変更する
- Web系EC2を各AZに1台ずつ配置し、Nginx / Applicationを両AZで稼働させる
- ApplicationはActive/Active構成とする
- Database系EC2を各AZに1台ずつ配置し、PostgreSQLをPrimary / Standby構成とする
- Nginx / Application障害時はALBによって異常Web系を切り離す
- Web系とDatabase系を別EC2へ分離し、障害・Fencing範囲を分離する
- PostgreSQL Primary障害時は旧PrimaryのDatabase EC2をFencingした後、Standbyを新Primaryへ昇格する
- 単一コンポーネント障害時は、障害した系のみを切り替える
- AZ障害時は各コンポーネントの冗長化方式に従い、正常AZで処理を継続する
- Dockerによるコンポーネント分離は継続する
- Multi-AZ間およびWeb EC2 / Database EC2間の通信にはVPCおよびSecurity Groupを使用する

Web系とDatabase系を分離する主目的は、PostgreSQLのSplit Brain対策に必要なFencingの影響範囲をDatabase系へ限定することである。

※PostgreSQL Containerのみを停止するFencingも可能であるが、Network Partition等により旧Primary Hostへ到達できない場合、停止命令を実行できない、または停止完了を確認できない可能性がある。その状態でStandbyを昇格すると、旧PrimaryがWrite可能なまま残りSplit BrainとなるRiskがある。そのため、Databaseを専用EC2へ分離し、Database Failover時はAWS Control Planeから旧PrimaryのDatabase EC2を停止する方式をFencingの基本方針とする。これにより、Database Fencing時に正常なNginx / Applicationまで停止することを避ける。

## 4. 変更後物理構成

### 4.1 AWS物理構成

既存の単一AZ・単一EC2構成を廃止し、異なるAvailability ZoneへWeb系EC2とDatabase系EC2を1台ずつ配置する。

```text
                            Internet
                                |
                                v
                               ALB
                         /             ╲
                        v               v
              Availability Zone A   Availability Zone C

              +----------------+    +----------------+
              | Web EC2-A      |    | Web EC2-B      |
              | nginx-A        |    | nginx-B        |
              | application-A  |    | application-B  |
              | Active         |    | Active         |
              +----------------+    +----------------+
                       |                    |
                       |                    |
                       v                    v
              +----------------+    +----------------+
              | DB EC2-C       |    | DB EC2-D       |
              | PostgreSQL-C   |<-->| PostgreSQL-D   |
              | Primary /      | WAL| Primary /      |
              | Standby        |    | Standby        |
              +----------------+    +----------------+
```

※PostgreSQL Primaryは平常時はいずれか一方のDatabase EC2で稼働し、他方をStandbyとする。

※Primary障害後はStandbyを昇格するため、Primaryが存在するAZは固定しない。

※Web系とDatabase系を別EC2へ分離し、Database Fencingによって正常なNginx / Applicationが停止しない構成とする。

### 4.2 EC2配置方針

| 項目 | 方針 |
|---|---|
| EC2数 | 4台 |
| AZ | 異なる2AZを使用 |
| Web EC2 | 各AZへ1台ずつ配置 |
| Database EC2 | 各AZへ1台ずつ配置 |
| Nginx | Web EC2-A / Web EC2-Bで稼働 |
| Application | Web EC2-A / Web EC2-Bで稼働 |
| PostgreSQL | DB EC2-C / DB EC2-Dで稼働し、Primary / Standbyとして利用 |
| Docker | 各EC2でDocker Compose運用を継続 |
| Fencing単位 | Database Failover時は旧Primary Database EC2単位 |

単一Web EC2障害、単一Database EC2障害または単一AZ障害によってシステム全体が停止しない構成とする。

## 5. Application可用性アーキテクチャ

### 5.1 可用性方式比較

Application / Nginxの冗長化方式および通信振替方式について、以下の方式を比較する。

| 方式 | メリット | デメリット | 要件適合性 |
|---|---|---|---|
| Active/Standby + VIP | 既存の単一Endpoint構成に近く、利用者はActive系の切替を意識せず固定IPを利用できる | 障害検知、VIP付替え等のFailover Logicを別途設計する必要がある。また、Multi-AZ間で固定IPを切り替える場合はEIP等が必要となり、追加Costが発生する | × 追加Costが発生するため、無料利用要件に適合しない |
| Active/Standby + Route 53 Failover | DNS LayerでPrimary / Secondaryを切り替えられ、VIP付替えLogicを不要にできる | DNS TTL、Recursive Resolver、Client Cacheの影響により、障害後も旧接続先が一定時間利用される可能性がある。また、Hosted Zone等の追加Costが発生する | × 追加Costが発生するため、無料利用要件に適合しない |
| Active/Active + ALB + コンポーネント間シングルアクセス | ALB Health Checkによって異常Web処理系をTarget Groupから除外でき、Standbyへの昇格処理を必要としない。既存のNginx / Applicationを同一Web EC2 + Docker Composeで運用する構成を継続できる | Applicationのみの障害でも同一AZのNginxを含むWeb処理系全体をTargetから除外するため、正常なComponentを利用しない状態が発生する | ◎ RTO数分以内、単一EC2 / AZ障害排除、既存構成継続、Cost抑制のバランスが最も良い |
| Active/Active + ALB + コンポーネント間クロスアクセス | Nginx / Applicationを独立した障害単位として扱える。Applicationのみの障害時でも、正常なNginxから別AZのApplicationへ処理を継続できる | Nginxから複数ApplicationへのRouting、Health判定、Retry、Application Address管理、Cross-AZ通信等の追加設計が必要となる | △ 要件は満たすが、今回必要とする可用性に対して構成が複雑となる |


比較結果より、Active/Active + ALB + コンポーネント間シングルアクセスを採用する。

採用理由は以下とする。

- ApplicationはStateless Componentである

  - 更新が発生する永続DataをApplication Instance内に保持しない

  - 認証状態はTokenとしてRequestごとに取得する

  - 業務データは共有Databaseへ保存する

  - 特定Application Instanceへ処理を固定する必要がない

- Multi-AZ構成として2台のWeb EC2を常時稼働させるため、Standbyとして待機させるより両系を利用する方がResource効率が高い

- Active/Standbyで必要となるStandby昇格や接続先切替処理が不要であり、ALBによる異常Targetの切り離しによって処理を継続できる

- Nginx / Applicationの個別Scaleおよび独立Deployは要件としていないため、コンポーネント間Cross-AZ Accessによる追加設計を必要としない

- 既存のNginx / Applicationを同一Web EC2 + Docker Composeで運用する構成を活用でき、構成変更を最小限にできる

Active/Activeの採用目的は利用者増加に対する性能向上ではなく、RTO短縮、Failover構成の単純化およびMulti-AZで常時稼働するResourceの有効活用、Stateless Componentとの親和性とする。

### 5.2 構成図

```text
                    Internet
                        |
                        v
                       ALB
                   /         ╲
                  v           v
            Web EC2-A     Web EC2-B
             Nginx-A       Nginx-B
                |             |
                v             v
        Application-A   Application-B
             Active          Active
                ╲             /
                 ╲           /
                  DB Primary
               (DB EC2-C/D)
```

### 5.3 片系稼働時のCapacity方針

Active/Active構成では、一方のWeb処理系が障害となった場合、正常な1系のみで全Requestを処理する。

そのため、以下をCapacity設計上の前提とする。

- 業務量および利用者数は現行から増加しない

- 現行環境は単一AZ・単一EC2で現在の業務量を処理できている

- 各EC2は、片系のみとなった場合でも現行最大業務量を処理可能なCPU / Memory / Database Connection等のCapacityを確保する

- 片系障害時は正常時より残存EC2のResource使用率が上昇し、Response Timeが増加する可能性がある

- 片系状態でも既存性能要件を満たすことをLoad Testで確認する

## 6. Application通信・障害時振替

### 6.1 通常時通信

NginxとApplicationはAZ単位の1つのWeb処理系として扱い、コンポーネント間シングルアクセスとする。

通常時の通信経路は以下とする。

```text
ALB
 |
 +--> Nginx-A --> Application-A
 |
 +--> Nginx-B --> Application-B
```

Nginxから別AZのApplicationへのCross-AZ Accessは行わない。

これにより、通常時のNginx → Application通信を同一AZ内で完結させ、Application間Routing、Service Discovery、Cross-AZ Health Check等の追加設計を回避する。

### 6.2 Health Check

ALBのTargetは各EC2上のNginxとする。

Health Checkには、Nginxの稼働確認だけではなく、Applicationまで正常に到達できるPathを使用する。

```text
ALB
 |
 | Health Check
 v
Nginx
 |
 v
Application
```

これにより、Nginxが正常であってもApplicationが業務Requestを処理できない場合、そのWeb処理系をUnhealthyとして検出する。

### 6.3 障害時振替

NginxまたはApplicationのいずれかが異常となり、そのAZのWeb処理系でRequestを完結できない場合、ALBは対象EC2をTarget Groupから除外する。

Application-A障害時の例を以下に示す。

```text
                  ALB

               /       ╲

              x         |

           EC2-A      EC2-B

         Unhealthy    Healthy

                        |

                        v

                     Nginx-B

                        |

                        v

                  Application-B
```

Application-Aが異常でNginx-Aが正常な場合でも、Applicationまで到達するHealth Checkが失敗するためEC2-AをTargetから除外する。

Nginx-Aが異常でApplication-Aが正常な場合も、利用者からApplication-Aまでの通信経路を形成できないためEC2-AをTargetから除外する。

障害系のStandby昇格や接続先変更処理は行わず、正常なWeb処理系のみで処理を継続する。

### 6.4 Cross-AZ Accessの再評価条件

現時点ではNginx / Application間のCross-AZ Accessを採用しない。

将来、以下が要件化された場合は、コンポーネント間Cross-AZ AccessまたはApplication用Internal Load Balancer構成を再評価する。

- Nginx / Applicationを個別にScaleする

- Nginx / Applicationを独立してDeployする

- Application単体障害時にも正常なNginxを継続利用する

- Component単位で可用性を最大化する

## 7. Database可用性アーキテクチャ

### 7.1 Primary / Standby構成

PostgreSQLはActive/Activeとせず、専用Database EC2上でPrimary / Standby構成とする。

```text
Application-A ----+
                  |
Application-B ----+----> PostgreSQL Primary
                              |
                              | Replication
                              v
                        PostgreSQL Standby

AZ-A                              AZ-C
DB EC2-C                          DB EC2-D
PostgreSQL-C <------------------> PostgreSQL-D
Primary / Standby                 Primary / Standby
```

採用理由は以下とする。

- PostgreSQLは永続Dataを保持するStateful Componentである
- Active/Active化にはMulti-Primary間のData同期、競合解決、Split Brain対策等の追加設計が必要となる
- 業務量・利用者数は増加せず、複数Primaryによる書き込み性能向上を必要としない
- Active/Active化による構築・運用複雑性に対して、今回得られるメリットが小さい
- 有料のDatabase冗長化サービスを前提とせず、既存PostgreSQL Containerを継続利用する
- Web系とDatabase系の障害DomainおよびFencing範囲を分離するため、PostgreSQLは専用Database EC2へ配置する

### 7.2 Replication

PrimaryからStandbyへPostgreSQL Streaming Replicationを行う。

RPO数分以内を満たすようReplication方式を設計する。

以下はDatabase詳細設計で決定する。

- Streaming Replicationの同期 / 非同期方式
- WAL転送方式
- Replication監視
- Replication Lag監視
- Standby再同期方式

### 7.3 Failover / Split Brain対策

Primary障害時には、旧PrimaryをFencingした後にStandbyを新Primaryへ昇格する。

```text
通常時

DB EC2-C                     DB EC2-D
Primary -------------------> Standby
          Replication


Primary障害

DB EC2-C                     DB EC2-D
Primary ?
    |
    | Fencing
    v
EC2 Stop                     Standby
                                |
                                v
                           New Primary
```

Network Partition等では、Standby側から旧Primaryへ到達できなくても、旧Primary自体はClientからのWriteを受け付けられる状態で残っている可能性がある。

この状態でStandbyをPromoteすると、旧Primaryと新Primaryが同時にWriteを受け付けるSplit Brainが発生するRiskがある。

そのため、Standby昇格前に旧Primaryを確実にWrite不能にするFencingを実施する。

| Fencing方式 | メリット | デメリット / Risk | 方針 |
|---|---|---|---|
| PostgreSQL Container停止 | Databaseのみを停止でき、他Componentへの影響が小さい | Network Partition等で旧Primary Hostへ到達できない場合、停止命令を実行できない、または停止完了を確認できない可能性がある | 補助的手段とし、自動Failover時の最終Fencing方式にはしない |
| Database EC2停止 | AWS Control Planeから旧Primary EC2を停止でき、Database通信Networkの断に依存せず旧PrimaryをWrite不能にできる | EC2上の全Processが停止する | 採用。Database専用EC2とすることで停止影響をPostgreSQL系に限定する |

Web系とDatabase系を別EC2へ分離することで、Database Fencing時に正常なNginx / Applicationまで停止することを避ける。

RTO数分以内を満たすため、以下をDatabase詳細設計で決定する。

- Primary障害検知方式
- Failover開始条件
- 旧Primary Fencing開始条件
- Fencing完了確認方式
- Standby昇格方式
- Application接続先切替方式
- 旧Primary復旧後の扱い

単にStandbyを配置するだけではRTO数分以内を保証できないため、障害検知、Fencing、Standby昇格、Application再接続までを一連の復旧処理として設計する。

## 8. 障害切替方針

### 8.1 単一コンポーネント障害

単一コンポーネント障害時は、障害した系のみを切り離し、他コンポーネントの不要な切替は行わない。

| 障害対象 | 切替方針 |
|---|---|
| Nginx-A | ALBがWeb EC2-Aを切り離し、Nginx-Bで通信受付を継続 |
| Application-A | Health Checkを通じてWeb EC2-Aを切り離し、Application-Bで処理を継続 |
| PostgreSQL Primary | 旧Primary Database EC2をFencingした後、StandbyをPrimaryへ昇格 |
| PostgreSQL Standby | Primaryで処理を継続し、Standbyを復旧 |
| Web EC2 | ALBが異常Targetを切り離し、正常Web EC2で処理を継続 |
| Database EC2 Primary | 旧Primary EC2をFencingし、別AZのStandbyを昇格 |

Database障害を理由に正常なNginx / Applicationまで停止・切替することは原則行わない。

Web系とDatabase系を別EC2へ分離することで、Database Fencingの影響をDatabase系に限定する。

### 8.2 AZ障害

AZ全体が停止した場合は、各コンポーネントの冗長化方式に従って正常AZへ処理を集約する。

```text
AZ-A障害                       AZ-C

Web EC2-A ×                    Web EC2-B
Nginx-A ×                      Nginx-B Active
Application-A ×                Application-B Active

DB EC2-C ×                     DB EC2-D
DB Primary ×                   DB Standby
                                  |
                                  v
                              New Primary
```

これはシステム全体を一括してSite Failoverする方式ではなく、各コンポーネントが個別のFailover方式に従った結果、正常AZへ処理が集約される構成とする。

## 9. Networkアーキテクチャ

### 9.1 Network要件

既存のFrontend / Backendの2層構造を継続する。

| Layer | Component | InternetからのInbound | InternetへのOutbound | 主な内部通信 |
|---|---|---:|---:|---|
| Frontend | Nginx | ALB経由で必要 | 原則不要 | Application |
| Backend | Application | 不要 | 原則不要 | Nginx、Database |
| Backend | Database | 不要 | 不要 | Application、Database Replication |

論理構成は以下とする。

```text
Internet
   |
   v
ALB
   |
   v
Web EC2
Nginx
   |
   v
Application
   |
   | VPC / Security Group
   v
DB EC2
PostgreSQL
```

Nginx / Applicationは同一Web EC2上でDocker Networkを利用する。

ApplicationとDatabaseは別EC2となるため、ApplicationからPostgreSQLへの通信はVPCおよびSecurity Groupで制御する。

Application / DatabaseをInternetから直接公開しない。

### 9.2 Multi-AZ Host間通信

Docker Bridge Networkは単一Docker Host内部のみのNetworkである。

別EC2間の通信にはVPCおよびSecurity Groupを利用する。

主なHost間通信は以下とする。

| 通信元 | 通信先 | 用途 |
|---|---|---|
| Application-A | Current PostgreSQL Primary | Database接続 |
| Application-B | Current PostgreSQL Primary | Database接続 |
| PostgreSQL Primary | PostgreSQL Standby | Replication |
| Failover制御 | 旧Primary Database EC2 | Fencing |

Database Primaryが別AZへ移動しても、正常なNginx / Applicationは両AZでActive/Activeを継続する。

## 11. RTO / RPOアーキテクチャ

### 11.1 RTO

RTO数分以内の対象障害は以下とする。

- 単一Web EC2障害
- 単一Database EC2障害
- 単一AZ障害
- 単一Nginx Container障害
- 単一Application Container障害
- PostgreSQL Primary障害

Region全体障害は今回の対象外とする。

| Component | RTO達成方式 |
|---|---|
| Nginx | 両AZでActive/Active稼働し、ALB Health Checkにより異常Web系を切り離す |
| Application | 両AZでActive/Active稼働し、異常Web系をALB経由で切り離す |
| Database | 専用Database EC2上でPrimary/Standby構成とし、Primary障害時は旧Primary EC2をFencingした後にStandbyを昇格し、Applicationを新Primaryへ再接続する |

### 11.2 RPO

RPOは障害発生時に失うことを許容する永続Data / Stateの時間量として定義する。

Nginx / Applicationで保持するHTML、Configuration、Program Code等は業務Transactionにより実行時に更新されるDataではなく、Version管理されたDeployment Artifact / Configurationである。

そのため、Databaseと同様の継続Replicationではなく、Git / GitHubをSource of Truthとして変更時にVersion管理し、両Web EC2へ同一VersionをDeployすることで保護する。

| Component | 保護対象 | RPO達成方式 |
|---|---|---|
| Nginx | Nginx Configuration、HTML / CSS / JavaScript等のFrontend Artifact | Git / GitHubを正として管理し、変更時にCommitした同一Versionを両Web EC2へDeployする。EC2障害時は最新Commitから再現可能とする |
| Application | Application Code、Dockerfile、依存関係、Application Configuration | Git / GitHubを正として管理し、変更時にCommitした同一Versionを両Web EC2へDeployする。実行時に更新される永続DataをApplication Localへ保持しない |
| Database | 申請、承認履歴、Master等の実行時に更新される永続Data | PrimaryからStandbyへ継続Replicationし、Replication Lagを数分以内に維持する |

Nginx / Applicationは「永続Dataを一切持たない」のではなく、Code / Configuration / Static Fileを持つ。

ただし、それらはRequest処理により更新される業務上の永続Stateではなく、Gitで再生成・再配置可能なArtifactであるため、Database Replicationの対象とはしない。

EC2上で直接Configuration / Programを修正し、Gitへ反映しない運用は行わない。

DatabaseについてはReplication Lagを監視し、RPO数分以内を逸脱する状態を検知する。

## 12. 監視変更

Multi-AZ、Web / Database EC2分離およびPrimary/Standby化に伴い、既存監視対象へ以下を追加する。

| 対象 | 監視項目 | 目的 |
|---|---|---|
| ALB | Healthy / Unhealthy Host Count | 通信振分先の健全性確認 |
| Web EC2-A / Web EC2-B | Instance稼働状態 | Web系障害検知 |
| Nginx-A / Nginx-B | Health Check | ALB切離し判断 |
| Application-A / Application-B | Health Check | ALB切離し判断 |
| DB EC2-C / DB EC2-D | Instance稼働状態 | Database Host障害検知 / Fencing状態確認 |
| PostgreSQL Primary | 稼働状態 | DB Failover判断 |
| PostgreSQL Standby | 稼働状態 | Standby利用可否確認 |
| PostgreSQL Replication | Replication状態 | RPO逸脱検知 |
| PostgreSQL Replication | Replication Lag | Standby遅延検知 |

具体的な閾値、評価期間、通知方式は監視設計で定義する。

## 13. Backup / Restore変更

既存のPostgreSQL論理Backupを継続する。

Replicationは可用性および短いRPOを実現する方式であり、Backupの代替とはしない。

Primary上で発生した誤削除や論理破損がStandbyへReplicationされる可能性があるため、`pg_dump` による論理BackupをAmazon S3へ別途保持する。

| 方式 | 主目的 |

|---|---|

| PostgreSQL Replication | Primary障害時の継続、RPO数分以内 |

| pg_dump + Amazon S3 | 誤操作、論理破損等からのData復旧 |

## 14. セキュリティ変更

### 14.1 基本方針

今回の変更ではセキュリティレベル向上自体を必須要件としない。

ただし、構成変更によって現行セキュリティレベルを低下させない。

- 利用者向けHTTP通信はALBを入口とする
- Application / DatabaseをInternetへ直接公開しない
- Web EC2 / Database EC2への直接Inboundは管理用SSH等の必要通信のみに限定する
- Web系とDatabase系でSecurity Groupを分離する
- Host間通信はSecurity Groupで必要Portのみ許可する
- 同一Web EC2内のContainer間通信はDocker Networkで必要経路のみに限定する

### 14.2 Security Group

以下のSecurity Groupを定義する。

#### ALB-SG

| Direction | Protocol / Port | Source / Destination | 用途 |
|---|---|---|---|
| Inbound | TCP/80 | 利用者接続元 | HTTPアクセス |
| Outbound | TCP/80 | WEB-EC2-SG | Nginxへの転送 |

#### WEB-EC2-SG

Web EC2-A / Web EC2-Bへ適用する。

| Direction | Protocol / Port | Source / Destination | 用途 |
|---|---|---|---|
| Inbound | TCP/80 | ALB-SG | ALBからNginxへの通信 |
| Inbound | TCP/22 | 管理端末の固定IP / 管理Network | SSH管理 |
| Outbound | TCP/5432 | DB-EC2-SG | ApplicationからCurrent PrimaryへのDB接続 |
| Outbound | 必要な範囲 | 必要な宛先 | OS Update、Package取得等、運用上必要な通信 |

Application Port（例：TCP/8000）はHost外へ直接公開しない。

同一Web EC2内のNginx → Application通信はDocker Networkを利用する。

#### DB-EC2-SG

DB EC2-C / DB EC2-Dへ適用する。

| Direction | Protocol / Port | Source / Destination | 用途 |
|---|---|---|---|
| Inbound | TCP/5432 | WEB-EC2-SG | ApplicationからDatabaseへの接続 |
| Inbound | TCP/5432 | DB-EC2-SG（Self Reference） | PostgreSQL Replication |
| Inbound | TCP/22 | 管理端末の固定IP / 管理Network | SSH管理 |
| Outbound | TCP/5432 | DB-EC2-SG | PostgreSQL Replication |
| Outbound | 必要な範囲 | 必要な宛先 | OS Update、Package取得等、運用上必要な通信 |

PostgreSQL TCP/5432はInternetから許可しない。

※OS Update等のInternet Outboundが必要な場合は、EC2 Host単位で必要最小限に許可する。Application / Databaseの業務通信としてInternet Outboundを必要としない。

### 14.3 Route Table

AZ-A / AZ-CにPublic Subnetを1つずつ配置する。

Application Load BalancerはAZごとに別々のALBを構築するのではなく、1つの論理ALBで複数Availability Zoneを有効化する。

ALB作成時にPublic Subnet-AおよびPublic Subnet-Cを指定すると、AWSが各有効AZのSubnet内にLoad Balancer Nodeを管理する。

利用者から見たAccess EndpointはALBの1つのDNS Nameであり、利用者がAZまたはALB Nodeを選択する必要はない。

```text
                         Internet
                             |
                             v
                    +----------------+
                    |      ALB       |
                    |  Single DNS    |
                    +-------+--------+
                            |
                  +---------+---------+
                  |                   |
                  v                   v
        Public Subnet-A         Public Subnet-C
             AZ-A                    AZ-C
          /       ╲                /       ╲
         v         v              v         v
   Web EC2-A   DB EC2-C     Web EC2-B   DB EC2-D
```

内部的にはAWS管理のALB Nodeが各有効AZに存在するが、設計上は1つのALBとして扱う。

ALBはTarget Groupに登録されたWeb EC2-A / Web EC2-BのHealthを確認し、HealthyなTargetへRequestを分散する。

各Subnetに関連付けるRoute Tableは以下を基本とする。

| Destination | Target | 用途 |
|---|---|---|
| VPC CIDR | local | Web EC2 / DB EC2 / ALB等のVPC内部通信 |
| 0.0.0.0/0 | Internet Gateway | ALBのInternet通信、EC2管理・運用上必要な外部通信 |

EC2がPublic Subnetに存在しても、Security Groupにより利用者からWeb EC2:80への直接通信を許可せず、ALB-SGからの通信のみ許可する。

ApplicationおよびPostgreSQLはInternetへ直接公開しない。

## 15. 非採用・継続判断

### 15.1 Serverless化

Lambda等への移行は行わない。

理由：

- 業務量・利用者数の増加がない

- 既存Container資産を継続利用できる

- Serverless化による構成変更効果より移行影響が大きい

### 15.2 Queue

Amazon SQS等は採用しない。

理由：

- 大量Requestの平準化要件がない

- 長時間非同期処理の追加要件がない

- 既存同期処理で性能要件を満たしている

### 15.3 Database Active/Active

採用しない。

理由：

- 書き込み性能向上要件がない

- Multi-Primary整合性設計が必要となる

- Split Brain、競合解決等の追加運用が必要となる

- Primary/Standbyで今回の可用性要件を満たす方針とする

### 15.4 RDS Multi-AZ

今回の基本構成では採用しない。

理由：

- 有料プランを原則利用しないというコスト制約

- 既存PostgreSQL Containerを継続利用する

- 自前Primary/Standby構成を採用する

ただし、自前PostgreSQL HAではFailover、Split Brain対策、Replication監視等の運用負荷が増加するため、コスト制約が緩和された場合はRDS Multi-AZを再評価する。

### 15.5 ECS / Fargate

今回の基本構成では採用しない。

理由：

- 利用者数および業務量の増加がない

- 既存Docker Compose資産を継続利用できる

- 自動ScalingおよびContainer Orchestration強化が必須要件ではない

Subnet / Security Group単位でContainerを独立配置することが必須となった場合は、ECS `awsvpc` Network Mode等を再評価する。

## 16. 未決事項

| 項目 | 未決事項 | 決定工程 |
|---|---|---|
| PostgreSQL Replication | 同期 / 非同期 | Database詳細設計 |
| DB Failover | 障害検知、Standby昇格、自動 / 手動 | Database詳細設計 |
| DB接続先切替 | Multi-Host接続 / その他 | Database詳細設計 |
| Split Brain対策 | EC2 Fencing開始条件、Fencing完了確認 | Database詳細設計 |
| 旧Primary復旧 | Standbyへの再参加方式 | Database詳細設計 |

## 17. 変更後構成

```text
                             Internet
                                 |
                                 v
                                ALB
                          /             ╲
                         v               v

               Availability Zone A   Availability Zone C

               +----------------+    +----------------+
               | Web EC2-A      |    | Web EC2-B      |
               | nginx-A Active |    | nginx-B Active |
               |       |        |    |       |        |
               | app-A Active   |    | app-B Active   |
               +----------------+    +----------------+
                        |                    |
                        v                    v
               +----------------+    +----------------+
               | DB EC2-C       |    | DB EC2-D       |
               | postgres-C     |<-->| postgres-D     |
               | Primary /      | WAL| Primary /      |
               | Standby        |    | Standby        |
               +----------------+    +----------------+

Host内部（Web EC2）:

nginx
  |
  | frontend Docker Network
  v
application

Host内部（DB EC2）:

postgres
  |
  v
postgres_data
```

### 17.1 移行方針

既存サービスへの影響を最小化し、単一AZ / 単一EC2構成から4 EC2・Multi-AZ構成へ段階的に移行する。

基本方針は、既存EC2を稼働継続しながら新規Web EC2 / Database EC2を構築・検証し、利用者Endpoint切替とDatabase移行を分離して実施する。

利用者側の接続先変更が発生するPhaseでは旧EC2 Public IPを一定期間併存させ、システム停止時間は原則発生させない。

```text
Phase 1  現行EC2を稼働継続
   |
   +--> 新規Web EC2-Bを構築
   +--> 新規DB EC2-Dを構築
   |
Phase 2  PostgreSQL Replication準備・Standby構築
   |
Phase 3  ALB構築・事前Test
   |     Target = 現行Web系
   |     ※利用者Trafficは既存Endpointを継続
   |
Phase 4  Access EndpointをALBへ変更
   |     ※旧EC2 Public IPを一定期間併存
   |
Phase 5  新規Web EC2-BでTraffic処理を確認
   |
Phase 6  AZ-A側へWeb EC2-A / DB EC2-Cを構築・変更適用
   |
Phase 7  Web EC2-A / Web EC2-BをALB Targetへ登録
   |
Phase 8  DatabaseをDB EC2-C / DB EC2-DのPrimary / Standby構成へ移行
   |
Phase 9  Failover / Fencing Test後、旧EC2上のPostgreSQLを撤去
```

#### 移行手順

1. 現行EC2を稼働したまま、新規AZ側へWeb EC2-BおよびDB EC2-Dを構築する。
2. Web EC2-BへNginx / Applicationの変更後構成をDeployする。
3. Database詳細設計で確定した方式に従い、DB EC2-DへPostgreSQL Standbyを構築する。
4. Replication Lag、ApplicationからDatabaseへの接続、Nginx / Application Health Checkを確認する。
5. ALBを2AZのPublic Subnetに構築し、利用者切替前に疎通・画面表示・API処理・Health Checkを確認する。
6. 利用者へALB DNS Nameを新Access Endpointとして案内し、旧EC2 Public IPと一定期間併存させる。
7. 新規Web EC2-Bで業務Trafficを処理できることを確認する。
8. AZ-A側へWeb EC2-AおよびDB EC2-Cを構築し、変更後構成を適用する。
9. Web EC2-A / Web EC2-BをALB Targetへ登録し、双方Healthyであることを確認する。
10. DatabaseをDB EC2-C / DB EC2-DのPrimary / Standby構成へ移行する。
11. ApplicationからCurrent Primaryへの接続およびReplicationを確認する。
12. Database詳細設計で定義した手順によりFailover / Fencing Testを実施する。
13. 移行完了後、旧EC2上のPostgreSQLを停止・撤去する。
14. 利用者から旧EC2 Public IPへの直接HTTP Accessを閉塞し、ALBを利用者向け唯一のWeb Endpointとする。

#### Database移行時の考え方

Nginx / ApplicationのTraffic切替とDatabase Role切替を同時に行わない。

Web系とDatabase系を分離して段階的に移行することで、障害発生時の切り分けおよびRollbackを容易にする。

PostgreSQLの無停止移行可否、初期同期方式、Primary切替時のWrite停止要否はDatabase詳細設計で確定する。

#### 業務影響

新規EC2構築、Replication準備、ALB事前Test等は既存系を稼働させたまま実施する。

利用者Access EndpointをALBへ変更する際は利用者への案内・Bookmark / 手順変更等の業務影響が発生するが、旧Endpointを一定期間併存させることで利用不能時間は原則発生させない。

Database Primary切替時の業務影響はDatabase詳細設計で確定する。

## 18. まとめ

### 18.1 主な変更点

| 項目 | 既存 | 変更後 |
|---|---|---|
| AZ | Single-AZ | Multi-AZ |
| EC2 | 1台 | 4台（Web 2台 + Database 2台） |
| Nginx | 1系 | Web EC2上でActive/Active |
| Application | 1系 | Web EC2上でActive/Active |
| Application通信振分 | なし | ALB |
| Database | Single PostgreSQL | 専用Database EC2上でPostgreSQL Primary/Standby |
| Web / Database配置 | 同一EC2 | 別EC2へ分離 |
| Web障害制御 | なし | ALB Target切離し |
| Database障害制御 | Backup & Restore中心 | Replication + Failover + Database EC2 Fencing |
| Fencing範囲 | なし | 旧Primary Database EC2単位 |
| RTO | 1日以内 | 数分以内 |
| RPO | 1日以内 | 数分以内 |
| DB Recovery | Backup & Restore中心 | Replication + Backup |
| Network分離 | Docker frontend / backend | Web内部はDocker Network、Web / DB間はVPC / SG |
| Scaling | 単一系 | 性能目的のAuto Scalingは追加しない |
| Queue | なし | 変更なし |
| Serverless | なし | 変更なし |

### 18.2 享受する制約

変更後も以下を既知の制約として受容する。

- Nginx / Applicationは同一Web EC2 Host上で稼働するため、Web Hostが共通Security / Failure Boundaryとなる
- Application単体障害でもWeb EC2単位でALB Targetから除外するため、正常なNginxを一時的に利用しない場合がある
- PostgreSQL HAを自前構築するため、RDS Multi-AZと比較してReplication、Failover、Split Brain対策等の運用負荷が高い
- Database FailoverではSplit Brain防止を優先し、旧Primary Database EC2をFencingする
- PostgreSQL Container停止によるFencingはNetwork Partition時に停止命令または停止完了確認ができない可能性があるため、最終FencingはDatabase EC2単位とする
- Database EC2を分離するため、EC2 / EBSのResource使用量およびAWS Credit消費量は2台構成より増加する
- Region全体障害はRTO数分以内の対象外とする
- ALB、EC2、EBS、Public IPv4等はAccountのAWS Free Tier / Credit条件を超えた場合に費用が発生する可能性がある

### 18.3 要件トレーサビリティ

#### 変更要件へのトレース

| 要件 | 適合状況 | 適合理由・対応方針 |
|---|---|---|
| RTO 数分以内 | ○ | Multi-AZ、Nginx / Application Active/Active、ALB Health Check、DB Primary/Standby + Fencing / Failoverにより単一障害時も短時間で処理継続・復旧可能とする |
| RPO 数分以内 | ○ | Nginx / ApplicationはGit管理した構成から再現可能とし、Databaseは継続Replicationにより更新DataをStandbyへ反映する |
| 単一EC2障害を許容しない | ○ | Web EC2 / Database EC2を各2AZへ分散し、単一EC2障害時も対応する別系で継続する |
| 単一AZ障害を許容しない | ○ | Web EC2とDatabase EC2を両AZへ配置し、正常AZでWeb処理とDatabase処理を継続する |
| 認証元統一 | 今回対象外 | 外部IdP連携に必要なHTTPS化と独自ドメイン取得が無料利用要件と競合するため、別途内部Active Directoryを構築する方式で今後対応する |

#### 既存要件へのトレース

| 既存要件 | 適合状況 | 適合理由・対応方針 |
|---|---|---|
| 業務量増加なし | ○ | 性能目的のAuto Scalingや追加分散機構は導入しない |
| 利用者数増加なし | ○ | Lambda等へのServerless化は行わない |
| 主要処理は同期処理 | ○ | SQS等のQueueを追加しない |
| Container運用 | ○ | EC2 + Docker Composeを継続する |
| Application業務機能分割なし | ○ | 単一Application構造を継続する |
| Database業務領域分割なし | ○ | 単一PostgreSQL DatabaseをPrimary/Standby化する |
| Gitによる構成管理 | ○ | Nginx / Application / Docker設定をGit管理し、両Web EC2へ同一Versionを適用する |
| CloudWatch監視 | ○ | Multi-AZ / Web・DB EC2 / Replication / ALB監視を追加する |
| S3 DB Backup | ○ | pg_dump + S3を論理Backupとして継続する |
| 有料プランを原則使用しない | ○ | EC2 + Docker Compose + PostgreSQLを中心に構成し、AWS Free Tier / Creditを活用する |

