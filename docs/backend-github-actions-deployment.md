# backend の GitHub Actions 自動デプロイ手順

このドキュメントでは、backend を GitHub Actions から ECR / ECS へ自動デプロイするまでの流れをまとめます。

## 目的

これまで backend は手動で次のように更新していました。

- Docker image を build
- ECR に push
- ECS service を更新

ここからは、それを GitHub Actions で自動化します。

最終的な流れは次の通りです。

```text
git push
  -> GitHub Actions
  -> backend image build
  -> ECR push
  -> ECS task definition 更新
  -> ECS service 再デプロイ
```

## 1. 事前に必要なもの

- ECR repository
- ECS Cluster
- ECS Service
- backend 用 task definition
- GitHub repository
- GitHub Actions 用 IAM Role

## 2. IAM Role を作る

AWS 側で backend 用の GitHub Actions role を作ります。

信頼設定:

- Web identity
- Identity provider: `token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`
- GitHub organization: 自分の GitHub owner
- GitHub repository: `task-management-app`
- GitHub branch: `main`

role には backend 用 custom policy を付けます。

必要な権限の考え方:

- ECR push
- ECS task definition 登録
- ECS service 更新
- `iam:PassRole`

## 3. GitHub Secrets / Variables を設定する

GitHub repository で:

1. `Settings`
2. `Secrets and variables`
3. `Actions`

### Secret

- `AWS_ROLE_TO_ASSUME_BACKEND`

値の例:

```text
arn:aws:iam::274847732759:role/github-actions-backend-deploy-role
```

### Variables

- `AWS_REGION`
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `ECS_SERVICE`
- `CONTAINER_NAME`

例:

```text
AWS_REGION=ap-northeast-1
ECR_REPOSITORY=task-app-backend
ECS_CLUSTER=task-app-cluster
ECS_SERVICE=task-app-backend-service
CONTAINER_NAME=backend
```

## 4. task definition JSON を repo に保存する

現在の ECS task definition を JSON として repo に保存します。

おすすめの保存先:

```text
.aws/task-definition.json
```

### 注意

ECS コンソールからそのままコピーした JSON には、読み取り専用フィールドが含まれることがあります。

削除対象の例:

- `taskDefinitionArn`
- `revision`
- `status`
- `requiresAttributes`
- `compatibilities`
- `registeredAt`
- `registeredBy`

残す中心項目:

- `family`
- `containerDefinitions`
- `executionRoleArn`
- `networkMode`
- `volumes`
- `placementConstraints`
- `requiresCompatibilities`
- `cpu`
- `memory`
- `runtimePlatform`

## 5. workflow ファイルを作る

作るファイル:

```text
.github/workflows/deploy-backend.yml
```

### 役割

- `main` branch への push で起動
- backend だけを対象にする
- OIDC で AWS role を assume
- ECR に login
- image build / push
- task definition に image URI を差し込む
- ECS service を更新

## 6. workflow の構成例

```yaml
name: Deploy Backend to ECS

on:
  push:
    branches:
      - main
    paths:
      - "backend/**"
      - ".github/workflows/deploy-backend.yml"
      - ".aws/task-definition.json"

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ${{ vars.AWS_REGION }}
  ECR_REPOSITORY: ${{ vars.ECR_REPOSITORY }}
  ECS_SERVICE: ${{ vars.ECS_SERVICE }}
  ECS_CLUSTER: ${{ vars.ECS_CLUSTER }}
  ECS_TASK_DEFINITION: .aws/task-definition.json
  CONTAINER_NAME: ${{ vars.CONTAINER_NAME }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME_BACKEND }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker buildx build \
            --platform linux/amd64 \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -f backend/dockerfile \
            ./backend \
            --push
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Render ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ${{ env.ECS_TASK_DEFINITION }}
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
```

## 7. 今回ハマったポイント

### `ECR_REPOSITORY` が空

GitHub Variables に `ECR_REPOSITORY` が入っていないと、image tag が壊れます。

エラー例:

```text
invalid tag "...amazonaws.com/:<sha>": invalid reference format
```

これは repository 名が空であることが原因です。

### image の architecture mismatch

Apple Silicon などで build すると `arm64` image になることがあります。

ECS 側が `linux/amd64` を要求している場合、次のようなエラーになります。

```text
CannotPullContainerError: image Manifest does not contain descriptor matching platform 'linux/amd64'
```

そのため workflow では:

```bash
docker buildx build --platform linux/amd64 ...
```

としています。

## 8. 動作確認

workflow を push したら GitHub の `Actions` タブで確認します。

見るポイント:

- `Configure AWS credentials`
- `Login to Amazon ECR`
- `Build, tag, and push image`
- `Deploy to ECS`

AWS 側では:

- ECR に新しい image tag が増える
- ECS service に新しい deployment が出る
- ALB 経由の API が動く

## 9. ここまでで理解したいこと

1. GitHub Actions は push を起点に自動化できる
2. OIDC で AWS role を安全に assume できる
3. backend は image を build して ECR に push する
4. ECS task definition の image だけ差し替えて service 更新できる
5. backend の更新は `ECR -> ECS -> ALB` の流れで公開される

## 次のステップ

次は frontend の GitHub Actions 自動デプロイです。

やること:

- frontend build
- S3 sync
- CloudFront invalidation
