# frontend の GitHub Actions 自動デプロイ手順

このドキュメントでは、frontend を GitHub Actions から S3 + CloudFront へ自動デプロイする流れをまとめます。

## 目的

これまで frontend は手動で次のように更新していました。

- `npm run build`
- `aws s3 sync`
- `aws cloudfront create-invalidation`

ここからは、それを GitHub Actions で自動化します。

最終的な流れは次の通りです。

```text
git push
  -> GitHub Actions
  -> frontend build
  -> S3 sync
  -> CloudFront invalidation
```

## 1. 事前に必要なもの

- S3 bucket
- CloudFront distribution
- frontend 用 GitHub Actions role
- backend API の HTTPS URL

## 2. IAM Role を作る

frontend 用 role は backend 用と分けます。

信頼設定:

- Web identity
- Identity provider: `token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`
- GitHub organization: 自分の GitHub owner
- GitHub repository: `task-management-app`
- GitHub branch: `main`

権限の考え方:

- S3 bucket の list / put / delete
- CloudFront invalidation

## 3. GitHub Secrets / Variables を設定する

GitHub repository で:

1. `Settings`
2. `Secrets and variables`
3. `Actions`

### Secret

- `AWS_ROLE_TO_ASSUME_FRONTEND`

例:

```text
arn:aws:iam::274847732759:role/github-actions-frontend-deploy-role
```

### Variables

- `AWS_REGION`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`
- `VITE_API_BASE_URL`

例:

```text
AWS_REGION=ap-northeast-1
S3_BUCKET=task-app-frontend-2026
CLOUDFRONT_DISTRIBUTION_ID=E3HU7R31U9MWTC
VITE_API_BASE_URL=https://task-app-api.daifukunaga.com
```

## 4. workflow ファイルを作る

作るファイル:

```text
.github/workflows/deploy-frontend.yml
```

### 役割

- `main` branch への push で起動
- frontend 関連変更だけを対象にする
- Node をセットアップする
- frontend を build する
- S3 に sync する
- CloudFront invalidation を実行する

## 5. workflow の構成例

```yaml
name: Deploy Frontend to S3 and CloudFront

on:
  push:
    branches:
      - main
    paths:
      - "frontend/**"
      - ".github/workflows/deploy-frontend.yml"

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ${{ vars.AWS_REGION }}
  S3_BUCKET: ${{ vars.S3_BUCKET }}
  CLOUDFRONT_DISTRIBUTION_ID: ${{ vars.CLOUDFRONT_DISTRIBUTION_ID }}
  VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Build frontend
        run: npm run build
        working-directory: frontend
        env:
          VITE_API_BASE_URL: ${{ env.VITE_API_BASE_URL }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME_FRONTEND }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Sync to S3
        run: aws s3 sync frontend/dist s3://${{ env.S3_BUCKET }} --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

## 6. この workflow で重要なこと

### `VITE_API_BASE_URL` は build 時に渡す

Vite の env は build 時に埋め込まれます。

そのため:

- workflow 実行時に env を渡す
- `npm run build` の前に値が決まっている

必要があります。

### S3 は `dist/` の中身を同期する

```bash
aws s3 sync frontend/dist s3://<bucket> --delete
```

で、frontend の成果物を bucket に反映します。

### CloudFront invalidation を入れる

build を置き換えても、CloudFront のキャッシュが古いとすぐには反映されないことがあります。

そのため:

```bash
aws cloudfront create-invalidation --paths "/*"
```

を実行します。

## 7. 動作確認

workflow を push したら GitHub の `Actions` タブで確認します。

見るポイント:

- `Setup Node`
- `Install dependencies`
- `Build frontend`
- `Sync to S3`
- `Invalidate CloudFront`

その後:

- CloudFront domain にアクセス
- 画面が更新されているか確認
- backend API と通信できるか確認

## 8. 詰まりやすいポイント

### `VITE_API_BASE_URL` が反映されない

原因候補:

- GitHub Variable が未設定
- build 前に env が渡っていない
- 古い build が CloudFront に残っている

### CloudFront invalidation をしても古く見える

確認:

- distribution ID が正しいか
- `--paths "/*"` になっているか

### API 通信だけ失敗する

確認:

- `VITE_API_BASE_URL` が `https://task-app-api.daifukunaga.com` になっているか
- backend の `FRONTEND_ORIGINS` に CloudFront origin が含まれているか

## 9. ここまでで理解したいこと

1. frontend は build 成果物を配信する
2. GitHub Actions で build から配信まで自動化できる
3. Vite の env は build 時に埋め込まれる
4. S3 sync と CloudFront invalidation の両方が必要になる
5. frontend と backend でデプロイ方法が違う

## 次のステップ

frontend / backend の GitHub Actions が両方できたら、次は CodePipeline と比較しながら CI/CD 全体を整理する段階です。
