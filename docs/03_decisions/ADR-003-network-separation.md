# ADR-003 Network Separation

## 1. 前提と要件

本システムでは、Internetからのアクセス経路およびWeb、Application、Database間の通信経路を決定する必要がある。

本システムの主要な前提および要件は以下の通りである。

- AWS上の単一EC2にNginx、Application、PostgreSQLをContainerとして配置する
- 利用者からWeb APIへのアクセスを提供する
- 外部から直接アクセス可能な範囲を必要最小限とする
- ApplicationおよびDatabaseをInternetへ直接公開しない
- Web、Application、Databaseを論理的に分離する
- 管理者によるEC2へのSSH接続を可能とする
- 現在の要件を超えるNetwork構成を採用せず、構成および運用の複雑性を必要最小限とする

これらを踏まえ、以下の2段階でNetwork構成を検討する。

1. AWS NetworkにおいてEC2への通信をどの範囲で許可するか
2. EC2内部においてContainer間のNetworkをどのように分離するか

## 2. 主な判断基準

本判断では以下を主要な判断基準とする。

- セキュリティ
  - Internetから直接アクセス可能な範囲を必要最小限に限定できること

- コンポーネント分離
  - Web、Application、Database間の不要な通信経路を制限できること

- 要件適合性
  - 利用者からWeb APIへのアクセスおよび管理者からEC2へのSSH接続を実現できること
  - 過剰な構成・機能でなく、要件に適した構成であること

- 構成の単純性
  - Network ResourceおよびNetwork管理対象を必要以上に増加させないこと


## 3. 採用アーキテクチャ

初期構成では、EC2をPublic Subnetへ配置し、Security GroupによりInternetからEC2への通信を制御する。

EC2内部ではDocker Networkを`frontend`と`backend`に分離し、Nginxのみを外部公開する。


```text
Internet
   |
   | HTTP : 80
   | SSH  : 22（管理元IPのみ）
   v
Security Group
   |
   v
Public Subnet
   |
   v
Amazon EC2
   |
   ├─ frontend Network
   |      |
   |      └─ Nginx : 80
   |             |
   |             v
   └─ backend Network
          |
          ├─ Nginx
          |
          ├─ Application : 8000
          |
          └─ PostgreSQL : 5432
```

- InternetからのHTTP通信はNginxのみで受け付ける
- Nginxは`frontend`および`backend`の両Networkへ接続する
- ApplicationおよびPostgreSQLは`backend`のみに接続する
- NginxからApplicationへの通信は`backend`を経由する
- ApplicationからPostgreSQLへの通信は`backend`を経由する
- Applicationの8000番PortおよびPostgreSQLの5432番PortはHostへ公開しない
- SSHの22番Portは管理元IPからの接続のみ許可する

具体的なCIDR、Security Group Rule、Docker Network設定等はNetwork設計で定義する。

本システムは学習・検証環境であり、初期構成では独自ドメインおよびTLS証明書を使用しないため、HTTPS化は対象外とする。

## 4. AWS Network構成の比較

AWS上のNetwork構成について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| Public Subnet + 単一EC2 | InternetからNginxへ直接アクセスでき、追加のLoad BalancerやNAT Gateway等を必要としないため構成が単純 | EC2自体がPublic Subnetに配置されるため、Security Group等による適切な通信制御が必要 | ◎ |
| Public / Private Subnet分離 | Internet公開部分と内部ComponentをNetworkレベルで分離でき、外部公開範囲をより限定できる | Componentを別Resourceへ物理分離する必要があり、Subnet、Route、Load Balancer等の構成要素が増加する | ○ |
| Private Subnet + Load Balancer | EC2をInternetへ直接公開せず、Load Balancerを外部公開Pointとすることができる | Load Balancer等の追加Resourceが必要となり、現在の小規模な単一EC2構成に対して構成が複雑になる | ○ |

以上より、現在の小規模な単一EC2構成ではSecurity Groupによる通信制御で要件を満たすことができ、追加のNetwork Resourceを必要としないため、**Public Subnet + 単一EC2構成を採用する。**


## 5. Container Network構成の比較

EC2内部のContainer Network構成について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| 単一Docker Network | Network構成が単純であり、Container間通信を容易に構成できる | Nginx、Application、PostgreSQLが同一Networkへ接続され、外部公開系と内部通信系の境界が不明確になる | △ |
| frontend / backend分離 | 外部通信を受け付けるNginxと内部Componentの通信経路を論理的に分離できる。ApplicationおよびPostgreSQLをbackendのみに配置できる | Docker Networkが複数となり、Network設定が増加する | ◎ |
| ContainerごとのNetwork分離 | Container間の通信経路をより細かく制御できる | Network数および接続設定が増加し、現在の小規模構成に対して管理が複雑になる | △ |

以上より、外部公開系と内部通信系を論理的に分離しながら構成を単純に保つことができるため、**frontend / backendの2つのDocker Networkへ分離する方式を採用する。**


## 6. 採用による影響

### 6.1 メリット

- Internetから直接アクセス可能なComponentをNginxに限定できる
- ApplicationおよびPostgreSQLのPortをHostへ公開せずに構成できる
- 外部公開系と内部通信系をDocker Networkにより論理的に分離できる
- NginxをWeb層とApplication層の境界として利用できる
- Public / Private Subnet分離やLoad Balancer等を追加せず、Network構成を比較的単純に保てる
- Security GroupによりEC2へのInbound通信を必要なPortに限定できる

### 6.2 デメリット・受容する制約

- EC2自体はPublic Subnetに配置される
- 単一EC2内のDocker Networkによる分離であり、Component間をAWS Networkレベルで物理的に分離しているわけではない
- Nginx、Application、PostgreSQLが同一EC2を共有するため、EC2障害時にはすべての通信経路が利用できなくなる
- Nginxが外部通信と内部通信の中継点となる
- ApplicationやDatabaseを別EC2等へ分離する場合は、AWS Network構成を再設計する必要がある
- HTTPSによる通信の暗号化を実施していない

これらは、現在のシステム規模、セキュリティ要件および単一EC2構成という前提とのTrade-offとして受容する。


## 7. 再評価条件

以下の条件が発生した場合、本決定を再評価する。

- ApplicationまたはDatabaseをEC2から物理分離する
- Applicationを複数Instance / Taskへ水平展開する必要が生じる
- InternetからEC2への直接通信を許容できなくなる
- HTTPSを導入し、TLS終端をLoad Balancer等で実施する必要が生じる
- WAF等によるWeb Application Protectionが必要となる
- Load Balancerによる負荷分散が必要となる
- Multi-AZ構成へ変更する
- NetworkレベルでWeb、Application、Databaseをより強く分離する必要が生じる
- 外部Systemとの接続が増加し、通信経路の制御が複雑になる

これらの条件が発生した場合は、Public / Private Subnet分離、Application Load Balancer、AWS WAF、複数Security Group、VPC Endpoint等を候補としてNetwork構成を再評価する。


## 8. 関連ドキュメント

- `docs/01_requirements/business-and-functional-requirements.md`
- `docs/01_requirements/non-functional-requirements.md`
- `docs/02_architecture/architecture-design.md`
- `docs/03_decisions/ADR-001-compute-container-platform.md`
- `docs/03_decisions/ADR-002-application-structure.md`
- `docs/03_decisions/ADR-005-authentication.md`