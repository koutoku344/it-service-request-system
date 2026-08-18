# IT Service Request System 画面設計書

## 1. 目的

本書は、IT Service Request Systemにおいて、現在CLIから実施している以下の操作をWeb GUIから実施可能にするための画面設計を定義する。

- ログイン
- 申請一覧参照
- 新規申請
- 申請詳細参照
- 申請取消
- 申請承認・却下
- 承認履歴参照
- ユーザー管理
- 申請種別管理

既存のFastAPI APIを利用することを基本とする。

ただし、GUI化に必要な以下のAPI修正を実施する。

- 申請一覧、申請詳細、承認履歴取得APIにJWT認証を追加する
- 申請種別一覧GETを一般ユーザー、承認者、管理者が利用可能にする
- 申請種別の登録・更新はadminのみ可能とする


## 2. 前提

### 2.1 システム構成

フロントエンドは以下の技術で構成する。

| 項目 | 採用技術 |
|---|---|
| HTML | HTML5 |
| CSS | CSS3 |
| JavaScript | Vanilla JavaScript |
| Webサーバ | Nginx |
| API | FastAPI |
| ORM | SQLAlchemy |
| DB | PostgreSQL |
| 認証 | JWT Bearer認証 |

React、Vue等のJavaScriptフレームワークは使用しない。

### 2.2 ロール

既存システムで定義されている以下の3ロールを使用する。

| ロール | 概要 |
|---|---|
| user | 一般利用者 |
| approver | 承認者 |
| admin | システム管理者 |



## 3. システム処理方式

### 3.1 全体構成

```text
Browser
   │
   │ HTTP
   ▼
Nginx
   │
   ├── /              → HTML / CSS / JavaScript
   │
   └── /api/*         → FastAPI
                          │
                          ▼
                      SQLAlchemy
                          │
                          ▼
                      PostgreSQL
```

Nginxは以下の2つの役割を持つ。

1. HTML / CSS / JavaScriptなどの静的コンテンツをブラウザへ配信する
2. `/api/` へのアクセスをFastAPI Applicationへリバースプロキシする

### 3.2 静的コンテンツ取得時

例：

```text
Browser
   │
   │ GET /requests.html
   ▼
Nginx
   │
   │ requests.html
   ▼
Browser
```

HTMLを取得するだけの場合、Applicationへのアクセスは発生しない。

### 3.3 API実行時

例：申請一覧を取得する場合

```text
Browser
   │
   │ GET /api/requests
   │ Authorization: Bearer <JWT>
   ▼
Nginx
   │
   │ GET /requests
   ▼
FastAPI
   │
   ▼
SQLAlchemy
   │
   ▼
PostgreSQL
```

ブラウザからは `/api/*` を使用し、NginxからFastAPIへ転送する。

### URL対応例

| Browser | FastAPI |
|---|---|
| `/api/auth/login` | `/auth/login` |
| `/api/auth/me` | `/auth/me` |
| `/api/requests` | `/requests` |
| `/api/request-types` | `/request-types` |
| `/api/admin/users` | `/admin/users` |


## 4. 画面一覧

| 画面ID | 画面名 | 利用可能ロール | 主な機能 |
|---|---|---|---|
| SCR-01 | ログイン画面 | 全利用者 | ログイン |
| SCR-02 | 申請一覧画面 | user / approver / admin | 申請一覧参照 |
| SCR-03 | 新規申請画面 | user / approver / admin | 新規申請 |
| SCR-04 | 申請詳細画面 | user / approver / admin | 詳細参照・取消・承認履歴参照 |
| SCR-05 | 承認画面 | approver / admin | 承認・却下 |
| SCR-06 | ユーザー管理画面 | admin | ユーザー管理 |
| SCR-07 | 申請種別管理画面 | admin | 申請種別管理 |



## 5. 画面遷移

```text
                    ┌──────────────┐
                    │ SCR-01       │
                    │ ログイン      │
                    └──────┬───────┘
                           │
                       ログイン成功
                           │
                           ▼
                    ┌──────────────┐
                    │ SCR-02       │
                    │ 申請一覧      │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        SCR-03        SCR-04        SCR-05
        新規申請       申請詳細       承認
                                     ※approver/admin

adminの場合：

SCR-02
   │
   ├──→ SCR-06 ユーザー管理
   │
   └──→ SCR-07 申請種別管理
```

ログアウトした場合はSCR-01へ戻る。


## 6. SCR-01 ログイン画面

### 6.1 表示項目

| 項目 | 種別 | 必須 | 内容 |
|---|---|---:|---|
| ユーザー名 | テキスト入力 | ○ | username |
| パスワード | パスワード入力 | ○ | password |
| ログイン | ボタン | - | ログインAPI実行 |
| エラーメッセージ | テキスト | - | 認証失敗等を表示 |

### 6.2 処理

ログインボタン押下時：

```http
POST /api/auth/login
```

送信内容：

```json
{
  "username": "user01",
  "password": "password"
}
```

成功時：

```json
{
  "access_token": "...",
  "token_type": "bearer"
}
```

取得したJWTを `sessionStorage` に保存する。

その後、

```http
GET /api/auth/me
```

を実行し、ログインユーザーの以下の情報を取得する。

- id
- username
- role
- is_active


## 7. SCR-02 申請一覧画面

### 7.1 表示項目

#### ヘッダー

| 項目 | 内容 |
|---|---|
| システム名 | IT Service Request System |
| ユーザー名 | ログインユーザー |
| ロール | user / approver / admin |
| ログアウト | ログアウト処理 |

#### 申請一覧

| 項目 | API項目 |
|---|---|
| 申請ID | id |
| 申請種別 | request_type |
| タイトル | title |
| 申請者 | applicant_name |
| 状態 | status |
| 申請日時 | created_at |

状態は以下を表示する。

- pending
- approved
- rejected
- cancelled

### 7.2 操作

| 操作 | 内容 |
|---|---|
| 新規申請 | SCR-03へ遷移 |
| 詳細 | SCR-04へ遷移 |
| 承認メニュー | approver/adminのみ表示 |
| 管理メニュー | adminのみ表示 |
| ログアウト | JWTを削除してSCR-01へ遷移 |

### 7.3 使用API

```http
GET /api/requests
```

JWT認証を必須とする。

### 7.4 申請一覧の表示範囲

`GET /requests` は全ユーザーの申請を返却する。

初版では既存仕様を変更せず全件表示する。



## 8. SCR-03 新規申請画面

### 8.1 表示項目

| 項目 | 種別 | 必須 | 制約 |
|---|---|---:|---|
| 申請種別 | プルダウン | ○ | 有効な申請種別から選択 |
| タイトル | テキスト | ○ | 1～200文字 |
| 説明 | テキストエリア | ○ | 1～2000文字 |
| 申請者 | 表示のみ | - | ログインユーザー |
| 申請 | ボタン | - | 登録処理 |
| キャンセル | ボタン | - | 一覧へ戻る |

申請者はユーザーによる入力を行わない。

JWTから取得したログインユーザーをApplication側で設定する。

### 8.2 使用API

申請種別一覧取得：

```http
GET /api/request-types
```

申請登録：

```http
POST /api/requests
```

### 8.3 申請種別取得

新規申請画面表示時に、申請種別一覧GET APIを実行する。

取得した申請種別をプルダウンに表示する。

例：

```text
申請種別
[ アカウント作成 ▼ ]
```

一般ユーザー、approver、adminは申請種別のGETのみ可能とする。

申請種別の登録・更新はadminのみ可能とする。


## 9. SCR-04 申請詳細画面

### 9.1 表示項目

| 項目 | API項目 |
|---|---|
| 申請ID | id |
| 申請種別 | request_type |
| タイトル | title |
| 説明 | description |
| 申請者 | applicant_name |
| 状態 | status |
| 申請日時 | created_at |
| 更新日時 | updated_at |

### 9.2 承認履歴

申請詳細画面内に、対象申請の承認履歴を表示する。

対象となる申請を明確にするため、承認履歴の上部に申請IDを表示する。

#### 対象申請

| 項目 | 内容 |
|---|---|
| 申請ID | 対象申請のid |

#### 承認履歴一覧

| 項目 | API項目 |
|---|---|
| 操作 | action |
| コメント | comment |
| 承認者 | approver_name |
| 操作日時 | created_at |

使用API：

```http
GET /api/requests/{request_id}/approval-history
```

JWT認証を必須とする。

### 9.3 取消

取消ボタンは申請詳細画面に常時表示する。

取消ボタン押下時、GUI側では取消可否の業務判定を行わず、以下のAPIを実行する。

```http
PATCH /api/requests/{request_id}/cancel
```

取消可否はApplication側で判定する。

Application側の判定内容は以下とする。

```text
申請者本人 または admin
かつ
status = pending
```

取消不可の場合はApplicationからエラーを返却する。

| 条件 | HTTPステータス | 内容 |
|---|---|---|
| 対象申請が存在しない | 404 | Request not found |
| 他ユーザーの申請を取消しようとした | 403 | You cannot cancel another user's request |
| pending以外の申請を取消しようとした | 409 | Only pending requests can be cancelled |

GUIは返却されたHTTPステータスおよびエラー内容に応じてメッセージを表示する。

取消可否の最終判定はApplication側に統一する。


## 10. SCR-05 承認画面

### 10.1 利用可能ロール

```text
approver
admin
```

userは利用不可とする。

### 10.2 表示項目

| 項目 | 内容 |
|---|---|
| 申請ID | id |
| 申請種別 | request_type |
| タイトル | title |
| 申請者 | applicant_name |
| 状態 | status |
| コメント | 任意入力 |
| 承認 | ボタン |
| 却下 | ボタン |

コメントは最大1000文字とする。

### 10.3 承認

```http
PATCH /api/requests/{request_id}/approve
```

### 10.4 却下

```http
PATCH /api/requests/{request_id}/reject
```

承認・却下可否はApplication側で判定する。

`pending` 以外の申請に対して操作した場合は、Applicationから409 Conflictを返却する。


## 11. SCR-06 ユーザー管理画面

### 11.1 利用可能ロール

```text
admin
```

### 11.2 ユーザー一覧

| 項目 | API項目 |
|---|---|
| ID | id |
| ユーザー名 | username |
| ロール | role |
| 有効状態 | is_active |
| ロール変更 | 操作 |
| 有効状態変更 | 操作 |

### 11.3 ユーザー登録

| 項目 | 制約 |
|---|---|
| ユーザー名 | 3～100文字 |
| パスワード | 8～200文字 |
| ロール | user / approver / admin |

使用API：

```http
POST /api/admin/users
```

### 11.4 ロール変更

専用の変更画面は設けない。

ユーザー管理画面の一覧上でロールを選択し、変更ボタンを押下する。

使用API：

```http
PATCH /api/admin/users/{user_id}/role
```

### 11.5 有効状態変更

専用の変更画面は設けない。

ユーザー管理画面の一覧上に有効化／無効化ボタンを表示する。

使用API：

```http
PATCH /api/admin/users/{user_id}/active
```

自分自身を無効化しようとした場合はApplication側で409 Conflictを返却する。



## 12. SCR-07 申請種別管理画面

### 12.1 利用可能ロール

```text
admin
```

### 12.2 表示項目

| 項目 | API項目 |
|---|---|
| ID | id |
| コード | code |
| 名称 | name |
| 有効状態 | is_active |

### 12.3 申請種別一覧取得

申請種別一覧のGETは以下のロールに許可する。

```text
user
approver
admin
```

一般ユーザーおよびapproverは、新規申請画面のプルダウン表示のためにGETのみ利用可能とする。

管理画面SCR-07自体へのアクセスはadminのみ可能とする。

使用API：

```http
GET /api/request-types
```

### 12.4 新規登録

申請種別の登録はadminのみ可能とする。

| 項目 | 制約 |
|---|---|
| コード | 1～50文字、小文字英数字・アンダースコア |
| 名称 | 1～100文字 |

使用API：

```http
POST /api/admin/masters/request-types
```

### 12.5 更新

申請種別の更新はadminのみ可能とする。

```http
PATCH /api/admin/masters/request-types/{code}
```

変更可能項目：

- 名称
- 有効状態



## 13. 認証設計

### 13.1 認証方式

JWT Bearer認証を使用する。

```text
ユーザー
   │
   │ username/password
   ▼
POST /auth/login
   │
   │ JWT
   ▼
Browser
   │
   │ sessionStorage
   ▼
JWT保存
```

以降の認証対象APIリクエストには以下を付与する。

```http
Authorization: Bearer <JWT>
```

### 13.2 JWT保存

初版では以下を使用する。

```javascript
sessionStorage
```

ブラウザ・タブのセッション終了時にJWTが削除される。

### 13.3 ログアウト

以下を実施する。

1. sessionStorageからJWTを削除
2. ログインユーザー情報を削除
3. ログイン画面へ遷移

### 13.4 JWT期限切れ

APIから

```http
401 Unauthorized
```

が返却された場合、

1. JWTを削除
2. ログイン画面へ遷移

とする。

### 13.5 FastAPI側の認証

ログイン画面でJWTを取得するだけではなく、各APIでJWTを検証する。

以下のAPIはJWT認証必須とする。

```http
GET /requests
GET /requests/{id}
GET /requests/{id}/approval-history
GET /request-types
POST /requests
PATCH /requests/{id}/cancel
PATCH /requests/{id}/approve
PATCH /requests/{id}/reject
GET /auth/me
/admin配下の全API
```

`POST /auth/login` のみJWT認証不要とする。

---

## 14. 認可設計

### 14.1 ロール別権限

| 画面・操作 | user | approver | admin |
|---|:---:|:---:|:---:|
| ログイン | ○ | ○ | ○ |
| 申請一覧 | ○ | ○ | ○ |
| 申請詳細 | ○ | ○ | ○ |
| 新規申請 | ○ | ○ | ○ |
| 申請種別一覧GET | ○ | ○ | ○ |
| 自分のpending申請取消 | ○ | ○ | ○ |
| 他ユーザーの申請取消 | × | × | ○ |
| 承認 | × | ○ | ○ |
| 却下 | × | ○ | ○ |
| 承認履歴参照 | ○ | ○ | ○ |
| ユーザー管理画面 | × | × | ○ |
| ユーザー登録・変更 | × | × | ○ |
| 申請種別管理画面 | × | × | ○ |
| 申請種別登録・変更 | × | × | ○ |

### 14.2 GUI側の制御

画面そのものへのアクセス可否やメニュー表示はロールに応じて制御する。

ただし、申請取消や承認・却下等の業務上の操作可否についてはApplication側を最終判定とする。

例：

```text
取消ボタン
  ↓
常時表示
  ↓
押下
  ↓
ApplicationへAPI要求
  ↓
Applicationが本人/ロール/状態を判定
  ↓
成功 または 403/409
```

GUI側の制御だけを認可として扱わない。

---

## 15. 画面－API対応表

| 画面 | 処理 | Method | FastAPI API | 認証 | 認可 |
|---|---|---|---|---|---|
| SCR-01 | ログイン | POST | `/auth/login` | 不要 | 全利用者 |
| 共通 | ユーザー情報取得 | GET | `/auth/me` | JWT | 全ロール |
| SCR-02 | 申請一覧 | GET | `/requests` | JWT | 全ロール |
| SCR-03 | 申請種別一覧 | GET | `/request-types` | JWT | 全ロール |
| SCR-03 | 申請登録 | POST | `/requests` | JWT | 全ロール |
| SCR-04 | 申請詳細 | GET | `/requests/{id}` | JWT | 全ロール |
| SCR-04 | 取消 | PATCH | `/requests/{id}/cancel` | JWT | 本人/admin |
| SCR-04 | 承認履歴 | GET | `/requests/{id}/approval-history` | JWT | 全ロール |
| SCR-05 | 承認 | PATCH | `/requests/{id}/approve` | JWT | approver/admin |
| SCR-05 | 却下 | PATCH | `/requests/{id}/reject` | JWT | approver/admin |
| SCR-06 | ユーザー一覧 | GET | `/admin/users` | JWT | admin |
| SCR-06 | ユーザー詳細 | GET | `/admin/users/{id}` | JWT | admin |
| SCR-06 | ユーザー登録 | POST | `/admin/users` | JWT | admin |
| SCR-06 | ロール変更 | PATCH | `/admin/users/{id}/role` | JWT | admin |
| SCR-06 | 有効状態変更 | PATCH | `/admin/users/{id}/active` | JWT | admin |
| SCR-07 | 申請種別一覧 | GET | `/request-types` | JWT | 全ロール |
| SCR-07 | 申請種別登録 | POST | `/admin/masters/request-types` | JWT | admin |
| SCR-07 | 申請種別更新 | PATCH | `/admin/masters/request-types/{code}` | JWT | admin |

ブラウザから実際にアクセスする場合は、上記URLの先頭に `/api` を付与する。

例：

```text
FastAPI:
POST /auth/login

Browser:
POST /api/auth/login
```

---

## 16. 共通エラー処理

| HTTPステータス | 画面処理 |
|---|---|
| 400 | 入力内容等のエラーを表示 |
| 401 | JWTを削除しログイン画面へ |
| 403 | 権限不足・取消権限不足等のメッセージを表示 |
| 404 | 「対象が存在しません」を表示 |
| 409 | 申請状態競合、自分自身の無効化等のメッセージを表示 |
| 422 | 入力バリデーションエラーを表示 |
| 500系 | 「システムエラーが発生しました」を表示 |
| 通信失敗 | 「サーバーに接続できません」を表示 |

500系エラーの内部情報やスタックトレースは画面へ表示しない。



## 17. API修正事項

### 17.1 GET APIへの認証追加

現在未認証となっている以下のAPIにJWT認証を追加する。

```http
GET /requests
GET /requests/{id}
GET /requests/{id}/approval-history
```

修正後は、JWTを持つログイン済みユーザーのみ利用可能とする。

### 17.2 申請種別取得API

新規申請画面の申請種別プルダウン表示に使用するため、一般ユーザーを含む全ロールが利用可能なGET APIを用意する。

```http
GET /request-types
```

利用可能ロール：

```text
user
approver
admin
```

用途は参照のみとする。

一般ユーザーおよびapproverには、申請種別の登録・更新権限は付与しない。

登録・更新は以下のadmin用APIを使用する。

```http
POST /admin/masters/request-types
PATCH /admin/masters/request-types/{code}
```

### 17.3 申請一覧

```http
GET /requests
```

は全ユーザーの申請を返却する。

初版では既存仕様を変更せず全件表示する。

---

## 18. フロントエンドファイル構成

以下の構成を基本とする。

```text
frontend/
├── login.html
├── requests.html
├── request-new.html
├── request-detail.html
├── approvals.html
├── admin-users.html
├── admin-request-types.html
│
├── css/
│   └── style.css
│
└── js/
    ├── api.js
    ├── auth.js
    ├── requests.js
    ├── approvals.js
    └── admin.js
```

各JavaScriptの役割は以下とする。

| ファイル | 役割 |
|---|---|
| `api.js` | fetch共通処理、JWT付与、HTTPエラー処理 |
| `auth.js` | ログイン、ログアウト、ログインユーザー取得 |
| `requests.js` | 申請一覧、申請種別取得、登録、詳細、取消 |
| `approvals.js` | 承認、却下 |
| `admin.js` | ユーザー管理、申請種別管理 |



## 19. Nginx設計方針

現在はNginxの `/` をApplicationへリバースプロキシしている。

GUI実装後は役割を以下のように変更する。

```text
Nginx
│
├── /
│    └── HTML / CSS / JavaScript
│
└── /api/
     └── FastAPI Application:8000
```

想定イメージ：

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://application:8000/;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

具体的なNginx設定値は実装工程で確定する。



## 20. セキュリティ方針

GUI実装において以下を基本方針とする。

- パスワードをHTML/JavaScriptへ保存しない
- JWT以外の認証情報をブラウザへ保持しない
- JWTは初版ではsessionStorageへ保存する
- API側で認証・認可を最終判定する
- GUIのボタン表示・非表示だけに認可を依存しない
- 取消・承認・却下等の業務条件判定はApplication側を正とする
- ユーザー入力値をHTMLへ直接埋め込まない
- `innerHTML` の安易な利用を避ける
- Application内部エラーをユーザーへ直接表示しない
- HTTPS化は本番構成時に実施する
- CSP等の追加セキュリティヘッダーはセキュリティ設計で別途検討する



## 21. 実装順序

本設計に基づき、以下の順序でGUIを実装する。

1. FastAPI GET系APIへのJWT認証追加
2. 一般ユーザー向け申請種別GET API作成
3. frontendディレクトリ作成
4. Nginxの静的ファイル配信設定
5. `/api/` リバースプロキシ設定
6. 共通CSS作成
7. `api.js` 作成
8. ログイン画面作成
9. JWT認証処理作成
10. 申請一覧画面作成
11. 新規申請画面作成
12. 申請詳細・取消画面作成
13. 承認・却下画面作成
14. ユーザー管理画面作成
15. 申請種別管理画面作成
16. ロール別画面表示制御
17. エラー処理
18. 動作確認
