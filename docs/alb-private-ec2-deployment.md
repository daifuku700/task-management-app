# ALB + Private EC2 で backend を公開する手順

このドキュメントでは、ALB を public subnet に置き、backend を private subnet 上の EC2 で動かすまでの流れをまとめます。

## 目的

EC2 を public IP 付きで直接公開するのではなく、ALB を入口にして private subnet 上の backend を外部公開する構成を理解することが目的です。

この構成にすると、外部ユーザーは ALB にだけアクセスし、EC2 自体には直接アクセスしません。

## 到達イメージ

```text
Browser
  -> ALB (public subnet)
  -> Target Group
  -> EC2 (private subnet)
  -> FastAPI backend (:8000)
```

## 前提

次がすでにできている想定です。

- プロジェクト用 VPC がある
- public subnet と private subnet を理解している
- backend 用 Docker image / compose 設定がある
- EC2 上で Docker を使える

## 構成

今回の学習では、次の構成を使います。

- public subnet: 2つ
- private subnet: 2つ
- Internet Gateway: 1つ
- NAT Gateway: 1つ
- ALB: public subnet に配置
- backend EC2: private subnet に配置

## 1. Public Subnet を 2 つ用意する

ALB は通常、複数 AZ の subnet を必要とします。

例:

- `task-app-public-subnet-1a`
- `task-app-public-subnet-1c`

それぞれ:

- Auto-assign public IPv4 address を有効
- public route table に関連付け

## 2. Private Subnet を 2 つ用意する

backend 用 EC2 を置く subnet を作ります。

例:

- `task-app-private-subnet-1a`
- `task-app-private-subnet-1c`

これらの subnet は:

- public IP 自動付与なし
- private route table に関連付け

## 3. Route Table を設定する

### public route table

- `0.0.0.0/0 -> Internet Gateway`

### private route table

- `0.0.0.0/0 -> NAT Gateway`

これにより:

- public subnet は外部から到達可能
- private subnet は outbound のみ internet へ出られる

## 4. Security Group を分ける

### ALB 用 Security Group

例:

- Name: `task-app-alb-sg`

Inbound:

- HTTP `80` from `0.0.0.0/0`

Outbound:

- default のままでよい

### backend EC2 用 Security Group

例:

- Name: `task-app-ec2-sg`

Inbound:

- Custom TCP `8000`
- Source: `task-app-alb-sg`

必要に応じて SSH:

- SSH `22`
- Source: 踏み台 EC2 の Security Group または Session Manager を利用

重要なのは、`8000` を `0.0.0.0/0` で開けないことです。

## 5. Target Group を作る

ALB が転送する先を定義します。

設定例:

- Target type: `Instances`
- Protocol: `HTTP`
- Port: `8000`
- VPC: プロジェクト用 VPC
- Health check path: `/tasks`

`/tasks` が 200 を返すため、health check に使えます。

## 6. ALB を作る

設定例:

- Type: `Application Load Balancer`
- Scheme: `Internet-facing`
- IP address type: `IPv4`
- VPC: プロジェクト用 VPC
- Subnet: public subnet 2つ
- Security Group: `task-app-alb-sg`
- Listener: `HTTP : 80`
- Default action: backend 用 target group に転送

作成後、ALB には DNS 名が付きます。

例:

- `task-app-alb-xxxx.ap-northeast-1.elb.amazonaws.com`

## 7. private subnet に EC2 を作る

backend を動かす EC2 を private subnet に作成します。

設定例:

- AMI: `Amazon Linux 2023`
- Instance type: `t3.micro`
- VPC: プロジェクト用 VPC
- Subnet: private subnet
- Auto-assign public IP: `Disable`
- Security Group: `task-app-ec2-sg`

ここで public IP を付けないのが重要です。

## 8. private EC2 に入る

private EC2 へ入る方法は主に 2 つあります。

### 方法 1: 踏み台 EC2 経由

1. public subnet 上の踏み台 EC2 に SSH
2. そこから private IP を使って private EC2 に SSH

### 方法 2: Session Manager

より実務的ですが、IAM role や Systems Manager の理解が必要です。

学習段階では、まず踏み台方式でも問題ありません。

## 9. private EC2 で backend を起動する

private EC2 にログインしたら、まず Docker を使えるようにします。

```bash
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user
```

再ログイン後:

```bash
docker info
docker compose version
```

次にリポジトリを配置します。

NAT Gateway が正しく設定されていれば、private subnet から外へ出られるため、Git clone や Docker image pull も可能です。

backend だけ起動する場合:

```bash
docker compose up -d --build backend
```

確認:

```bash
docker compose ps
docker compose logs -f backend
curl http://localhost:8000/tasks
```

`curl http://localhost:8000/tasks` が成功すれば、EC2 内で backend は正常起動しています。

## 10. Target Group に EC2 を登録する

ALB が転送できるように、private EC2 を target group に登録します。

登録後、health status が `healthy` になるか確認します。

## 11. ALB DNS で確認する

ブラウザで ALB の DNS にアクセスします。

例:

```text
http://<ALB_DNS>/tasks
```

ここで backend のレスポンスが見えれば成功です。

この時点で:

- backend は private subnet にある
- EC2 は public IP を持っていない
- それでも ALB 経由で外部に公開できている

という構成を理解できます。

## 12. 詰まったときの確認ポイント

### ALB の DNS にアクセスしても返らない

確認:

- backend コンテナが起動しているか
- `curl http://localhost:8000/tasks` が private EC2 内で成功するか
- target group が `healthy` か
- health check path が `/tasks` か

### Target Group が unhealthy

確認:

- backend が `0.0.0.0:8000` で listen しているか
- EC2 の Security Group が ALB の Security Group から `8000` を許可しているか
- target group の port が `8000` か

### private EC2 が外へ出られない

確認:

- NAT Gateway が作成されているか
- private route table に `0.0.0.0/0 -> NAT Gateway` があるか
- private subnet が private route table に関連付いているか

## ここまでで理解したいこと

この工程で特に重要なのは次の 5 点です。

1. ALB は public subnet に置く
2. EC2 は private subnet に置く
3. EC2 は public IP を持たなくてもよい
4. 外部からの入口は ALB に集約する
5. EC2 側の inbound は ALB の Security Group だけ許可する

## この次のステップ

ここまでできたら、次は `ECS に手動デプロイする` 段階に進めます。

ECS では、今 EC2 上で手動起動している backend コンテナを、AWS 管理のコンテナ実行基盤へ移します。

次に理解すべき対象は次の通りです。

- ECR
- ECS Cluster
- ECS Task Definition
- ECS Service
- ALB と ECS の接続

今の ALB + private EC2 構成は、そのまま ECS へ進むための土台になります。
