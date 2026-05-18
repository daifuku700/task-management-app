# Terraform backend / ECS 構成

このドキュメントでは、Terraform で backend を ECS Fargate に載せる構成をまとめます。

対象ファイル:

- [alb.tf](/Users/dai/code/task-management-app/terraform/alb.tf)
- [ecr.tf](/Users/dai/code/task-management-app/terraform/ecr.tf)
- [ecs.tf](/Users/dai/code/task-management-app/terraform/ecs.tf)

## 全体像

backend の通信経路は次です。

```text
Browser
  -> ALB
  -> target group
  -> ECS service
  -> Fargate task
  -> backend container :8000
```

container image の流れは次です。

```text
Docker image
  -> ECR repository
  -> ECS task definition
  -> ECS service
```

## ALB

ALB は public subnet に配置します。

```hcl
resource "aws_lb" "main" {
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets = [
    aws_subnet.public_1a.id,
    aws_subnet.public_1c.id
  ]
}
```

`internal = false` は internet-facing ALB という意味です。

public subnet を 2 つ渡しているのは、ALB が複数 AZ 前提のサービスだからです。

## Target Group

backend 用 target group は port 8000 にしています。

```hcl
resource "aws_lb_target_group" "backend" {
  port        = 8000
  protocol    = "HTTP"
  target_type = "ip"
}
```

ECS Fargate の場合、`target_type = "ip"` を使います。

理由は、Fargate task は EC2 instance ID ではなく、task の private IP として target group に登録されるためです。

health check は `/tasks` にしています。

```hcl
health_check {
  path    = "/tasks"
  matcher = "200"
}
```

この path が backend で 200 を返さないと、target は unhealthy になります。

## Listener

今回の Terraform 構成では、まず HTTP listener を作っています。

```hcl
resource "aws_lb_listener" "http" {
  port     = 80
  protocol = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
```

意味:

```text
ALB の 80 番で受けたリクエストを backend target group に流す
```

学習用としては HTTP で十分です。

本番に近づける場合は、ACM certificate を使って HTTPS listener を追加します。

## ECR

ECR は Docker image の置き場所です。

```hcl
resource "aws_ecr_repository" "backend" {
  name         = "${var.project_name}-backend"
  force_delete = true
}
```

`force_delete = true` は、repository 内に image が残っていても destroy 時に削除できるようにする設定です。

学習用では便利ですが、本番では誤削除リスクがあるため慎重に使います。

lifecycle policy では image を残しすぎないようにしています。

```text
Keep last 5 images
```

## ECS Cluster

ECS cluster は ECS service や task を置く論理的なまとまりです。

```hcl
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
}
```

Fargate を使うため、EC2 container instance は不要です。

## ECS task execution role

ECS task execution role は、ECS が task を起動するために使う IAM role です。

主に次のために必要です。

- ECR から image を pull する
- CloudWatch Logs に log を送る

Terraform では AWS managed policy を attach しています。

```hcl
policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
```

## CloudWatch Logs

backend container の log を CloudWatch Logs に送るため、log group を作っています。

```hcl
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = 7
}
```

`retention_in_days = 7` により、log は 7 日で削除されます。

学習用途では、長期間残しすぎない方が管理しやすいです。

## Task Definition

Task Definition は、ECS で起動する container の定義です。

主な設定:

- Fargate
- awsvpc network mode
- CPU 256
- memory 512
- backend container
- ECR image `:latest`
- port 8000
- CloudWatch Logs

```hcl
requires_compatibilities = ["FARGATE"]
network_mode             = "awsvpc"
cpu                      = "256"
memory                   = "512"
```

Fargate では `network_mode = "awsvpc"` が必要です。

container image は ECR repository URL を参照しています。

```hcl
image = "${aws_ecr_repository.backend.repository_url}:latest"
```

## ECS Service

ECS Service は desired count を維持します。

```hcl
desired_count = 1
launch_type   = "FARGATE"
```

network configuration では private subnet を指定しています。

```hcl
subnets = [
  aws_subnet.private_1a.id,
  aws_subnet.private_1c.id
]

assign_public_ip = false
```

つまり、backend task は public IP を持ちません。

外部公開は ALB 経由だけです。

target group との接続は `load_balancer` block で行います。

```hcl
load_balancer {
  target_group_arn = aws_lb_target_group.backend.arn
  container_name   = "backend"
  container_port   = 8000
}
```

これにより、ECS service が起動した task を target group に自動登録します。

手動で target group に IP を登録する必要はありません。

## ECS 起動前に必要なこと

ECS service を作る前に、ECR に image が push されている必要があります。

image がない場合、task は起動に失敗します。

大まかな流れ:

```bash
aws ecr get-login-password --region ap-northeast-1 \
  | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com

docker build --platform linux/amd64 \
  -t <ECR_REPOSITORY_URL>:latest \
  -f backend/dockerfile backend

docker push <ECR_REPOSITORY_URL>:latest
```

account ID は次で確認できます。

```bash
aws sts get-caller-identity --query Account --output text
```

## 理解するべきポイント

- ALB は public subnet に置く
- ECS task は private subnet に置く
- Fargate の target group は `target_type = "ip"` にする
- ECS service が task を target group に自動登録する
- private subnet の ECS task が ECR に出るには NAT Gateway などが必要
- task execution role は image pull と log 出力に必要
- `desired_count = 1` により ECS service が task 1 個を維持する
