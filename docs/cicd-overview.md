# CI/CD の到達点まとめ

このドキュメントでは、このプロジェクトで GitHub Actions を使って実現した CI/CD の到達点を整理します。

## 目的

この学習では、手動デプロイしていた backend / frontend を、`git push` を起点に自動反映できる状態にすることを目的にしました。

## 現在の構成

### backend

- backend コードは Docker image として build する
- image は ECR に push する
- ECS task definition に新しい image を反映する
- ECS service を更新する
- backend は ALB 経由で公開する

### frontend

- frontend は Vite で production build する
- build 結果を S3 に sync する
- CloudFront invalidation を実行する
- frontend は CloudFront 経由で公開する

## GitHub Actions で自動化した内容

### backend workflow

workflow:

- [deploy-backend.yml](/Users/dai/code/task-management-app/.github/workflows/deploy-backend.yml:1)

役割:

1. backend の変更を検知する
2. GitHub Actions から OIDC で AWS role を assume する
3. backend image を build する
4. ECR に push する
5. task definition に新しい image URI を差し込む
6. ECS service を更新する

### frontend workflow

workflow:

- [deploy-frontend.yml](/Users/dai/code/task-management-app/.github/workflows/deploy-frontend.yml:1)

役割:

1. frontend の変更を検知する
2. Node.js 環境をセットアップする
3. frontend を build する
4. build 結果を S3 に sync する
5. CloudFront invalidation を実行する

## これにより何ができるか

現在は、`main` branch に push すると次の動きができます。

### backend の変更時

```text
push
  -> GitHub Actions
  -> ECR に新しい image を push
  -> ECS が新しい task に置き換わる
  -> ALB 経由で新しい backend が使われる
```

### frontend の変更時

```text
push
  -> GitHub Actions
  -> Vite build
  -> S3 更新
  -> CloudFront invalidation
  -> CloudFront 経由で新しい frontend が見える
```

## この段階で理解できていること

1. backend と frontend では deploy の仕方が違う
2. backend は image ベースで更新する
3. frontend は静的ファイルベースで更新する
4. GitHub Actions を使うと push を起点に自動化できる
5. OIDC を使うと長期鍵なしで AWS にアクセスできる

## まだ学習として残っていること

GitHub Actions による自動デプロイはできていますが、学習フロー全体ではまだ次のテーマが残っています。

### 1. CodePipeline

今は GitHub Actions で自動化していますが、AWS ネイティブなパイプラインである CodePipeline も学ぶ必要があります。

ここで理解したいこと:

- Source / Build / Deploy の分離
- AWS 内でパイプラインを構成する考え方
- GitHub Actions との役割の違い

補足:

次に進むときは、まず backend を題材に CodePipeline を試すのが分かりやすいです。

- backend はすでに `ECR -> ECS -> ALB` ができている
- そのため、CodePipeline では `Source -> Build -> Deploy` の流れだけに集中しやすい
- frontend の `S3 + CloudFront` よりも、deploy 戦略の違いを見やすい

### 2. デプロイ戦略

次は次の違いを整理するとよいです。

- Rolling update
- Blue/Green deploy

### 3. Terraform

最後に、ここまで手で作ったものを Terraform でコード化する段階があります。

## 今の到達点の意味

この時点で、先生から示された学習の中で次まではかなり達成できています。

- アプリ作成
- Docker 化
- EC2 デプロイ
- ネットワーク理解
- ALB + private subnet 構成
- ECS 手動デプロイ
- frontend の S3 + CloudFront 配信
- GitHub Actions による自動デプロイ

つまり、次に進むべき本命は **CodePipeline とデプロイ戦略の理解** です。

## 次のステップ

おすすめの順番は次です。

1. GitHub Actions で何を自動化したかを自分の言葉で説明できるようにする
2. GitHub Actions と CodePipeline の違いを整理する
3. backend か frontend のどちらか一方を CodePipeline でも試す
4. Rolling update と Blue/Green deploy を比較する
5. その後 Terraform 化に進む

関連ドキュメント:

- [CodePipeline の考え方と次の学習テーマ](/Users/dai/code/task-management-app/docs/codepipeline-overview.md:1)
- [rolling update の学習手順](/Users/dai/code/task-management-app/docs/rolling-update-learning.md:1)
