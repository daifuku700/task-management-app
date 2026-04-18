# EC2 デプロイ手順

このドキュメントでは、このアプリを AWS 上の専用 VPC に配置し、EC2 上で Docker Compose を使って起動するまでの流れをまとめます。

## 想定構成

- VPC: 1つ
- Public Subnet: 1つ
- Internet Gateway: 1つ
- Public Route Table: 1つ
- EC2: 1台
- Security Group: 1つ

最初の学習段階では、この最小構成で十分です。

## 1. VPC を作成する

以下の設定で VPC を作成します。

- Name: `task-app-vpc`
- IPv4 CIDR: `10.0.0.0/16`

この VPC が、このプロジェクト専用の仮想ネットワークになります。

## 2. Public Subnet を作成する

VPC の中に subnet を作成します。

- Name: `task-app-public-subnet-1a`
- Availability Zone: 例 `ap-northeast-1a`
- IPv4 CIDR: `10.0.1.0/24`

作成後、subnet の設定で `auto-assign public IPv4 address` を有効にしてください。

これを有効にしないと、EC2 に public IP が付きません。

## 3. Internet Gateway を作成して VPC に接続する

Internet Gateway を作成します。

- Name: `task-app-igw`

作成後、`task-app-vpc` にアタッチします。

Internet Gateway は、VPC をインターネットへ接続するための出口です。

## 4. Public Route Table を作成する

Route Table を作成します。

- Name: `task-app-public-rt`
- VPC: `task-app-vpc`

次の route を追加します。

- Destination: `0.0.0.0/0`
- Target: `task-app-igw`

その後、この route table を `task-app-public-subnet-1a` に関連付けます。

これで public subnet からインターネットに出られるようになります。

## 5. Security Group を作成する

`task-app-vpc` の中に Security Group を作成します。

推奨の inbound rule は次の通りです。

- SSH `22`: 自分のグローバル IP のみ
- Frontend `5173`: 自分のグローバル IP のみ
- Backend `8000`: 自分のグローバル IP のみ

outbound rule はデフォルトのままで問題ありません。

この段階では、学習のために必要なポートだけを最小限開ける方針にします。

## 6. EC2 インスタンスを作成する

以下のような設定で EC2 を起動します。

- Name: `task-app-ec2`
- AMI: `Amazon Linux 2023`
- Instance type: `t3.micro` または `t2.micro`
- Key pair: 新規作成または既存のものを利用
- VPC: `task-app-vpc`
- Subnet: `task-app-public-subnet-1a`
- Auto-assign public IP: 有効
- Security Group: 作成したものを指定

起動後、Public IPv4 address を控えておいてください。

## 7. EC2 に接続する

ローカル端末で次を実行します。

```bash
chmod 400 ~/path/to/your-key.pem
ssh -i ~/path/to/your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

Amazon Linux 2023 の標準ユーザーは `ec2-user` です。

## 8. Docker をインストールする

EC2 上で次を実行します。

```bash
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user
```

`docker` グループを反映するため、一度 SSH を切断して再接続してください。

確認:

```bash
docker info
docker compose version
```

## 9. リポジトリを配置する

方法は 2 通りあります。

### GitHub から clone する場合

```bash
sudo yum install -y git
git clone <YOUR_REPO_URL>
cd task-management-app
```

### ローカルからコピーする場合

```bash
scp -i ~/path/to/your-key.pem -r /Users/dai/code/task-management-app ec2-user@<EC2_PUBLIC_IP>:~/
```

その後:

```bash
cd ~/task-management-app
```

## 10. EC2 向けに frontend と backend を設定する

frontend はブラウザ上で動くので、`VITE_API_BASE_URL` には **ブラウザから到達できる URL** を設定する必要があります。

EC2 用の例:

```yaml
services:
  frontend:
    environment:
      VITE_API_BASE_URL: http://<EC2_PUBLIC_IP>:8000
```

backend は CORS で frontend の origin を許可する必要があります。

EC2 用の例:

```yaml
services:
  backend:
    environment:
      FRONTEND_ORIGINS: http://<EC2_PUBLIC_IP>:5173
```

ローカルと EC2 の両方を許可したい場合:

```yaml
services:
  backend:
    environment:
      FRONTEND_ORIGINS: http://localhost:5173,http://<EC2_PUBLIC_IP>:5173
```

## 11. アプリを起動する

リポジトリ直下で次を実行します。

```bash
docker compose up -d --build
```

確認に使うコマンド:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

## 12. 動作確認する

ブラウザで次にアクセスします。

- Frontend: `http://<EC2_PUBLIC_IP>:5173`
- Backend: `http://<EC2_PUBLIC_IP>:8000/tasks`

frontend は開くのに API 通信だけ失敗する場合は、次を確認してください。

1. `VITE_API_BASE_URL` が `http://<EC2_PUBLIC_IP>:8000` になっている
2. `FRONTEND_ORIGINS` に `http://<EC2_PUBLIC_IP>:5173` が含まれている
3. Security Group で `8000` が自分の IP から許可されている
4. `docker compose logs -f backend` にリクエストが届いている

## 現時点の制限

- frontend はまだ Vite の開発サーバーを使っている
- backend は `8000` を直接公開している
- task データはメモリ保存なので永続化されない

これは今の学習段階では問題ありません。今後は frontend の production build、reverse proxy、永続化ストレージなどに進めばよいです。
