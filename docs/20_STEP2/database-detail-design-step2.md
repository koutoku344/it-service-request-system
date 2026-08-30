# Database設計書 STEP2

## 1. 文書目的

本書は、アーキテクチャ設計書 STEP2 で決定したPostgreSQL Primary / Standby構成について、Multi-AZ化に必要となるDatabaseの冗長化、Replication、Failover、Application接続先切替、Split Brain防止、監視、復旧方針を定義する。

既存の論理Database SchemaおよびApplicationから利用する業務Tableは原則変更しない。

今回のDatabase設計で達成する主要要件は以下とする。

- RTO：数分以内

- RPO：数分以内

- 単一EC2障害を許容しない

- 単一AZ障害を許容しない

- 有料のDatabase冗長化Serviceを利用しない

- 既存PostgreSQL Containerを継続利用する

- 業務量および利用者数は現状から増加しない



## 2. 設計対象

### 2.1 対象

本書では以下を設計対象とする。

- PostgreSQL Primary / Standby構成

- PostgreSQL Streaming Replication

- WAL転送

- Replication Slot

- ApplicationからPrimaryへの接続方式

- Primary障害検知

- Standby昇格

- Application接続先切替

- Split Brain防止

- 旧Primaryの復旧・Standby再参加

- Replication監視

- RTO / RPO達成方式

- Backup / Restoreとの役割分担

- Multi-AZ間Database通信

### 2.2 対象外

以下は既存設計を継承し、本書では変更しない。

- 業務Tableの論理分割

- DatabaseのSharding

- Read ReplicaによるRead Scale

- Multi-Primary / Active-Active Database

- Application機能単位のDatabase分離

- PostgreSQLからRDS等Managed Databaseへの移行



## 3. 既存Database構成

既存環境では1台のEC2上でPostgreSQL 16 Containerを稼働し、Docker Volume `postgres_data` にDatabase Dataを永続化している。

ApplicationはDocker Network `backend` 上のService名 `postgres` を接続先としている。

```text
EC2-A
Application
    |
    | Docker backend Network
    | postgres:5432
    v
PostgreSQL
    |
    v
postgres_data
```

既存の主要Tableは以下とする。

| Table | 用途 |
|---|---|
| `requests` | 申請Data |
| `approval_histories` | 承認・却下等の履歴 |
| `users` | User / Role管理 |
| `request_type_masters` | 申請種別Master |

今回のHA化による論理Schema変更は行わない。



## 4. 変更後Database構成

PostgreSQLはWeb系EC2から分離し、異なるAvailability ZoneのDatabase専用EC2へ1台ずつ配置してPrimary / Standby構成とする。

```text
                 Web EC2-A                    Web EC2-B
               Application-A                Application-B
                     |                            |
                     +------------+---------------+
                                  |
                                  v
                           Current Primary
                                  |
                                  | WAL
                                  v

AZ-A                                             AZ-C

+----------------------+              +----------------------+
| DB EC2-C             |              | DB EC2-D             |
|                      |              |                      |
| PostgreSQL-C         |<------------>| PostgreSQL-D         |
| Primary / Standby    | Replication  | Primary / Standby    |
|                      |              |                      |
| postgres_data_C      |              | postgres_data_D      |
+----------------------+              +----------------------+
```

平常時は片方のみをPrimaryとし、もう一方をStandbyとする。

Primary障害時は、旧PrimaryのDatabase EC2をFencingした後、Standbyを新Primaryへ昇格する。

Primaryが存在するAZは固定しない。

Web系とDatabase系を別EC2へ分離する目的は、PostgreSQLのSplit Brain対策でDatabase HostをFencingする際に、正常なNginx / Applicationを巻き込んで停止させないことである。

## 5. Replication方式

### 5.1 Replication方式比較

| 方式 | メリット | デメリット | 要件適合性 |
|---|---|---|---|
| Synchronous Streaming Replication | StandbyへのWAL反映をCommit成立条件にでき、Data Lossを極小化できる | StandbyまたはAZ間Network障害時にCommit待ちやWrite停止が発生し、Availabilityへ影響する | △ RPOは強化できるが、今回のRPOは0ではなく数分以内であり、Availabilityへの影響が大きい |
| Asynchronous Streaming Replication | Standby障害時もPrimaryのWriteを継続できる。Cross-AZ待ち時間を通常TransactionのCommitへ追加しない | Primary障害時、Standbyへ未転送・未反映の直近Transactionを失う可能性がある。Replication Lagが常に数分以内になることを方式自体では保証しない | ◎ RPO数分以内を満たせるCapacityを確保し、Replication Lag監視と異常時制御を組み合わせることで要件へ適合させる |

### 5.2 採用方式

Asynchronous Streaming Replicationを採用する。

PostgreSQL Streaming Replicationは非同期がDefaultであり、StandbyがPrimaryの負荷へ十分追従できる場合、通常のReplication Delayは小さい(1秒未満)。

ただし、非同期Replicationそのものに「Primary Commit後、必ず数分以内にStandbyへ反映される」という時間保証はない。

Network断、Standby高負荷、Disk I/O遅延、Standby停止等によりReplication Lagが拡大する可能性がある。

したがって本設計では、以下の考え方でRPO数分以内を担保する。

- 平常時にStandbyがPrimaryのWAL生成量へ十分追従できるCPU / Memory / Disk / Network Capacityを確保する

- Replication Lagを継続監視する

- RPO設計目標を3分以内とする

- Warning閾値を1分、Critical閾値を2分30秒とし、3分到達前に対応を開始する

- 3分を超過した状態ではRPO要件を保証できない状態として扱う

- Replication Lagが解消するまでFailover可能状態とはみなさない

- 必要に応じてApplicationのWrite受付を一時停止し、追加の未Replication Transaction発生を抑止する

Replication Lag増大時は原因に応じて以下を実施する。

| 原因 | 対応 |
|---|---|
| Standby PostgreSQL停止 | Standbyを復旧しReplicationを再開 |
| AZ間Network異常 | Network / Security Group / Host疎通を確認し復旧 |
| Standby CPU / Memory不足 | Process確認、不要処理停止。恒常的不足であればInstance Sizeを再評価 |
| Standby Disk I/O不足 | Disk使用率 / IOPS / Latencyを確認し、必要に応じてStorage性能を再評価 |
| WAL Replay遅延 | Standby負荷、Long Query等を確認しReplay阻害要因を除去 |
| Replication Slot / WAL異常 | Slot状態、WAL保持量を確認し、必要に応じてStandbyを再初期化 |

### 5.3 Primary障害時の未Replication Data

Asynchronous Replicationでは、PrimaryでCommit済みでもStandbyへ到達していないWALが存在する状態でPrimaryが完全故障すると、そのTransactionはNew Primaryには存在しない。

これはRPOで許容するData Lossに該当する。

例えばStandbyがPrimaryより30秒遅れている状態でPrimaryが復旧不能となった場合、最大約30秒分のCommit済みTransactionが失われる可能性がある。

```text

Primary

T1 ---- T2 ---- T3 ---- T4 ---- 障害

                    ╲

Standby              T3まで反映

New Primary

T1 / T2 / T3 は存在

T4 は存在しない可能性

```

PostgreSQLでは変更内容をWALとして記録しているが、WALがStandbyや別の保存先へ転送される前にPrimary自体を失った場合、そのWALをNew Primaryから復元することはできない。

旧PrimaryのDiskが生存しておりWALを回収できる場合でも、Standby昇格後はTimelineが分岐するため、旧Primary上の未Replication TransactionをNew Primaryへ単純に再適用する運用は行わない。

RPO 0、すなわちCommit済みTransactionを失うことを許容しない場合は、Synchronous Replication等を採用する必要がある。

本設計ではRPO 3分以内を許容するため、Asynchronous Replication + Lag監視を採用する。



## 6. WAL / Replication設定

### 6.1 基本方針

PostgreSQLのPhysical Streaming Replicationを使用する。

PrimaryはWALをStandbyへ継続転送し、Standbyは受信したWALを順次Replayする。

```text
Application
    |
    v
Primary
    |
    | WAL
    v
Standby
```

### 6.2 PostgreSQL主要設定

以下の設定を使用する。

| Parameter / 機能 | 方針 | 用途 |
|---|---|---|
| `wal_level` | `replica`以上 | Physical Replicationを有効化 |
| `max_wal_senders` | Standby数＋保守用Connectionを許容 | WAL Sender Process確保 |
| `max_replication_slots` | Physical Replication Slotを利用可能な値 | WAL保持 |
| `hot_standby` | `on` | Standbyとして正常稼働可能にする |
| `wal_log_hints` | `on` | Failover後に旧Primaryへ`pg_rewind`を利用可能にする |
| `synchronous_standby_names` | 設定しない | Asynchronous Replicationとする |
| `max_slot_wal_keep_size` | 上限を設定する | Standby停止時のWAL無制限蓄積を防止 |

`max_wal_senders`、`max_replication_slots`、`max_slot_wal_keep_size`の具体値は、初期構築時のWAL発生量およびDisk容量を確認して決定する。

### 6.3 Physical Replication Slot

```text
WAL = Database変更内容を記録したTransaction Log
Physical Replication Slot = Standbyが必要としているWAL位置をPrimaryへ記録するBookmark
```

概念図：

```text
Primary pg_wal
[WAL1][WAL2][WAL3][WAL4][WAL5]
                   ^
                   |
          Replication Slot
          restart_lsn
```

PrimaryにPhysical Replication Slotを作成し、Standbyがまだ必要としているWALをPrimaryが早期削除しないようにする。

Replication Slotを使用しない場合、Standby停止が長時間続くと、Standbyがまだ受信していない古いWALをPrimaryがRecycleしてしまい、Streaming Replicationを継続できなくなる場合がある。

一方、Replication SlotはStandby長期停止時にWALを保持し続け、Primary Diskを圧迫する可能性がある。

そのため以下を行う。

- `max_slot_wal_keep_size`でWAL保持量に上限を設ける

- `pg_wal`使用量を監視する

- Standby長期停止時は復旧を優先する

- 必要なWALが失われた場合はStandbyを`pg_basebackup`から再構築する



## 7. Replication User / Database認証

Replication専用Userを作成する。

例：

```text
replicator
```

Replication UserにはReplicationに必要な権限のみを付与し、Application Userとは分離する。

`pg_hba.conf`では、Replication通信をDB EC2-C / DB EC2-DのPrivate IPに限定する。

概念例：

```text
host replication replicator <DB EC2-C Private IP>/32 scram-sha-256
host replication replicator <DB EC2-D Private IP>/32 scram-sha-256
```

ApplicationからDatabaseへの接続は、Web EC2-A / Web EC2-Bからの接続のみ許可する。

Network LayerではSecurity Groupにより、Application接続用TCP/5432をWEB-EC2-SGからDB-EC2-SGへ、Replication用TCP/5432をDB-EC2-SG間のみに限定する。

## 8. Application接続方式

### 8.1 基本方針

Application-A / Application-Bは、常にCurrent Primaryへ接続する。

ApplicationはDB EC2-C / DB EC2-DのPrivate IPを接続候補として保持し、PostgreSQL ClientのMulti-Host接続と`target_session_attrs=read-write`を利用する。

ApplicationからPostgreSQLへの接続では、以下の3つの仕組みを組み合わせる。

```text
target_session_attrs=read-write
    ↓
Connection作成時にRead / Write可能なPrimaryを選択

pool_pre_ping=True
    ↓
Connection PoolからConnectionを取り出す際、
Poolに残っているConnectionが現在も利用可能か確認

Connection Pool
    ↓
正常なConnectionを保持し、複数のRequest / Queryで再利用
```

全体の流れは以下とする。

```text
Application-A / Application-B
          |
          | DB処理開始
          v
    Connection Pool
          |
          | ConnectionをCheckout
          v
     pool_pre_ping
          |
          +-- Connection正常
          |       |
          |       v
          |   既存Connectionを再利用
          |
          +-- Connection異常 / Poolに利用可能Connectionなし
                  |
                  v
             New Connection作成
                  |
                  +---- DB EC2-C / PostgreSQL-C
                  |
                  +---- DB EC2-D / PostgreSQL-D
                               |
                               v
                   target_session_attrs=read-write
                               |
                               v
                    Read / Write可能なPrimaryを採用
                               |
                               v
                         SQL / Transaction
                               |
                               v
                    ConnectionをPoolへ返却
```

一度作成されたConnectionはConnection Poolへ保持され、そのConnectionが正常である限り複数のRequest / Queryで再利用する。

New Connectionが作成される主な契機は以下とする。

- Application起動後、初めてDB Connectionが必要となった場合
- Connection Pool内に空きConnectionがなく、Pool設定上Connection追加が可能な場合
- `pool_pre_ping`により既存Connectionが無効と判断された場合
- SQL実行中の切断等によってSQLAlchemyが既存ConnectionをInvalidと判断し、その後新しいConnectionが必要となった場合
- Connection PoolのRecycle / Timeout等の設定により既存Connectionが更新対象となった場合

PostgreSQL ClientはNew Connection作成時に複数Hostを試行し、`target_session_attrs=read-write`によりRead-Write Transactionを受け付けるServerのみを接続先として採用する。

これによりStandby昇格後、New Connectionは新Primaryへ自動的に接続可能となる。

※事前にPrimaryコネクションを用意しておき、該当コネクションを使用してクエリを実行する。（クエリを実行する前にコネクションが有効かを`pool_pre_ping`にて確認）


### 8.2 既存方式からの変更

既存環境ではApplicationとPostgreSQLが同一EC2上にあり、Docker Service名`postgres`のみを接続先としている。

```text
postgres:5432
```

変更後はApplicationとPostgreSQLが別EC2となるため、DB EC2-C / DB EC2-DのPrivate IPをConnection Stringへ定義する。

概念例：

```text
DB_HOSTS=<DB EC2-C Private IP>,<DB EC2-D Private IP>
DB_PORT=5432
```

実際のSQLAlchemy / psycopg Connection String Syntaxは構築時に接続Testを実施して確定する。

### 8.3 PostgreSQL Port

Application-A / Application-BのどちらからもCurrent Primaryへ接続できるよう、PostgreSQL TCP/5432をWeb EC2からDatabase EC2へ到達可能にする。

Internetへは公開しない。

Security Groupでは以下を許可する。

```text
Application接続
Source: WEB-EC2-SG
Destination: DB-EC2-SG
Protocol: TCP
Port: 5432

Replication
Source: DB-EC2-SG
Destination: DB-EC2-SG
Protocol: TCP
Port: 5432
```

### 8.4 Connection Pool / Failover時のConnection

既存SQLAlchemyでは`pool_pre_ping=True`を使用している。

Database Failoverが発生すると、旧Primaryと確立済みのTCP / PostgreSQL Sessionは無効になる。

Failover後の基本動作は以下とする。

1. 旧Primaryとの既存ConnectionはErrorとなる
2. Connection PoolからConnectionを取得する際、`pool_pre_ping`で無効Connectionを検知する
3. 無効Connectionを破棄する
4. New Connection作成時にDB EC2-C / DB EC2-Dを試行する
5. `target_session_attrs=read-write`によりNew Primaryへ接続する

Failover発生時点ですでに実行中だったTransactionは失敗する可能性がある。

そのRequestはApplication側でErrorとして扱い、必要に応じて利用者再実行または安全なRetry制御を行う。

## 9. Failover方式

### 9.1 方式比較

本番業務要件だけを基準にした場合、24時間365日のOperator対応と、数分以内に完了できる定型化されたFailover Scriptを前提とすれば、手動承認 + Script実行による半自動Failoverでも要件へ適合できる。

| 方式 | メリット | デメリット | 要件適合性 |
|---|---|---|---|
| 手動承認 + Script化Failover | Operatorが旧Primary停止を確認してから昇格でき、Split Brainを防止しやすい。追加Serviceを必要とせず構成が単純 | Operator対応時間がRTOに含まれる | ◎ 24/365 Operatorと定型Scriptを前提とすればRTO数分以内を満たしやすい |
| 完全自動Failover | Operator操作なしで障害検知からFencing、Promoteまで自動実行でき、復旧時間を短縮できる。HA制御の設計・構築を学習できる | 誤判定を防ぐためのHealth Check条件、Fencing完了確認、異常時停止条件等の詳細設計が必要 | ○ 要件上は半自動で十分だが、今回は学習目的で採用する |

### 9.2 採用方式

業務要件のみを基準とした推奨方式は、手動承認 + Script化Failoverとする。

ただし、今回はHA / Failover設計・構築の学習を目的として、完全自動Failoverを設計・構築する。

完全自動化においてもSplit Brain防止を最優先とし、旧PrimaryのFencing完了を確認できない場合はStandbyをPromoteしない。

### 9.3 自動Failover制御 / Flow

追加のQuorum Nodeを構築せず、2台のDatabase EC2で構成するため、AWS Control PlaneによるEC2 Fencingを利用した自動Failover Controllerを採用する。

Failover ControllerはStandby側Database EC2で稼働し、Current Primaryを監視する。

```text
Standby Failover Controller
        |
        | Primary PostgreSQL Health Check
        v
Current Primary

Health Check連続失敗
        |
        v
Failover条件成立
        |
        v
AWS EC2 API
stop-instances
        |
        v
旧Primary Database EC2のstopped確認
        |
        +---- Fencing失敗 ----> Promote中止 / Alert
        |
        v
Standby Promote
        |
        v
New Primary
        |
        v
Application New Connection
DB EC2-C / DB EC2-Dを試行
        |
        v
target_session_attrs=read-write
        |
        v
New Primaryへ接続
        |
        v
Read / Write Health Check
        |
        v
Service継続
```

Failover Controllerの基本動作は以下とする。

1. Current Primary PostgreSQLのHealth Checkを定期実行する
2. 一時的なNetwork揺らぎでFailoverしないよう、連続失敗回数を設定する
3. Failover条件成立時、AWS EC2 APIで旧Primary Database EC2を停止する
4. EC2 Stateが`stopped`となったことを確認する
5. Fencing成功時のみStandbyをPromoteする
6. Promote後、Read / Write Health Checkを実施する
7. Alertを送信する

## 11. Split Brain対策

### 11.1 Risk

旧PrimaryがWrite可能なままStandbyを昇格すると、Primaryが2台存在するSplit Brainが発生する。

```text
DB EC2-C / PostgreSQL-C Primary  <--- Write

DB EC2-D / PostgreSQL-D Primary  <--- Write
```

両Databaseへ別々のDataが書き込まれると、自動的な整合性復旧が困難になる。

### 11.2 Fencing方針

Standby昇格前に、必ず旧PrimaryをWrite不能状態にする。

Fencing方式を以下の通り比較する。

| 方式 | メリット | Risk / デメリット | 方針 |
|---|---|---|---|
| PostgreSQL Container停止 | Database Processのみ停止でき、同一Host上の他Processへ影響しない | Network Partition等で旧Primary Hostへ到達できない場合、停止命令を実行できない、または停止完了を確認できない可能性がある | 補助的手段として利用可能だが、自動Failover時の最終Fencingには採用しない |
| Database EC2停止 | AWS Control Planeから停止でき、Database通信Networkの断に依存せず旧PrimaryをWrite不能にできる | EC2上の全Processが停止する | 採用。Database専用EC2とすることで影響をPostgreSQL系に限定する |


自動Failoverでは、AWS EC2 APIで旧Primary Database EC2を停止し、EC2 Stateが`stopped`となったことを確認できた場合のみStandbyをPromoteする。

旧Primaryの状態を確認できない場合でも、Fencing完了を確認できなければPromoteしない。

Failover後に旧Primaryが復旧しても、そのままPrimaryとしてServiceへ戻さない。

## 12. 旧Primaryの復旧

### 12.1 基本方針

Failover後の旧Primaryは、New Primaryへ追従するStandbyとして再構成する。

```text
＞Before Failover
DB-A Primary
   |
   v
DB-B Standby


＞After Failover
DB-B New Primary
   |
   v
DB-A New Standby
```

### 12.2 `pg_rewind`

旧PrimaryとNew Primaryの差分が小さく、`pg_rewind`を利用可能な場合は`pg_rewind`で旧PrimaryをNew PrimaryのTimelineへ追従させる。

`pg_rewind`利用を可能にするため、平常時から`wal_log_hints=on`とする。

### 12.3 Full Rebuild

`pg_rewind`を利用できない場合、またはData整合性に不安がある場合は、旧Primary Data Volumeをそのまま再利用せず、New Primaryから`pg_basebackup`を取得してStandbyを再構築する。

安全性を優先し、不明な状態の旧PrimaryをそのままClusterへ復帰させない。



## 13. RTO設計

Database RTOは、Primary障害発生からNew PrimaryへApplicationが正常接続し、業務Read / Writeを再開するまでの時間とする。

本設計では5分以内を設計目標とする。

| Process | 目標 |
|---|---|
| 障害検知 | 1分以内 |
| 旧Primary Database EC2 Fencing | 1分程度 |
| Standby Promote | 1分以内 |
| Application旧Connection失敗検知・New Connection確立 | 1分程度 |
| 正常性確認 | 1分程度 |

ApplicationはMulti-Host Connection + `target_session_attrs=read-write`を使用するため、Primary切替を目的としたApplication Container再起動は行わない。

実際の構築後にFailover Testを実施し、5分以内で完了できることを確認する。

5分以内を安定して達成できない場合は、Health Check Interval、Fencing処理、Connection Timeout等を再評価する。

## 14. RPO設計

Database RPOは、Primary障害時に消失を許容する最新Transactionの時間量とする。

本設計では 3分以内 を設計目標とする。

Asynchronous Streaming Replicationを採用するため、Primary障害直前の未転送WALが失われる可能性がある。

以下によりRPOを管理する。

- Replication Connectionを常時監視する

- Replication Lagを監視する

- 3分超過をAlertとする

- Standby切断を即時検知する

- Failover前にStandbyの最終Replay位置を確認する

Replication停止中はRPO保証状態ではないため、Alert発生時は優先的にStandbyを復旧する。



## 15. 監視設計

### 15.1 Primary監視

| 監視項目 | 確認方法 | 異常条件 |
|---|---|---|
| PostgreSQL Process | Container / Process監視 | PostgreSQL停止 |
| DB接続 | `pg_isready` | 接続不可 |
| Primary Role | `SELECT pg_is_in_recovery();` | Primaryで`true` |
| Disk使用率 | EC2 / Filesystem監視 | 閾値超過 |
| WAL使用量 | `pg_wal` Size | 閾値超過 |

### 15.2 Standby監視

| 監視項目 | 確認方法 | 異常条件 |
|---|---|---|
| PostgreSQL Process | Container / Process監視 | PostgreSQL停止 |
| Standby Role | `SELECT pg_is_in_recovery();` | Standbyで`false` |
| WAL Receiver | `pg_stat_wal_receiver` | Receiver停止 |
| Replication状態 | Primaryの`pg_stat_replication` | `streaming`以外 |
| Replication Lag | WAL LSN / Replay Lag | 3分超過 |
| Disk使用率 | EC2 / Filesystem監視 | 閾値超過 |

### 15.3 Alert

以下を即時通知対象とする。

- Primary PostgreSQL停止

- Standby PostgreSQL停止

- Replication Connection断

- Replication Lag 3分超過

- Replication Slot異常

- `pg_wal` Disk逼迫

- Primary / Standby Role不整合



## 16. Backup / Restore

ReplicationとBackupは目的を分離する。

| 方式 | 目的 |
|---|---|
| Streaming Replication | Hardware / EC2 / AZ障害時の短時間復旧、RPO数分以内 |
| `pg_dump` + Amazon S3 | 誤操作、論理破損、Data削除等からの復旧 |

Primaryで誤削除されたDataはStandbyにもReplicationされるため、ReplicationはBackupの代替とはしない。

既存の`pg_dump` + S3 Backupを継続する。



## 17. Security

### 17.1 Network

PostgreSQL TCP/5432はInternetへ公開しない。

Security GroupはWeb系とDatabase系で分離する。

```text
Application接続

WEB-EC2-SG
    |
    | TCP/5432
    v
DB-EC2-SG


Replication

DB-EC2-SG
    |
    | TCP/5432
    v
DB-EC2-SG
```

Application接続はWeb EC2-A / Web EC2-BからDB EC2-C / DB EC2-DへのTCP/5432のみ許可する。

Replication通信はDB EC2-C / DB EC2-D間のTCP/5432のみ許可する。

Database EC2は、アーキテクチャ設計書 STEP2で定義したAZ単位のPublic Subnetへ配置する。

| Database EC2 | AWS Availability Zone | Subnet | CIDR |
|---|---|---|---|
| DB-A | `ap-northeast-1a` | `it-service-request-system-dev-public-subnet-a` | `10.0.1.0/24` |
| DB-B | `ap-northeast-1b` | `it-service-request-system-dev-public-subnet-b` | `10.0.2.0/24` |

Databaseを専用Private Subnetへ分離する構成は、Network LayerでInternet経路を分離できるため、一般的なProduction Architectureでは有力な選択肢である。

ただし、本STEPではWeb / Database EC2からOS Package Repository、Docker Image Repository、GitHub等へのOutbound通信経路を維持する必要がある。

Private Subnetを採用する場合、典型的にはNAT Gateway等を追加する必要がある。NAT GatewayはData Processing量に応じた料金に加えてProvisioning時間に対する時間料金が発生するため、通信量が少ない場合でもCostが継続する。また、Multi-AZの可用性を維持する場合はAZごとのNAT Gateway配置が望ましく、2AZでは常時Costが増加する。

AWS Free Tier Credit等によってNAT Gateway料金が相殺される場合はあるが、Creditは一時的かつAccount条件に依存するため、本設計では恒久的なCost削減要素として扱わない。

以上より、本STEPでは「有料プランは原則として利用しない」という要件を優先し、DB-A / DB-Bを各AZのPublic Subnetへ配置する。ただし、Public Subnet配置であってもPostgreSQLをInternetへ公開しない。

- TCP/5432のApplication接続はWEB-EC2-SGからのみ許可する
- TCP/5432のReplication通信はDB-EC2-SG間のみ許可する
- InternetをSourceとするTCP/5432のInbound Ruleは作成しない
- PostgreSQLへの接続はPrivate IPを使用する
- DB EC2間ReplicationもPrivate IPを使用する
- SSH等の管理通信は管理元CIDRへ限定する

将来、Cost制約が緩和される場合はDatabase専用Private Subnetへの移行を再評価する。


### 17.2 User分離

以下のUserを分離する。

| User | 用途 |
|---|---|
| Application DB User | Applicationからの業務SQL |
| Replication User | Streaming Replication |
| PostgreSQL管理User | 管理作業 |

Replication UserをApplicationから利用しない。

### 17.3 Credential

PasswordはGitへ保存しない。

既存の`.env`等のSecret管理方針を継続する。

## 18. Docker構成変更方針

Multi-AZ化およびWeb / Database EC2分離に伴い、現在の`postgres:5432`固定接続を変更する。

主な変更点は以下とする。

- Nginx / ApplicationをWeb EC2-A / Web EC2-Bへ配置する
- PostgreSQL ContainerをDB EC2-C / DB EC2-Dへ配置する
- 各Database EC2で独立した`postgres_data` Volumeを使用する
- Primary / Standbyで同一Volumeを共有しない
- PostgreSQL TCP/5432をWeb EC2からDatabase EC2へ到達可能にする
- PostgreSQL TCP/5432をDatabase EC2間でReplication用に到達可能にする
- ApplicationのDatabase接続をMulti-Host Connectionへ変更する
- Standby用Replication設定を追加する
- Replication User / `pg_hba.conf`を追加する
- `postgresql.conf`へReplication設定を追加する
- Standby初期構築は`pg_basebackup`を使用する
- Failover ControllerからAWS EC2 APIを利用して旧Primary Database EC2をFencingできるようにする

概念例：

```text
AZ-A

Web EC2-A
docker compose
├ nginx-A
└ application-A

DB EC2-C
docker compose
└ postgres-C
   └ postgres_data_C


AZ-C

Web EC2-B
docker compose
├ nginx-B
└ application-B

DB EC2-D
docker compose
└ postgres-D
   └ postgres_data_D
```

Web EC2とDatabase EC2は同一Docker Networkを共有しない。

ApplicationとPostgreSQLの通信はVPC NetworkおよびSecurity Groupを利用する。

## 19. Migration方針

既存PostgreSQLを利用しながら、Databaseを専用EC2へ段階的に移行する。

サービス停止を原則発生させずに実施できる工程と、短時間のWrite停止または切替が必要となる可能性がある工程を分離する。

```text
Phase 1
既存PostgreSQLをPrimaryとして業務継続

Phase 2
新規DB EC2-Dを構築
PostgreSQL Container / Volumeを準備

Phase 3
既存PrimaryへReplication用設定を追加

Phase 4
pg_basebackupでDB EC2-DへStandbyを初期化

Phase 5
Streaming Replication開始
Replication状態 / Lag確認

Phase 6
Web EC2-Bから既存Primary / Standby候補への接続Test

Phase 7
DB EC2-Cを構築し、最終的なDatabase専用EC2構成を準備

Phase 8
ApplicationをMulti-Host Connectionへ変更

Phase 9
Database PrimaryをDB EC2-C / DB EC2-Dのいずれかへ切替

Phase 10
Failover / Fencing Test

Phase 11
旧EC2上のPostgreSQLを撤去
```

Standby初期構築中も既存Primaryで業務処理を継続する。

`pg_basebackup`によるStandby初期化およびStreaming Replication開始は、Primaryを稼働させたまま実施可能である。

ただし、既存PostgreSQL Containerの設定変更内容によってはPostgreSQL Restartが必要となるParameterがあるため、Replication準備を完全無停止で実施できるかは現在の`postgresql.conf`設定値を確認して判断する。

また、最終的なPrimary切替では、旧Primaryへの新規Writeを止め、Standbyが最新WALまで追従したことを確認してからRoleを切り替える必要がある。

そのため、Database移行全体を「完全に無停止」と断定せず、最終切替時に短時間のWrite停止が必要となる可能性を前提とする。

具体的な停止時間と手順は、現在のPostgreSQL設定値および構築手順確定後に決定する。

## 20. Test方針

構築後、以下を確認する。

### 20.1 Replication Test

- PrimaryへTest DataをINSERTする
- StandbyへWALが反映されることを確認する
- UPDATE / DELETEも反映されることを確認する
- Replication Lagを確認する

### 20.2 Standby障害Test

- Standby PostgreSQLを停止する
- PrimaryでWriteを継続できることを確認する
- Standby復旧後にReplicationが再開することを確認する

### 20.3 Primary障害 / Failover Test

- Primary PostgreSQLを障害状態にする
- Failover Controllerが連続Health Check失敗を検知することを確認する
- AWS EC2 APIにより旧Primary Database EC2がFencingされることを確認する
- EC2 Stateが`stopped`となるまでStandbyがPromoteされないことを確認する
- StandbyがNew PrimaryへPromoteされることを確認する
- Applicationの既存Connectionが失敗し、New ConnectionがNew Primaryへ確立されることを確認する
- Application Container再起動なしでRead / Writeを再開できることを確認する
- RTO 5分以内であることを計測する

### 20.4 RPO Test

- Primaryへ連続的にDataを書き込む
- Primaryを障害停止する
- Standbyの最終Replay Dataを確認する
- Data Loss範囲が3分以内であることを確認する

### 20.5 Split Brain / Fencing Test

- PrimaryとStandby間のDatabase通信を意図的に遮断する
- Failover条件成立後、旧Primary Database EC2のFencingが実行されることを確認する
- Fencing完了前にStandbyがPromoteされないことを確認する
- AWS API Fencingが失敗した場合にPromoteが中止されることを確認する
- New Primary昇格後に旧Primaryを復旧してもApplicationから利用されないことを確認する
- 旧PrimaryをStandbyとして再構築できることを確認する

## 21. 設計決定事項まとめ

| 項目 | 決定 |
|---|---|
| PostgreSQL Version | 既存PostgreSQL 16を継続 |
| Database配置 | Web EC2から分離したDatabase専用EC2 |
| Database EC2 | DB EC2-C / DB EC2-D |
| Database構成 | Primary / Standby |
| AZ | 2AZ |
| Replication | Physical Streaming Replication |
| 同期方式 | Asynchronous |
| Replication Slot | Physical Replication Slotを使用 |
| RPO設計目標 | 3分以内 |
| RTO設計目標 | 5分以内 |
| Failover | 完全自動（学習目的。要件上は手動承認 + Script化でも適合） |
| Standby昇格 | `pg_ctl promote` または `pg_promote()` |
| Split Brain対策 | AWS EC2 APIによる旧Primary Database EC2 Fencing完了後のみPromote |
| Container停止Fencing | Network Partition時に実行・完了確認できないRiskがあるため最終Fencingには採用しない |
| Application接続先 | Multi-Host Connection + `target_session_attrs=read-write` |
| Failover時Application対応 | New Connection時にNew Primaryを自動選択。Primary切替目的のContainer再起動は不要 |
| 旧Primary復旧 | `pg_rewind`または`pg_basebackup`によるStandby再構築 |
| Backup | 既存`pg_dump` + S3を継続 |
| Read Scale | 実施しない |
| Schema変更 | HA化による変更なし |


