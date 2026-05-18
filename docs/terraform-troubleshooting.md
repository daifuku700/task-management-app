# Terraform troubleshooting

このドキュメントでは、Terraform 学習中に詰まった点と対処をまとめます。

## AWS credential が見つからない

エラー例:

```text
Error: No valid credential sources found
login session has expired, please reauthenticate
```

原因:

Terraform が AWS API を呼ぶための認証情報を取得できていません。

AWS CLI / SSO の login session が切れている場合にも起きます。

確認:

```bash
aws sts get-caller-identity
```

SSO を使っている場合:

```bash
aws sso login
```

profile を使っている場合:

```bash
aws sso login --profile your-profile-name
AWS_PROFILE=your-profile-name terraform plan
```

Terraform provider に profile を書くこともできます。

```hcl
provider "aws" {
  region  = var.aws_region
  profile = "your-profile-name"
}
```

ただし、個人環境依存の profile 名を repository に固定すると他の人が使いにくくなるため、学習中は環境変数で指定する方が扱いやすいです。

## `terraform validate` で provider plugin エラー

エラー例:

```text
Failed to load plugin schemas
failed to instantiate provider registry.terraform.io/hashicorp/aws
```

これは Terraform の `.tf` 構文ではなく、ローカルにある provider plugin の起動に失敗している可能性があります。

まず試すこと:

```bash
terraform init -upgrade
terraform validate
```

それでも直らない場合は、`.terraform` 配下の provider cache が壊れている可能性があります。

学習環境なら、`.terraform` を消して `terraform init` し直す選択肢もあります。

ただし、`terraform.tfstate` は消してはいけません。state を消すと Terraform が既存リソースを管理していることを忘れます。

## `terraform destroy` で ECR repository が削除できない

エラー例:

```text
RepositoryNotEmptyException:
The repository with name 'task-app-backend' cannot be deleted because it still contains images
```

原因:

ECR repository の中に Docker image が残っています。

ECR はデフォルトでは、中身がある repository を削除できません。

対応は 2 つあります。

### 方法 1: image を手動削除する

AWS Console で:

1. Amazon ECR
2. Repositories
3. `task-app-backend`
4. Images
5. image を選択して削除
6. 再度 `terraform destroy`

### 方法 2: `force_delete = true` を使う

Terraform では次のようにします。

```hcl
resource "aws_ecr_repository" "backend" {
  name         = "${var.project_name}-backend"
  force_delete = true
}
```

これにより、image が残っていても repository ごと削除できます。

学習用では便利ですが、本番では誤削除リスクがあるため注意します。

## `main.tf` が大きくなりすぎる

最初は `main.tf` に全部書いても問題ありません。

ただし、resource が増えると読みにくくなるため、責務ごとに分割します。

今回の分割:

```text
network.tf
security_group.tf
alb.tf
ecr.tf
ecs.tf
```

重要:

Terraform は同じディレクトリ内の `.tf` ファイルを全部まとめて読みます。

そのため、ファイルを分けても resource address が変わらなければ state には影響しません。

例えば次は、ファイルをまたいでも問題なく参照できます。

```hcl
vpc_id = aws_vpc.main.id
```

## ファイル分割後に確認すること

ファイルを分割しただけなら、通常は AWS リソース差分は出ません。

確認:

```bash
terraform fmt
terraform validate
terraform plan
```

`plan` で作成・削除が出ないなら、分割だけでリソースへの影響はありません。

## NAT Gateway の課金

NAT Gateway は学習用途でも課金されやすいです。

private subnet の ECS task が ECR から image を pull するには必要ですが、使わない時間が長い場合は削除を検討します。

ただし、NAT Gateway を削除すると private subnet の task は ECR や外部 API に出られません。

学習を止めるときは、次を意識します。

- `terraform destroy` でまとめて削除する
- ECS service の desired count を 0 にする
- NAT Gateway を残しっぱなしにしない
- ALB / Fargate / NAT Gateway は課金されやすい

## state file の注意

`terraform.tfstate` は Terraform が管理対象を覚える重要なファイルです。

学習中に local state を使う場合、次の点に注意します。

- `terraform.tfstate` を不用意に削除しない
- credentials や secret を state に含めない
- team 開発では local state ではなく remote backend を使う

今回は学習用なので local state で進めています。

本格運用では S3 backend + DynamoDB lock などを検討します。
