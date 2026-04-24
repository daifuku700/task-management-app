# CodePipeline の考え方と次の学習テーマ

このドキュメントでは、GitHub Actions まで完了した今、次に CodePipeline で何を学ぶべきかを整理します。

## 現在の到達点

このプロジェクトでは、すでに次ができています。

- backend を ECR / ECS / ALB 構成で公開する
- frontend を S3 + CloudFront で公開する
- GitHub Actions から backend / frontend を自動デプロイする

つまり、実用的な CI/CD 自体はすでに一度作れています。

次の学習テーマは、GitHub Actions を置き換えることではなく、**AWS ネイティブなパイプラインの考え方を理解すること**です。

## GitHub Actions と CodePipeline の違い

### GitHub Actions

GitHub Actions は GitHub のイベントを起点に動きます。

```text
push
  -> workflow
  -> build
  -> deploy
```

特徴:

- repository に YAML を置く
- push や pull request を起点にしやすい
- 開発者が細かい step のログを追いやすい
- repo ごとの自動化に向いている

### CodePipeline

CodePipeline は AWS 上で release の流れを stage として管理します。

```text
Source
  -> Build
  -> Deploy
```

特徴:

- AWS 上に pipeline を作る
- Source / Build / Deploy を明確に分けやすい
- CodeBuild や CodeDeploy などの AWS サービスとつなぎやすい
- release の流れ全体を AWS 側で見やすい

## CodePipeline の中での各サービスの役割

### CodePipeline

全体の流れを管理する司令塔です。

例:

- Source stage
- Build stage
- Deploy stage

### CodeBuild

build を実行する担当です。

たとえば backend なら:

- Docker image を build
- ECR に push

frontend なら:

- `npm ci`
- `npm run build`

を担当できます。

### CodeDeploy

deploy の進め方を高度に制御する担当です。

特に ECS の **blue/green deployment** で重要になります。

## 先に理解すべき deploy 戦略

### rolling update

既存 task を少しずつ新しい task に置き換えるやり方です。

特徴:

- 構成が比較的単純
- 最初に学びやすい
- ECS standard deployment と相性がよい

### blue/green deploy

新旧 2 つの環境を並べて作り、ALB のトラフィックを切り替えるやり方です。

特徴:

- 安全性が高い
- rollback しやすい
- ALB, target group, CodeDeploy, AppSpec など理解対象が増える

## なぜ次は rolling update なのか

今のあなたにとって、次は rolling update から始めるのが自然です。

理由:

- すでに ECS service が動いている
- backend は `ECR -> ECS -> ALB` の流れを理解できている
- CodePipeline の Source / Build / Deploy を理解するには十分
- blue/green より構成が少ない

## 次に作るとよいもの

まずは backend を対象に、CodePipeline で次の流れを作るのがおすすめです。

```text
Source
  -> Build
  -> Deploy
```

具体的には:

1. Source
   GitHub か ECR を起点にする
2. Build
   CodeBuild で backend image を build して ECR に push する
3. Deploy
   ECS service を更新する

## 学習として何を確認できればよいか

次の 4 つが説明できれば、CodePipeline の第一段階は十分です。

1. CodePipeline は stage をつないで release flow を作る
2. CodeBuild は build 実行担当である
3. ECS standard deployment は rolling update で進む
4. blue/green をやるなら CodeDeploy が関わる

## 次のドキュメント

実際の学習手順は次を参照してください。

- [rolling update の学習手順](/Users/dai/code/task-management-app/docs/rolling-update-learning.md:1)
