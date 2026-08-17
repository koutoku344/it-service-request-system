# ADR-005 Authentication

## 1. 前提と要件

本システムでは、システムを利用するユーザーを識別し、認証されたユーザーのみが許可された機能へアクセスできるようにするため、認証方式を決定する必要がある。

本システムの主要な前提および要件は以下の通りである。

- 小規模な学習・検証環境である
- 同時利用者数は最大20名とする
- ユーザーを識別し、認証されたユーザーのみシステムを利用可能とする
- ユーザーごとにRoleを設定し、Roleに応じて利用可能な機能を制御する
- ユーザー情報および認証に必要な情報を適切に管理する
- 初期構成ではActive Directory等の社内認証基盤との連携を前提としない
- 初期構成では外部Identity Providerを必須としない
- 現在の要件を超える構成要素を追加せず、構成および運用の複雑性を必要最小限とする

これらを踏まえ、本システムにおけるユーザー認証方式を検討する。


## 2. 主な判断基準

本判断では以下を主要な判断基準とする。

- 要件適合性
  - 現在のユーザー数および利用形態に適した認証方式であること
  - 過剰な構成・機能でなく、要件に適した構成であること

- セキュリティ
  - ユーザーを適切に識別・認証できること
  - Password等の認証情報を安全に管理できること

- 認可との連携
  - 認証したユーザーのRole等を基に、ApplicationでAccess Controlを実施できること

- 構成の単純性
  - 認証のための外部Serviceおよび運用対象を必要以上に増加させないこと

- 拡張性
  - 将来的に外部Identity Provider等を利用する必要が生じた場合に、認証方式を再評価できること


## 3. 採用アーキテクチャ

初期構成では、Applicationによるローカル認証を採用する。

ユーザー情報および認証に必要な情報をPostgreSQLで管理し、ログイン時にApplicationが認証処理を実施する。

```text
User
 |
 | Login Request
 v
Nginx
 |
 v
FastAPI Application
 |
 | Authentication
 v
PostgreSQL
 |
 ├─ User Information
 ├─ Authentication Information
 └─ Role Information
```

- 認証処理はApplicationで実施する
- ユーザー情報および認証に必要な情報はPostgreSQLで管理する
- Passwordは平文で保存せず、適切なPassword Hash方式を使用して管理する
- 認証後はユーザーに設定されたRole等を基にApplicationでAccess Controlを実施する
- 初期構成ではActive Directory、Amazon Cognito等の外部認証基盤は使用しない

Password Hash方式、認証状態の管理方式、認証情報の有効期限、Login / Logout処理、Access Control等の具体的な実装方式はSecurity設計およびApplication設計で定義する。


## 4. 認証方式の比較

ユーザー認証方式について以下を比較する。

| 方式 | メリット | デメリット | 評価 |
|---|---|---|---|
| Applicationによるローカル認証 | ApplicationとPostgreSQLのみで認証を実現でき、外部認証基盤を必要としない。小規模環境では構成を単純にできる | Password、Account Lock、Password Policy等の認証機能をApplication側で実装・管理する必要がある | ◎ |
| Active Directory連携 | 組織で管理されているAccountを利用でき、ユーザー・Password管理を既存の認証基盤へ集約できる | Active Directory等の既存認証基盤が必要となり、本システム単体では完結しない | △ |
| Amazon Cognito | ユーザー認証・Token発行等の認証機能をManaged Serviceとして利用でき、Application側の認証管理負荷を削減できる | AWS Serviceとして追加の構成・設定が必要となり、小規模な学習・検証環境では構成要素が増加する | ○ |
| 外部Identity Provider連携 | 組織Accountや外部Identityを利用したSingle Sign-On等へ対応できる | 外部Identity Providerとの連携設定および認証Protocolに関する追加設計が必要となる | ○ |

以上より、現在は外部認証基盤との連携を必要とせず、小規模な利用者を対象としてApplication内で認証を完結できるため、**Applicationによるローカル認証を採用する。**


## 5. 認証・認可の責務分離

認証と認可は異なる責務として扱う。

```text
Login Request
      |
      v
    認証
「誰であるか」
      |
      v
Authenticated User
      |
      v
    認可
「何を実行できるか」
      |
      v
Application Function
```

### 5.1 認証

認証では、ユーザーが本人であることを確認する。

初期構成では、Applicationが入力された認証情報とPostgreSQLで管理する認証情報を基に本人確認を実施する。

### 5.2 認可

認可では、認証されたユーザーが対象機能を実行する権限を持つか確認する。

ユーザーにRoleを設定し、ApplicationでRoleに基づくAccess Controlを実施する。

具体的なRole、Permission、機能ごとのAccess Control等はApplication設計およびSecurity設計で定義する。


## 6. 採用による影響

### 6.1 メリット

- 外部認証基盤を構築せず、ApplicationとPostgreSQLで認証を実現できる
- 現在の小規模な利用者数に対して構成を単純に保つことができる
- ユーザー情報、認証情報およびRoleを本システム内で管理できる
- Applicationで認証・認可処理を制御できる
- Active Directoryや外部Identity Providerへの依存を持たない

### 6.2 デメリット・受容する制約

- Password等の認証情報を本システムで管理する必要がある
- Password Hash、Password Policy等のセキュリティ対策をApplication側で実装する必要がある
- Account Lock等を必要とする場合はApplication側で実装する必要がある
- ユーザーの追加・変更・削除を本システムで管理する必要がある
- 組織Accountとの統合やSingle Sign-Onを利用できない
- 認証機能のSecurity VulnerabilityについてApplication側で考慮する必要がある

これらは、現在のシステム規模、利用形態および学習・検証環境という前提とのTrade-offとして受容する。


## 7. 再評価条件

以下の条件が発生した場合、本決定を再評価する。

- 利用者数が大幅に増加する
- ユーザー管理の運用負荷が増加する
- Active Directory等の組織Accountとの統合が必要となる
- Single Sign-Onが必要となる
- Multi-Factor Authenticationが必要となる
- 複数Systemで共通のIdentityを利用する必要が生じる
- Password管理をApplicationから分離する必要が生じる
- 認証に関するSecurity要件が現在より高くなる
- Applicationを複数Instance / Taskへ水平展開することで、認証状態管理方式の見直しが必要となる

これらの条件が発生した場合は、Amazon Cognito、Active Directory、OIDC / OAuth 2.0等を利用した外部Identity Provider連携等を候補として認証方式を再評価する。


## 8. 関連ドキュメント

- `docs/01_requirements/business-and-functional-requirements.md`
- `docs/01_requirements/non-functional-requirements.md`
- `docs/02_architecture/architecture-design.md`
- `docs/03_decisions/ADR-002-application-structure.md`
- `docs/03_decisions/ADR-003-network-separation.md`
- `docs/03_decisions/ADR-004-database.md`
- `docs/06_security/security-check.md`