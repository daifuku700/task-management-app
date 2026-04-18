# ECS 手動デプロイ手順

このドキュメントでは、backend コンテナを ECR に push し、ECS + ALB で公開するまでの流れをまとめます。

## 目的

private EC2 上で手動起動していた backend を、AWS 管理のコンテナ実行基盤である ECS に移すことが目的です。

最終的なイメージは次の通りです。

```text
Browser
  -> ALB
  -> ECS Service
  -> ECS Task
  -> backend container
```

## 前提

次ができている想定です。

- プロジェクト用 VPC がある
- public subnet / private subnet がある
- ALB が作成済みである
- backend が Docker image として build できる
- backend は `8000` 番で動く
- `http://<ALB_DNS>/tasks` を目標にする

## 学ぶ対象

- ECR
- ECS Cluster
- ECS Task Definition
- ECS Service
- ALB と ECS の接続

## 1. ECR Repository を作る

AWS コンソールで:

1. `Amazon ECR`
2. `Repositories`
3. `Create repository`

設定例:

- Repository name: `task-app-backend`
- Visibility: `Private`

作成後、Repository URI を控えます。

例:

```text
123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/task-app-backend
```

## 2. backend image を build する

ローカル端末で実行します。

Dockerfile 名が `dockerfile` の場合:

```bash
docker build -t task-app-backend -f backend/dockerfile ./backend
```

## 3. ECR に login する

AWS CLI で ECR にログインします。

```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <YOUR_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
```

## 4. image に tag を付けて push する

```bash
docker tag task-app-backend:latest <ECR_REPOSITORY_URI>:v1
docker push <ECR_REPOSITORY_URI>:v1
```

例:

```bash
docker tag task-app-backend:latest 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/task-app-backend:v1
docker push 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/task-app-backend:v1
```

## 5. Apple Silicon / アーキテクチャ不一致の注意

ローカルが Apple Silicon の場合、通常 build すると `linux/arm64` image ができることがあります。

ECS 側が `linux/amd64` を取りに行くと、次のようなエラーになります。

```text
CannotPullContainerError: image Manifest does not contain descriptor matching platform 'linux/amd64'
```

この場合は、`buildx` を使って `linux/amd64` で build & push します。

```bash
docker buildx build \
  --platform linux/amd64 \
  -t <ECR_REPOSITORY_URI>:v1 \
  -f backend/dockerfile \
  ./backend \
  --push
```

学習段階では、まず `linux/amd64` に寄せるのが分かりやすいです。

## 6. ECS Cluster を作る

AWS コンソールで:

1. `Amazon ECS`
2. `Clusters`
3. `Create cluster`

設定例:

- Cluster name: `task-app-cluster`
- Infrastructure: `AWS Fargate`

作成します。

## 7. Task Definition を作る

AWS コンソールで:

1. `Amazon ECS`
2. `Task definitions`
3. `Create new task definition`

設定例:

- Family: `task-app-backend`
- Launch type / infrastructure: `Fargate`
- CPU: `0.25 vCPU`
- Memory: `0.5 GB`
- Execution role: `ecsTaskExecutionRole`

### Container 定義

- Container name: `backend`
- Image URI: ECR の image URI
- Container port: `8000`
- Protocol: `TCP`

必要なら environment variable を設定します。

例:

- `FRONTEND_ORIGINS`

## 8. ECS 用 Security Group を作る

ECS task 用の Security Group を作成します。

例:

- Name: `task-app-ecs-sg`

Inbound:

- Custom TCP `8000`
- Source: `task-app-alb-sg`

Outbound:

- default のままでよい

ECS task も private subnet に置き、ALB からの通信だけを受ける構成にします。

## 9. ECS 用 Target Group を作る

ECS 用には EC2 用とは別の target group を作る方が安全です。

設定例:

- Target type: `IP`
- Name: `task-app-backend-ecs-tg`
- Protocol: `HTTP`
- Port: `8000`
- VPC: プロジェクト用 VPC
- Health check path: `/tasks`

Fargate では target type を `IP` にするのが重要です。

## 10. ECS Service を作る

AWS コンソールで:

1. `Amazon ECS`
2. `Clusters`
3. `task-app-cluster`
4. `Services`
5. `Create`

### 基本設定

- Launch type: `FARGATE`
- Task definition family: `task-app-backend`
- Service name: `task-app-backend-service`
- Desired tasks: `1`

### Networking

- VPC: プロジェクト用 VPC
- Subnets: private subnet 2つ
- Security Group: `task-app-ecs-sg`
- Public IP: `Disabled`

### Load balancing

- Use load balancing: `On`
- Load balancer type: `Application Load Balancer`
- Load balancer: 既存の `task-app-alb`
- Listener: `HTTP:80`
- Target group: `task-app-backend-ecs-tg`

### Container mapping

- Container: `backend`
- Container port: `8000`

これは「ALB が ECS task のどの container / port に流すか」を指定する設定です。

## 11. Service 起動後に確認する

確認する場所:

- ECS Service events
- Running tasks
- Target group health status

期待状態:

- Task が `RUNNING`
- Target group が `healthy`

## 12. ALB DNS で確認する

ブラウザで次を開きます。

```text
http://<ALB_DNS>/tasks
```

ここで backend API のレスポンスが返れば成功です。

## 13. 詰まったときの確認ポイント

### Task が起動しない

確認:

- image URI が正しいか
- execution role があるか
- private subnet から外へ出られるか
- NAT Gateway があるか

### `CannotPullContainerError`

確認:

- ECR に image が push されているか
- image tag が正しいか
- image の architecture が ECS と一致しているか

Apple Silicon の場合、`linux/amd64` で build し直す必要があることがあります。

### Target group が unhealthy

確認:

- container port が `8000` か
- target group の target type が `IP` か
- health check path が `/tasks` か
- ECS task SG が ALB SG を許可しているか

## ここまでで理解したいこと

この工程で重要なのは次の 6 点です。

1. ECR は Docker image の保管場所
2. Task Definition はコンテナ実行定義
3. Service は desired count を維持する
4. ECS task は private subnet に置ける
5. ALB は ECS task に転送できる
6. EC2 に SSH して手で Docker を起動しなくてよくなる

## 次のステップ

ここまでできたら、次は `frontend を S3 + CloudFront で配信する` 段階に進みます。

この時点で目指す構成は次のようになります。

- frontend: S3 + CloudFront
- backend: ECS + ALB

この分離ができると、かなり本番に近い構成になります。
