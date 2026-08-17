# ADR-006 Observability

## 1. 前提と要件

本システムでは、System、Infrastructure、ApplicationおよびDatabaseの状態を把握し、障害や性能劣化を検知・調査できるようにするため、監視およびLogging方式を決定する必要がある。

本システムの主要な前提および要件は以下の通りである。

- AWS上に構築する小規模な学習・検証環境である
- Nginx、Application、PostgreSQLを単一EC2上のContainerとして実行する
- 稼働率は99%以上とする
- 通常操作は3秒以内を目標とする
- SystemおよびApplicationの稼働状態を確認できること
- CPU、Memory、Disk等のResource使用状況を確認できること
- Application Errorや異常を調査するために必要なLogを取得できること
- 障害を検知した場合に管理者が把握できること
- 監視およびLog保存による追加Costを必要最小限とする
- 現在の要件を超える高度な監視基盤を導入せず、構成および運用の複雑性を必要最小限とする

これらを踏まえ、以下の観点でObservability構成を検討する。

1. Metricsをどの基盤で収集・監視するか
2. EC2標準Metricsで取得できない情報をどのように収集するか
3. Logをどのように収集・管理するか
4. どの異常をAlarmとして検知するか


## 2. 主な判断基準

本判断では以下を主要な判断基準とする。

- 障害検知
  - System停止やResource逼迫等の異常を検知できること

- 障害調査
  - 障害発生時にMetricsおよびLogから原因を調査できること

- 可視性
  - Infrastructure、OS、Application等の状態を必要な範囲で確認できること

- AWSとの統合
  - EC2等のAWS Resourceと容易に連携できること

- 構成の単純性
  - 監視のためのServer等を追加せず、管理対象を必要以上に増加させないこと

- Cost
  - Custom Metrics、Log取込・保存等による追加Costを必要最小限とすること


## 3. 採用アーキテクチャ

初期構成では、監視およびLog管理基盤としてAmazon CloudWatchを採用する。

EC2標準Metricsに加え、OS内部のMemory、Disk等の情報についてはCloudWatch Agentを使用して収集する。

Application、Nginx等の障害調査に必要なLogについてもCloudWatchへ集約する。

```text
Amazon EC2
│
├─ EC2 Metrics ─────────────────────┐
│                                   │
├─ CloudWatch Agent                 │
│   ├─ Memory                       │
│   ├─ Disk                         │
│   └─ Logs                         │
│       │                           │
│       └───────────────────────────┤
│                                   │
├─ Nginx Container                  │
│   └─ Logs ──> CloudWatch Agent ───┤
│                                   │
├─ Application Container            │
│   └─ Logs ──> CloudWatch Agent ───┤
│                                   │
└─ PostgreSQL Container             │
    └─ Logs ──> CloudWatch Agent ───┤
                                    v
                            Amazon CloudWatch
                             ├─ Metrics
                             ├─ Logs
                             └─ Alarms
```

- EC2のCPU等のAWS標準MetricsはCloudWatchで監視する
- EC2標準Metricsでは取得できないMemory、Disk等はCloudWatch Agentで収集する
- Application等の障害調査に必要なLogをCloudWatchへ集約する
- 障害やResource逼迫等、管理者による対応が必要な状態についてCloudWatch Alarmを設定する
- Custom MetricsおよびLogについては、監視上必要な情報に限定して収集する

具体的な監視対象、Alarm閾値、評価期間、Log保存期間、通知先等はMonitoring設計で定義する。


## 4. 監視基盤の比較

SystemおよびInfrastructureの監視基盤について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| Amazon CloudWatch | EC2等のAWS Resourceと標準で統合されており、Metrics、Logs、AlarmsをAWS上で一元的に管理できる。監視Serverを別途構築する必要がない | Custom Metrics、Log取込・保存、Alarm等の利用量に応じて追加Costが発生する | ◎ |
| Prometheus + Grafana | Metricsの収集・可視化を柔軟に構成でき、Application固有Metrics等にも対応しやすい | Prometheus、Grafana等の実行・保守が必要となり、現在の小規模構成では管理対象が増加する | △ |
| EC2上での個別監視 | OS CommandやLog File等を直接確認でき、追加の監視Serviceを最小限にできる | 常時監視、異常検知、通知および履歴管理が難しく、障害を能動的に確認する必要がある | △ |

以上より、AWS Resourceとの統合性が高く、追加の監視Serverを構築せずMetrics、Logs、Alarmsを一元的に管理できるため、**Amazon CloudWatchを採用する。**


## 5. Metrics収集方式

EC2ではCPU使用率等の標準MetricsをCloudWatchから取得できるが、OS内部のMemory使用率やDisk使用率等は標準Metricsだけでは取得できない。

そのため、必要なOS MetricsについてCloudWatch Agentを利用する。

| Metrics | 収集方式 | 主な目的 |
|---|---|---|
| EC2 CPU使用率 | CloudWatch標準Metrics | CPU Resourceの逼迫検知 |
| EC2 Status Check | CloudWatch標準Metrics | Instance / System障害の検知 |
| Memory使用率 | CloudWatch Agent | Memory Resourceの逼迫検知 |
| Disk使用率 | CloudWatch Agent | Disk容量不足の検知 |

Custom Metricsは追加Costが発生するため、収集対象を監視上必要な項目へ限定する。

収集間隔についても必要以上に短くせず、障害検知に必要な粒度とCostのバランスを考慮する。


## 6. Logging方針

障害発生時にSystemの状態および処理内容を確認できるよう、必要なLogを取得する。

| 対象 | 主なLog | 主な目的 |
|---|---|---|
| Nginx | Access Log / Error Log | HTTP Request、Status Code、Web層Error等の確認 |
| Application | Application Log / Error Log | API処理、Application Error等の確認 |
| PostgreSQL | Database Log | Database Error、接続異常等の確認 |
| OS | System Log | OSおよびSystem Service等の異常確認 |

- Logは障害調査に必要な範囲でCloudWatch Logsへ集約する

- Log取込量および保存量に応じてCostが発生するため、不要なDebug Log等を常時大量に出力しない

- Logを無期限に保存せず、要件に応じたRetention期間を設定する。

- 具体的なLog File、Log Level、Log Format、Retention期間、CloudWatch LogsのLog Group等はMonitoring設計で定義する


## 7. Alarm方針

すべてのMetricsにAlarmを設定するのではなく、管理者による対応が必要となる異常を対象としてCloudWatch Alarmを設定する。

| 対象 | Alarm設定理由 |
|---|---|
| EC2 Status Check | EC2またはAWS Infrastructure側の異常を検知するため |
| CPU使用率 | CPU逼迫による性能劣化を検知するため |
| Memory使用率 | Memory不足によるApplication停止や性能劣化を検知するため |
| Disk使用率 | Disk容量不足によるLog出力不能やDatabaseへの書込み失敗等を防止するため |
| Application稼働状態 | Application停止等によりServiceを提供できない状態を検知するため |

- 一時的なResource使用率上昇等による不要な通知を抑制するため、単一Data PointのみでAlarmとせず、一定期間継続した異常を検知する方式を基本とする

- 本システムは学習・検証環境であり、常時稼働および24時間365日の運用監視を前提としていないため、異常発生時に管理者へ即時通知する運用要件はない

- 初期構成ではCloudWatch Alarmによる異常状態の判定までを対象とし、SNS、Email、Teams等を利用した外部への通知は実施しない

- 具体的な閾値、評価期間、Data Point数および通知先はMonitoring設計で定義する


## 8. 高度なObservability機能

初期構成では、Metrics、LogsおよびAlarmを中心とした監視を実施する。

以下については現在のシステム規模および要件では必須としない。

- Distributed Tracing
- APM製品
- Application固有の大量のCustom Metrics
- Log分析専用基盤
- 複数Systemを横断したObservability Platform

これらはApplicationやSystem構成が複雑化し、MetricsおよびLogのみでは性能問題や障害原因の特定が困難となった場合に再評価する。


## 9. 採用による影響

### 9.1 メリット

- AWS ResourceのMetricsをCloudWatchで一元的に確認できる
- CloudWatch AgentによりOS内部のMemory、Disk等を監視できる
- Metrics、Logs、Alarmsを同一のAWS Service群で管理できる
- 監視Serverを別途構築・運用する必要がない
- 障害発生時にMetricsとLogを利用して原因調査を実施できる
- CloudWatch Alarmにより異常を能動的に検知できる
- 必要な監視項目に限定することで構成およびCostを抑制できる

### 9.2 デメリット・受容する制約

- Custom Metrics、Log取込・保存、Alarm等に追加Costが発生する
- 初期構成ではDistributed Tracing等によるRequest単位の詳細な追跡を実施しない
- Application内部の詳細な性能分析には追加のMetricsやAPM等が必要となる場合がある
- 本番利用や常時稼働により、障害発生時の即時対応が必要となる
- CloudWatch Alarmを管理者が定期的に確認する運用では、要求される障害検知時間を満たせなくなる
- CloudWatchへの依存が強くなり、他CloudやOn-Premisesへの移行時には監視方式の再設計が必要となる

これらは、現在のシステム規模、監視要件およびAWSを実行環境として採用する前提とのTrade-offとして受容する。


## 10. 再評価条件

以下の条件が発生した場合、本決定を再評価する。

- Applicationを複数Instance / Taskへ水平展開する
- ECS、Fargate等のContainer Orchestration基盤へ移行する
- Microservices等によりApplication間の通信経路が複雑化する
- MetricsおよびLogのみでは障害原因の特定が困難となる
- Request単位で複数Componentを横断する処理を追跡する必要が生じる
- ApplicationのResponse Time等をより詳細に分析する必要が生じる
- Application固有Metricsの監視要件が増加する
- CloudWatchのMetrics、Logs等の利用Costが大幅に増加する
- 複数Systemを統合して監視する必要が生じる
- 障害通知による即時対応が必要となる

これらの条件が発生した場合は、Distributed Tracing、APM、AWS X-Ray、OpenTelemetry、Prometheus、Grafana等を候補としてObservability構成を再評価する。


## 11. 関連ドキュメント

- `docs/01_requirements/business-and-functional-requirements.md`
- `docs/01_requirements/non-functional-requirements.md`
- `docs/02_architecture/architecture-design.md`
- `docs/03_decisions/ADR-001-compute-container-platform.md`
- `docs/03_decisions/ADR-002-application-structure.md`
- `docs/03_decisions/ADR-003-network-separation.md`
- `docs/03_decisions/ADR-004-database.md`
- `docs/04_operations/monitoring.md`