# タスク管理アプリ学習ガイド

## 目的

タスク管理アプリを題材にして、アプリ開発からインフラ構築、デプロイ、自動化、IaC までを段階的に学ぶ。

この学習では、単にアプリを動かすだけでなく、次の観点を順番に理解していく。

- frontend と backend の役割
- Docker で実行環境をそろえる考え方
- EC2 上でアプリを動かす流れ
- AWS ネットワークの基本
- ALB / ECS / ECR を使ったコンテナ運用
- S3 + CloudFront による frontend 配信
- GitHub Actions / CodePipeline による自動デプロイ
- Terraform によるコード化

## 想定するアプリ

### 機能

- list
- create
- update
- delete

### frontend

- React
- TypeScript

### backend

- Python
- FastAPI

注記:

重要なのは、Python の backend API を作り、frontend から呼べること。

---

## 全体の流れ

1. タスク管理アプリを作る
2. Docker で動かす
3. EC2 にデプロイする
4. AWS ネットワークを理解する
5. ALB + EC2 構成を理解する
6. ECS に手動デプロイする
7. frontend を S3 + CloudFront で配信する
8. 自動デプロイを入れる
9. Terraform 化する

---

## 1. タスク管理アプリを作る

まずはローカルで CRUD できる最小アプリを作る。

### やること

- React + TypeScript で画面を作る
- Python backend で API を作る
- list / create / update / delete を実装する
- frontend から backend API を呼ぶ
- まずはメモリ保存でよい

### この段階で理解すること

- frontend と backend は別プロセスで動くこと
- API 経由でデータをやり取りすること
- CORS が必要になることがあること

### 完了条件

- ローカルで frontend が開く
- task の CRUD が動く

---

## 2. Docker で動かす

次に、ローカル実行環境を Docker で再現できるようにする。

### やること

- frontend 用 Dockerfile を作る
- backend 用 Dockerfile を作る
- Compose で frontend / backend をまとめて起動する
- 環境変数を使って API URL を切り替えられるようにする

### この段階で理解すること

- Dockerfile はイメージを作る手順書であること
- Compose は複数コンテナをまとめて扱うための設定であること
- `ports`, `environment`, `volumes` の役割
- development 向け構成と deployment 向け構成の違い

### 完了条件

- `docker compose up --build` で frontend / backend が起動する
- Docker 上でも CRUD が動く

---

## 3. EC2 にデプロイする

Docker 化したアプリを EC2 上に載せて、手動でデプロイする。

### やること

- EC2 を起動する
- Docker をインストールする
- リポジトリを配置する
- `docker compose up -d --build` で起動する
- public IP 経由で疎通確認する

### この段階で理解すること

- ローカルで動く Docker アプリを、別の Linux マシン上でも再現できること
- frontend が参照する backend URL は、ブラウザから到達可能な URL である必要があること
- CORS の許可 origin は frontend の実際の origin に合わせる必要があること

### 完了条件

- EC2 上で frontend が開く
- backend API にアクセスできる
- frontend から backend への通信が成功する

---

## 4. AWS ネットワークを理解する

ここからは「動いた」だけでなく、「なぜその構成で通信できるのか」を理解する段階に入る。

### 学ぶ対象

- VPC
- Subnet
- Route Table
- Security Group

### ここで理解したいこと

- VPC は AWS 上の専用ネットワークであること
- subnet はその中の区画であること
- route table が通信経路を決めること
- security group が通信許可を決めること
- public subnet と private subnet の違い

### 次の構成に向けて意識すること

先生の想定フローでは、最終的に EC2 は private subnet 側へ置き、外部公開は ALB 側で受ける構成を理解する必要がある。

つまり、今の

- frontend: public IP + 5173
- backend: public IP + 8000

の構成は、あくまで学習途中の確認用である。

---

## 5. ALB + EC2 構成を理解する

次は、EC2 を直接外に出すのではなく、ALB を入口にする構成を理解する。

### やること

- public subnet に ALB を置く
- private subnet に EC2 を置く
- ALB から EC2 へ転送する
- security group を ALB と EC2 で分ける

### 学ぶ対象

- ALB
- EC2
- public subnet
- private subnet

### この段階で理解すること

- なぜアプリサーバーを private subnet に置くのか
- なぜ public に出すのは ALB だけにするのか
- ALB が入口、EC2 が実行環境、という役割分担

---

## 6. ECS に手動デプロイする

EC2 上で直接 Docker Compose を使うのではなく、AWS のコンテナ実行基盤へ進む。

### 学ぶ対象

- ECS
- ECS Cluster
- ECS Service
- ECS Task Definition
- ECR
- ALB

### やること

- Docker image を build する
- ECR に push する
- ECS Task Definition を作る
- ECS Cluster を作る
- ECS Service を作る
- ALB と ECS を接続する

### この段階で理解すること

- Compose で手動起動していたものを、AWS 管理のコンテナ実行基盤へ移す考え方
- image registry としての ECR の役割
- Task Definition がコンテナ実行定義であること
- Service が desired count を保つこと

---

## 7. frontend を S3 + CloudFront で配信する

frontend はコンテナで配るのではなく、静的ファイルとして配信する構成を学ぶ。

### 学ぶ対象

- S3
- CloudFront

### やること

- frontend を production build する
- build 結果を S3 に配置する
- CloudFront 経由で配信する

### この段階で理解すること

- frontend と backend で配信方法が異なること
- frontend は静的配信と相性がよいこと
- CloudFront による CDN 配信の基本

---

## 8. 自動デプロイを入れる

手動デプロイをやめて、push を起点に自動で反映される流れを作る。

### 学ぶ対象

- GitHub Actions
- CodePipeline
- Source
- Build
- Deploy
- Rolling Update
- Blue/Green Deploy

### やること

- GitHub Actions で build や test を回す
- ECR へ image を push する
- CodePipeline でデプロイを流す
- ECS の rolling update または blue/green deploy を理解する

### この段階で理解すること

- CI と CD の違い
- 手動作業をどこまで自動化するか
- 安全に更新する方法

---

## 9. Terraform 化する

最後に、ここまで手で作ってきた AWS リソースをコードで管理する。

### 学ぶ対象

- Terraform

### やること

- VPC
- Subnet
- Route Table
- Security Group
- ALB
- ECS
- ECR
- S3
- CloudFront

などをコード化する。

### この段階で理解すること

- インフラを手順書ではなくコードで管理する意味
- 再現性
- 差分管理
- レビュー可能なインフラ変更

---

## 現在地

このリポジトリは、現時点で概ね次まで到達している。

- 1. タスク管理アプリを作る
- 2. Docker で動かす
- 3. EC2 にデプロイする
- 4. AWS ネットワークを理解する
- 5. ALB + EC2 構成を理解する
- 6. ECS に手動デプロイする
- 7. frontend を S3 + CloudFront で配信する

加えて、VPC を自作して EC2 に配置するところまで学習が進んでいる。

さらに、ALB を public subnet、backend EC2 を private subnet に置き、`/tasks` を ALB 経由で確認するところまで到達している。

さらに、backend image を ECR に push し、ECS Service 経由で `http://<ALB_DNS>/tasks` を確認するところまで到達している。

さらに、frontend を S3 に配置し、CloudFront domain から表示するところまで到達している。

さらに、Cloudflare 管理ドメインと ACM を使って backend API を HTTPS 化し、CloudFront 配信の frontend から問題なく通信できるところまで到達している。

さらに、backend の GitHub Actions workflow を作成し、自動デプロイを進め始めている。

---

## 次にやるべきこと

次に進むべきなのは **8. 自動デプロイを入れる** です。

その前提として、次の状態ができていれば十分です。

- public subnet と private subnet の役割が説明できる
- ALB が private EC2 に転送できる理由が説明できる
- EC2 を直接公開しない構成の意味が説明できる
- browser 視点の URL と CORS の理解がある
- backend が `ECR -> ECS -> ALB` の流れで公開できている
- frontend が `build -> S3 -> CloudFront` の流れで配信できている

次の具体的なテーマは:

- **backend image build / push / ECS 更新を自動化すること**
- **frontend build / S3 反映 / CloudFront 反映を自動化すること**
- **GitHub Actions と CodePipeline の役割を理解すること**
- **rolling update と blue/green deploy の違いを理解すること**

です。
