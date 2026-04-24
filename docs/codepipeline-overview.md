# CodePipeline の考え方と次の学習テーマ

このドキュメントでは、GitHub Actions まで完了した今、次に CodePipeline で何を学ぶべきかを整理します。

## 現在の到達点

このプロジェクトでは、すでに次ができています。

- backend を ECR / ECS / ALB 構成で公開する
- frontend を S3 + CloudFront で公開する
- GitHub Actions から backend / frontend を自動デプロイする

つまり、実用的な CI/CD 自体はすでに一度作れています。

次の学習テーマは、GitHub Actions を置き換えることではなく、**AWS ネイティブなパイプラインの考え方を理解すること**です。

このプロジェクトでは、backend を題材に CodePipeline を作り、CodeBuild で image を build して ECS service を更新するところまで進めました。最初の目標は rolling update を観察することです。

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

## 今回の backend pipeline の実装方針

このプロジェクトでは、次の構成で学習を進めています。

- Source stage
  GitHub repository の `main` branch を使う
- Build stage
  CodeBuild で `buildspec-backend.yml` を実行し、backend image を build して ECR に push する
- Deploy stage
  ECS standard deployment を使い、`imagedefinitions.json` を元に ECS service を更新する

### 実装で詰まった点と解決

- CodeBuild project の console で `CodePipeline` source / artifact を直接選べないケースがあった
- そのため、CodePipeline 側から Build stage を作る方針に切り替えた
- Docker Hub の `python:3.12-slim` が rate limit にかかったため、backend Dockerfile を `ghcr.io/astral-sh/uv:python3.12-trixie-slim` ベースに寄せた
- これにより CodeBuild でも backend image を安定して build できた

## 学習として何を確認できればよいか

次の 4 つが説明できれば、CodePipeline の第一段階は十分です。

1. CodePipeline は stage をつないで release flow を作る
2. CodeBuild は build 実行担当である
3. ECS standard deployment は rolling update で進む
4. blue/green をやるなら CodeDeploy が関わる

実際の学習では、CodeBuild role を先に作り、CodePipeline role は pipeline 作成時に自動作成させる形が分かりやすかった。

## 次のドキュメント

実際の学習手順は次を参照してください。

- [rolling update の学習手順](/Users/dai/code/task-management-app/docs/rolling-update-learning.md:1)
