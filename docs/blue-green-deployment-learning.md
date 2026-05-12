# blue/green deploy の学習手順

このドキュメントでは、ECS の rolling update まで確認できた状態から、次に **blue/green deploy** を学ぶための手順を整理します。

## 目的

blue/green deploy の目的は、古い環境と新しい環境を並べて用意し、ALB の traffic を新しい環境へ切り替える流れを理解することです。

rolling update では ECS service が task を少しずつ置き換えました。blue/green では、CodeDeploy が新しい task set を作り、target group と listener を使って traffic を切り替えます。

## rolling update との違い

### rolling update

```text
ECS service
  -> old task を少しずつ new task に置き換える
```

特徴:

- ECS service の standard deployment
- 構成が比較的単純
- target group は基本的に 1 つで進められる
- task が順番に入れ替わる

### blue/green deploy

```text
CodeDeploy
  -> green task set を作る
  -> test listener で確認する
  -> production listener を green 側へ切り替える
  -> blue task set を終了する
```

特徴:

- CodeDeploy が traffic shifting を制御する
- target group が 2 つ必要
- production listener が必要
- test listener は任意
- rollback しやすい

## blue/green で増えるもの

rolling update と比べて、主に次が増えます。

- CodeDeploy application
- CodeDeploy deployment group
- 2 つ目の target group
- production listener
- test listener
- AppSpec file

AWS 公式でも、ECS の CodeDeploy deployment には ECS cluster / service、load balancer、production listener、任意の test listener、2 つの target group、task definition、container name、container port が必要とされています。

参考:

- https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-steps-ecs.html
- https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups-create-load-balancer-for-ecs.html
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-bluegreen.html

## 全体像

最終的な流れは次です。

```text
CodePipeline
  -> Source
  -> Build
  -> CodeDeploy
  -> ECS blue/green deployment
```

traffic の流れは次です。

```text
User
  -> ALB production listener
  -> blue target group
  -> old task set

Deployment starts

CodeDeploy
  -> green target group
  -> new task set

After validation

User
  -> ALB production listener
  -> green target group
  -> new task set
```

## Step 1: target group を 2 つ用意する

blue/green では target group が 2 つ必要です。

既存の ECS service で使っている target group を 1 つ目として使い、もう 1 つを追加します。

例:

- `task-app-backend-blue-tg`
- `task-app-backend-green-tg`

設定の考え方:

- target type: `IP`
- protocol: `HTTP`
- port: `8000`
- health check path: `/tasks`
- VPC: 既存の ECS service と同じ VPC

重要なのは、2 つの target group が同じ backend container port に向くことです。

## Step 2: listener を確認する

blue/green では production listener が必須です。

今の backend API は HTTPS 化済みなので、通常は次を production listener として使います。

- `HTTPS:443`

test listener は任意です。学習として green 側を先に確認したい場合は、追加で作ります。

例:

- `HTTP:8080`

ただし、最初は test listener なしでも blue/green の全体像は学べます。test listener を使うと理解対象が増えるため、最初は production listener だけで進めても構いません。

## Step 3: ECS service の deployment type を確認する

blue/green を使う ECS service は、deployment controller が `CodeDeploy` である必要があります。

重要:

既存の rolling update 用 service をそのまま blue/green に切り替えられない場合があります。その場合は、blue/green 学習用に新しい ECS service を作る方が分かりやすいです。

おすすめ:

- 既存 service は rolling update 用として残す
- blue/green 学習用に別 service を作る

例:

- rolling update 用: `task-app-backend-service`
- blue/green 用: `task-app-backend-bg-service`

この方が壊したときの切り戻しが簡単です。

## Step 4: CodeDeploy application を作る

AWS コンソールで:

1. `CodeDeploy`
2. `Applications`
3. `Create application`

設定:

- Application name: `task-app-backend-codedeploy`
- Compute platform: `Amazon ECS`

CodeDeploy application は、blue/green deploy の管理単位です。

## Step 5: CodeDeploy deployment group を作る

次に deployment group を作ります。

指定する主なもの:

- ECS cluster
- ECS service
- ALB
- production listener
- optional test listener
- 2 つの target group
- deployment configuration
- rollback 設定

最初の学習では、deployment configuration は `CodeDeployDefault.ECSAllAtOnce` が分かりやすいです。

理由:

- traffic が一度に切り替わる
- 挙動を観察しやすい
- canary / linear より複雑さが少ない

慣れてから、canary や linear に進むとよいです。

## Step 6: AppSpec file を用意する

blue/green deploy では AppSpec file が必要です。

AppSpec file は、CodeDeploy に次を伝えます。

- 新しい task definition
- container name
- container port

例:

```yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: <TASK_DEFINITION_ARN>
        LoadBalancerInfo:
          ContainerName: backend
          ContainerPort: 8000
```

CodePipeline と組み合わせる場合、Build stage で task definition と AppSpec を artifact として出力し、Deploy stage の CodeDeploy action に渡します。

## Step 7: CodePipeline の Deploy stage を変える

rolling update では Deploy provider に `Amazon ECS` を使いました。

blue/green では Deploy provider に `AWS CodeDeploy` を使います。

つまり:

- rolling update: `Amazon ECS`
- blue/green: `AWS CodeDeploy`

Deploy stage で指定するもの:

- CodeDeploy application
- CodeDeploy deployment group
- task definition artifact
- AppSpec artifact

ここが rolling update との大きな違いです。

## Step 8: deploy を実行して観察する

deploy を流したら、次を見ます。

### CodePipeline

- Source が成功するか
- Build が成功するか
- CodeDeploy action が成功するか

### CodeDeploy

- deployment が作られるか
- replacement task set が作られるか
- traffic shifting が進むか
- rollback 設定が効くか

### ECS

- old task set と new task set が見えるか
- green 側 task が healthy になるか

### ALB

- production listener の向き先が切り替わるか
- target group の healthy target が切り替わるか

## まず何を成功とするか

最初の成功条件は次です。

1. CodeDeploy application / deployment group を作れる
2. target group を 2 つ使う理由を説明できる
3. production listener がどちらの target group に向いているか確認できる
4. deployment 後に traffic が新しい task set へ切り替わることを確認できる

## よくある詰まりどころ

### target group が 1 つしかない

blue/green では 2 つ必要です。

### target group は手動登録しなくてよい

ECS service と target group を関連付けると、ECS が起動した task の private IP を target group に自動登録します。

そのため、target group 作成時に `Targets` を手動登録しなくて構いません。Fargate の task は起動のたびに IP が変わるため、手動登録する運用には向いていません。

### ECS service が CodeDeploy deployment controller ではない

rolling update 用 service のままだと blue/green に進めない場合があります。学習用に別 service を作る方が安全です。

### target group が選択できない

ECS service 作成画面で target group がグレーアウトする場合、その target group が ALB の listener に関連付いていないことがあります。

blue/green で使う target group は、ALB に関連付いている必要があります。学習用には、次のように listener を用意すると分かりやすいです。

- production listener: `HTTPS:443`
- test listener: `HTTP:8080`
- blue target group: production 側の初期向き先
- green target group: test 側の初期向き先

本番用途では HTTP の test listener を公開し続ける必要はありません。学習後は削除対象として扱います。

### production listener rule が 2 つの target group を向いている

次のような rollback エラーが出ることがあります。

```text
productionListenerRule ... should have exactly one target group serving traffic but found 2 target groups
```

原因は、production listener rule が weighted forward などで 2 つの target group に同時に traffic を流していることです。

CodeDeploy の blue/green では、deployment 開始前の production listener rule は **ちょうど 1 つの target group** だけを向いている必要があります。

修正方針:

- `HTTPS:443` の default rule は `blue target group` に `100%` forward する
- `green target group` は production listener から外す
- test listener を使う場合は、`HTTP:8080` などを `green target group` に向ける

traffic の切り替えは CodeDeploy に任せます。手動で production listener に blue / green の両方を入れると、CodeDeploy が前提条件エラーとして止めます。

### AppSpec の container name / port が違う

`backend` / `8000` が task definition と一致している必要があります。

### health check が通らない

green 側 task が healthy にならないと traffic は切り替えられません。

今回の構成では、target group 側で次のような状態になりました。

```text
Unhealthy
Request timed out
```

これは多くの場合、ALB から ECS task への通信が security group で許可されていないことを意味します。

確認すること:

- ECS task の security group inbound に `TCP 8000` がある
- source は `0.0.0.0/0` ではなく ALB の security group にする
- target group の health check path が backend で成功する path になっている
- backend container が `0.0.0.0:8000` で listen している

修正後、target group で古い target が `Draining`、新しい target が `Healthy` になれば、ECS が task を入れ替えて ALB に正しく登録できています。

### private subnet の ECS task が ECR に接続できない

rolling update の段階で、次のようなエラーが出ました。

```text
ResourceInitializationError: unable to pull secrets or registry auth
There is a connection issue between the task and Amazon ECR
```

private subnet に置いた ECS task は、そのままだと internet に出られません。ECR から image を pull するには、次のどちらかが必要です。

- public subnet に NAT Gateway を置き、private subnet の route table から `0.0.0.0/0` を NAT Gateway に向ける
- VPC endpoint を使って ECR / S3 へ private に接続する

今回の学習では NAT Gateway を追加して解決しました。

### CodeDeploy console にアクセスできない

CodeDeploy にアクセスしたとき、次のような account setup 画面が表示されることがあります。

```text
Complete your account setup
your account is currently on free plan
```

これは ECS / ALB / target group の設定ミスではなく、AWS account plan 側の制限です。

この状態でも、ALB listener が green target group を向き、API が叩けるなら、次の部分は確認できています。

- ECS service が task を起動できる
- target group に task が登録される
- health check が通る
- ALB listener から backend API に到達できる

ただし、CodeDeploy による blue/green deployment の完全な確認はできていません。paid plan に進まない場合は、ここを今回の到達点として記録し、次は Terraform 化へ進むのが現実的です。

## 今回の到達点

今回の学習では、CodeDeploy による完全な blue/green deployment までは進めず、AWS account plan の制限で停止しました。

一方で、blue/green を理解する上で重要な構成要素はかなり確認できています。

- blue / green 用 target group を作成した
- ECS service 作成時に target group を手動登録しない理由を確認した
- production listener と test listener の役割を確認した
- production listener rule は 1 つの target group だけを向く必要があることを確認した
- ALB から ECS task への health check 失敗を security group 観点で切り分けた
- target group の `Unhealthy` / `Draining` / `Healthy` の意味を確認した
- ALB listener が green target group を向いた状態で API 疎通を確認した
- CodeDeploy の利用は account plan 制限により未完了として扱うことにした

今回の結論:

CodeDeploy の managed blue/green deploy は paid plan に進まない限り検証しない。ここでは ECS / ALB / target group / listener の仕組み理解を到達点とし、次は Terraform でこれまで作った構成をコード化する。

## 学習後に削除してよいリソース

paid plan に進まず、CodeDeploy blue/green をここで止めるなら、追加で作った検証用リソースは削除候補です。

削除候補:

- `task-app-backend-bg-service`
- `task-app-backend-bg-blue-tg`
- `task-app-backend-bg-green-tg`
- `HTTP:8080` の test listener
- CodeDeploy 用 IAM role
- CodeDeploy application / deployment group を作っていればそれら

残す候補:

- `task-app-backend-service`
- `task-app-backend-ecs-tg`
- `task-app-alb`
- `HTTPS:443` listener
- ECS cluster
- ECR repository
- VPC / subnet / route table / security group
- NAT Gateway
- frontend 用 S3 bucket / CloudFront

注意:

NAT Gateway、ALB、ECS Fargate は課金されやすいリソースです。学習を止める時間が長い場合は、ECS service の desired count を 0 にする、不要な NAT Gateway を削除するなど、コストを意識して整理します。

## 次にやるべきこと

paid plan に進まない前提では、次は CodeDeploy の続きを進めるのではなく、Terraform 化に進みます。

理由:

1. VPC / subnet / route table / security group は既に手で作成して理解している
2. ALB / ECS / ECR / S3 / CloudFront も手で作成して動作確認している
3. CodeDeploy blue/green は account plan 制限で止まっている
4. 次に学ぶ価値が高いのは、手順を再現可能なコードに変えること

Terraform 化では、まず既存リソースをすべて一気に書くのではなく、network から小さく始めます。

おすすめの順番:

1. Terraform の基本構成を作る
2. VPC / subnet / route table を Terraform で書く
3. security group を Terraform で書く
4. ALB / listener / target group を Terraform で書く
5. ECR / ECS を Terraform で書く
6. S3 / CloudFront を Terraform で書く
7. 最後に IAM role / policy を整理する
