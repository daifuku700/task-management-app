# rolling update の学習手順

このドキュメントでは、CodePipeline を学ぶ最初のテーマとして、backend を対象に **rolling update** を理解する手順を整理します。

## 目的

今回の目的は、CodePipeline を使って backend の deploy を流し、その結果として **ECS service が rolling update されること** を理解することです。

ここでは、いきなり blue/green には進みません。

このプロジェクトでは、CodeBuild で backend image を build し、ECS standard deployment を使って rolling update を観察する形で進めています。

## まず押さえること

rolling update では、ECS service が古い task を少しずつ新しい task に置き換えます。

イメージ:

```text
old task old task
  -> new task old task
  -> new task new task
```

つまり:

- 新しい task definition を登録する
- ECS service がそれを使う
- 稼働中 task を段階的に入れ替える

という流れです。

## なぜ最初に rolling update を学ぶのか

理由はシンプルです。

- すでに backend の ECS service がある
- ECS standard deployment は構成が比較的単純
- CodePipeline の Source / Build / Deploy を理解するのに十分
- blue/green より登場人物が少ない

## 前提条件

次の状態ができている前提で進めます。

- backend が ECR / ECS / ALB で公開できている
- ECS service が安定稼働している
- task definition の意味が分かる
- ECR repository がある
- GitHub Actions で backend deploy が一度成功している

加えて、CodePipeline 側で build / deploy の流れが作れている前提です。

## 学習のゴール

次の状態になれば十分です。

1. CodePipeline の Source / Build / Deploy が何をしているか説明できる
2. Build 結果として新しい image が ECR に push される
3. Deploy 結果として ECS service が更新される
4. その更新が rolling update として進むことを理解できる

## 学習の進め方

おすすめは次の順番です。

### 1. まず CodePipeline 全体像を理解する

最初に、CodePipeline は次の 3 つをつなぐものだと理解します。

- Source
- Build
- Deploy

ここで大事なのは、CodePipeline 自体が build をしているわけではないことです。

- Source stage は入力を受け取る
- Build stage は主に CodeBuild が実行する
- Deploy stage は ECS や CodeDeploy などへつなぐ

### 2. backend を題材に Source を決める

最初は backend だけを対象にします。

Source は主に 2 パターン考えられます。

- GitHub source
- ECR source

学習としては、まず **GitHub source** の方が流れを追いやすいです。

理由:

- 「コード変更が source になる」ことが分かりやすい
- GitHub Actions と比較しやすい
- Source / Build / Deploy の分離を理解しやすい

### 3. Build で何をするかを明確にする

backend の Build stage では、実質的に次を行います。

- backend image を build する
- ECR に push する

このプロジェクトでは、Docker Hub の rate limit を避けるため、backend Dockerfile を `ghcr.io/astral-sh/uv:python3.12-trixie-slim` ベースにしています。

つまり、GitHub Actions の backend workflow で今やっていることのうち、

- checkout
- aws login
- docker buildx build
- ecr push

に近い部分を CodeBuild 側へ移すイメージです。

### 4. Deploy で何をするかを明確にする

Deploy stage では、ECS service を更新します。

その結果として、ECS service が rolling update を実行します。

ここでの理解ポイント:

- CodePipeline は「更新を流す」側
- 実際に rolling update するのは ECS service 側

### 5. まずは backend だけの最小 pipeline を作る

最初の pipeline はシンプルで十分です。

```text
Source
  -> Build
  -> Deploy
```

この段階では、frontend は触らなくて構いません。

### 6. buildspec と Dockerfile の役割を分ける

この学習では、`buildspec-backend.yml` が build の手順を、`backend/dockerfile` が image の中身を担当します。

- buildspec
  - CodeBuild が何を実行するか
- Dockerfile
  - backend image をどう作るか

この分離を意識すると、Build stage の失敗原因を切り分けやすくなります。

## rolling update を観察するときに見る場所

pipeline を動かしたら、次を確認します。

### CodePipeline

- Source が成功したか
- Build が成功したか
- Deploy が成功したか

### CodeBuild

- image build が通ったか
- ECR push が通ったか

### ECR

- 新しい image tag が増えたか

### ECS

- service に新しい deployment ができたか
- task が古いものから新しいものへ切り替わっているか

### ALB

- `/tasks` が引き続き見えるか

## rolling update で注目すべき点

ECS service の deploy を見るときは、次を意識します。

- 新旧 task が一時的に共存すること
- old task が急に全部落ちるわけではないこと
- service の desired count を保ちながら入れ替えること

ここが blue/green との最初の違いです。

## ここではまだやらなくてよいこと

次はまだ後回しで構いません。

- CodeDeploy application
- CodeDeploy deployment group
- AppSpec file
- test listener
- canary / linear traffic shifting

今の段階では、rolling update の仕組みを観察できれば十分です。

これらは blue/green の段階で学びます。

## この段階で自分に確認したいこと

次の質問に自分で答えられると理解しやすいです。

1. CodePipeline は何を管理するサービスか
2. CodeBuild は何を担当するか
3. Deploy stage で rolling update するのは誰か
4. GitHub Actions の backend workflow と何が似ていて何が違うか

## 次にやるべきこと

このドキュメントの次は、実際に backend 用 CodePipeline を作ることです。

そのときの最小目標は:

1. Source stage を作る
2. CodeBuild project を作る
3. ECS service を Deploy stage につなぐ
4. backend の新しい deploy が rolling update されるのを確認する

その後、blue/green deploy を学ぶと理解しやすくなります。

その後に、blue/green deploy を学ぶと理解しやすくなります。
