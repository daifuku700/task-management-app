# Frontend の仕組み

このドキュメントでは、このプロジェクトの frontend がどのように動いているかを整理します。

## 使用技術

- React
- TypeScript
- Vite

frontend は `frontend/` ディレクトリにあります。

## 役割

frontend の役割は、ユーザーが見る画面を表示し、backend API と通信して task を操作することです。

現在の機能は次の通りです。

- task 一覧の取得
- task の作成
- task の更新
- task の削除

## API 通信の流れ

API 通信は [frontend/src/api/tasks.ts](/Users/dai/code/task-management-app/frontend/src/api/tasks.ts:1) にまとまっています。

基本の流れはこうです。

1. frontend が `fetch` を使って backend API を呼ぶ
2. backend が JSON を返す
3. frontend が受け取ったデータを画面に反映する

たとえば task 一覧取得では、frontend から `GET /tasks` を呼びます。

## VITE_API_BASE_URL の意味

frontend は API のベース URL を `VITE_API_BASE_URL` から読みます。

```ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
```

これは Vite の環境変数機能です。

ポイントは次の 2 つです。

- `VITE_` で始まる環境変数だけがブラウザ側コードから参照できる
- この値は **ブラウザから到達できる URL** である必要がある

つまり、frontend コンテナから backend コンテナに届く URL ではなく、**ユーザーのブラウザがアクセスできる URL** を入れる必要があります。

## ローカル開発時の設定

ローカルでは通常次の値を使います。

```env
VITE_API_BASE_URL=http://localhost:8000
```

この値を `frontend/.env.local` に置くか、Compose の `environment` で渡します。

## EC2 上での設定

EC2 ではブラウザから backend へアクセスするので、`localhost` ではなく EC2 の public IP を使います。

例:

```env
VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>:8000
```

## Vite dev server の役割

現在の frontend は production build ではなく、Vite の開発サーバーで動かしています。

特徴:

- 起動が速い
- コード変更が即座に反映される
- HMR により画面更新が速い

一方で、本番向けではありません。将来的には `npm run build` した静的ファイルを配信する構成へ進めます。

## docker compose との関係

`compose.yml` では frontend に次のような設定があります。

- `ports: 5173:5173`
- `environment: VITE_API_BASE_URL=...`
- `volumes: ./frontend:/app`
- `frontend-node_modules:/app/node_modules`

これにより:

- ブラウザから `5173` でアクセスできる
- Vite が API URL を読める
- ソースコードの変更がコンテナに反映される
- `node_modules` は Docker volume に保持される

## 現時点の注意点

- frontend は開発サーバーで動いている
- API URL はブラウザ視点で設定する必要がある
- `.env` を変更したら Vite の再起動が必要

## 今後の発展

今後は次のような改善が考えられます。

- production build を作る
- Nginx や S3 + CloudFront で静的配信する
- backend を reverse proxy 越しに呼ぶ
