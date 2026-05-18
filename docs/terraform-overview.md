# Terraform 学習の全体像

このドキュメントでは、これまで AWS Console で手作業してきた構成を Terraform でコード化する流れをまとめます。

## Terraform でやりたいこと

Terraform の目的は、AWS リソースを手順書ではなくコードで管理することです。

今回の学習では、次のような構成を Terraform で表現しました。

```text
Internet
  -> ALB
  -> ECS Service
  -> Fargate Task
  -> ECR image
```

network としては、次の構成です。

```text
VPC
├─ public subnet 1a
├─ public subnet 1c
├─ private subnet 1a
└─ private subnet 1c
```

public subnet には ALB と NAT Gateway を配置します。

private subnet には ECS task を配置します。

## 基本コマンド

Terraform の基本操作は次です。

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
terraform destroy
```

それぞれの意味:

- `terraform init`: provider plugin を取得して作業ディレクトリを初期化する
- `terraform fmt`: `.tf` ファイルを整形する
- `terraform validate`: Terraform 設定として正しいか確認する
- `terraform plan`: 何が作成・変更・削除されるか確認する
- `terraform apply`: 実際に AWS に反映する
- `terraform destroy`: Terraform 管理下のリソースを削除する

重要なのは、いきなり `apply` しないことです。

まず `plan` を読み、想定外の削除や置き換えがないことを確認します。

## resource 名の考え方

例えば次の定義があります。

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.10.0.0/16"
}
```

このうち、`aws_vpc` は resource type、`main` は Terraform 内だけで使う論理名です。

AWS Console 上の名前ではありません。

Terraform 内では次のように参照します。

```hcl
aws_vpc.main.id
```

これは「Terraform が管理している `aws_vpc.main` の AWS 上の実 ID」を意味します。

実際には次のような VPC ID になります。

```text
vpc-xxxxxxxxxxxxxxxxx
```

この参照を書くことで、Terraform は依存関係も理解します。

例えば subnet 側で次のように書くと、Terraform は VPC を先に作り、その後 subnet を作ります。

```hcl
vpc_id = aws_vpc.main.id
```

## output の役割

`output` は、作成したリソースの ID や DNS name を確認しやすくするためのものです。

例:

```hcl
output "vpc_id" {
  value = aws_vpc.main.id
}
```

確認するときは次を実行します。

```bash
terraform output
```

特定の値だけ見たい場合:

```bash
terraform output vpc_id
```

学習中は、VPC ID、subnet ID、route table ID、ALB DNS name、ECR repository URL などを output しておくと理解しやすいです。

## ファイル分割

最初は `main.tf` にすべて書いても問題ありません。

ただし、resource が増えると読みにくくなるため、責務ごとに分割しました。

現在の構成:

```text
terraform/
  provider.tf
  variables.tf
  outputs.tf
  main.tf
  network.tf
  security_group.tf
  alb.tf
  ecr.tf
  ecs.tf
```

Terraform は同じディレクトリ内の `.tf` ファイルをすべてまとめて読みます。

そのため、ファイルを分けても次のような参照はそのまま使えます。

```hcl
vpc_id = aws_vpc.main.id
```

ファイル分割は Terraform の実行単位を分けるものではなく、人間が読みやすくするための整理です。

## 現在のファイルの役割

- `provider.tf`: Terraform と AWS provider の設定
- `variables.tf`: region や project name などの変数
- `outputs.tf`: 作成後に確認したい値
- `main.tf`: 分割先の案内
- `network.tf`: VPC、subnet、route table、IGW、NAT Gateway
- `security_group.tf`: ALB と backend の security group
- `alb.tf`: ALB、target group、listener
- `ecr.tf`: ECR repository と lifecycle policy
- `ecs.tf`: ECS cluster、IAM role、log group、task definition、service

## 今回の到達点

今回の Terraform 学習では、次を確認しました。

- AWS provider の認証が必要であること
- `aws_vpc.main.id` のような参照で resource 同士をつなぐこと
- VPC / subnet / route table / IGW / NAT Gateway を Terraform で書けること
- Security Group を Terraform で書けること
- ALB / target group / listener を Terraform で書けること
- ECR / ECS を Terraform で書けること
- `main.tf` が大きくなったら責務ごとに分割すること
- `terraform destroy` 時に ECR image が残っていると削除に失敗すること

関連ドキュメント:

- [Terraform network 構成](/Users/dai/code/task-management-app/docs/terraform-network.md)
- [Terraform backend 構成](/Users/dai/code/task-management-app/docs/terraform-backend-ecs.md)
- [Terraform troubleshooting](/Users/dai/code/task-management-app/docs/terraform-troubleshooting.md)
