# Terraform network 構成

このドキュメントでは、Terraform で作成した network 周りの構成をまとめます。

対象ファイル:

- [network.tf](/Users/dai/code/task-management-app/terraform/network.tf)
- [security_group.tf](/Users/dai/code/task-management-app/terraform/security_group.tf)

## 作成した network

今回の構成では、1 つの VPC の中に public subnet と private subnet を 2 AZ 分作成しました。

```text
VPC: 10.10.0.0/16

public subnet:
  - 10.10.1.0/24  ap-northeast-1a
  - 10.10.2.0/24  ap-northeast-1c

private subnet:
  - 10.10.11.0/24 ap-northeast-1a
  - 10.10.12.0/24 ap-northeast-1c
```

## VPC

VPC は AWS 上の専用ネットワークです。

Terraform では次の resource で表現しています。

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}
```

`enable_dns_support` と `enable_dns_hostnames` は、VPC 内で DNS を使いやすくするために有効化しています。

ECS や ALB を使う構成では、有効にしておく方が自然です。

## subnet

subnet は VPC の中の区画です。

public subnet は次のようにしています。

```hcl
map_public_ip_on_launch = true
```

これは、その subnet で起動した EC2 などに public IP を自動付与する設定です。

ただし、これだけでは public subnet にはなりません。

本当に public subnet として機能するには、route table が Internet Gateway を向いている必要があります。

## Internet Gateway

Internet Gateway は、VPC と internet をつなぐ出口です。

```hcl
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}
```

これを VPC に attach しただけでは、まだ subnet から internet へ出られません。

route table 側で `0.0.0.0/0` を Internet Gateway に向ける必要があります。

## public route table

public subnet 用 route table では、default route を Internet Gateway に向けています。

```hcl
route {
  cidr_block = "0.0.0.0/0"
  gateway_id = aws_internet_gateway.main.id
}
```

意味:

```text
VPC 内の宛先ではない通信は Internet Gateway に流す
```

public subnet と route table は association で紐づけます。

```hcl
resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public.id
}
```

route table を作るだけでは subnet には適用されません。

association が必要です。

## private route table

private subnet 用 route table も作成しています。

最初は local route だけでよいですが、ECS task が ECR から image を pull するため、最終的に NAT Gateway への route を追加しました。

```hcl
resource "aws_route" "private_to_nat" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}
```

意味:

```text
private subnet から internet へ出る通信は NAT Gateway に流す
```

ただし、外部から private subnet に直接入れるわけではありません。

## NAT Gateway

NAT Gateway は public subnet に配置します。

```hcl
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_1a.id
}
```

private subnet に置くのではありません。

private subnet の task が ECR から image を pull したり、外部 API に出たりするために使います。

今回の学習では、ECS task が private subnet から ECR に接続できず、NAT Gateway が必要だと分かりました。

注意:

NAT Gateway は課金されやすいリソースです。学習で使わない時間が長い場合は、削除や `terraform destroy` を検討します。

## Security Group

今回の security group は 2 つです。

```text
ALB SG
backend SG
```

ALB SG は internet から HTTP / HTTPS を受けます。

```text
0.0.0.0/0 -> ALB SG : 80
0.0.0.0/0 -> ALB SG : 443
```

backend SG は ALB SG からの 8000 番だけを受けます。

```text
ALB SG -> backend SG : 8000
```

Terraform では次のように書きます。

```hcl
referenced_security_group_id = aws_security_group.alb.id
```

これは `0.0.0.0/0` から backend port を開けるのではなく、ALB の security group から来た通信だけを許可するという意味です。

## 理解するべきポイント

- subnet が public / private になるかは route table で決まる
- public subnet は `0.0.0.0/0 -> Internet Gateway` を持つ
- private subnet は Internet Gateway を直接向けない
- private subnet から外へ出るには NAT Gateway または VPC endpoint が必要
- NAT Gateway は public subnet に置く
- backend への inbound は ALB SG からだけ許可する
