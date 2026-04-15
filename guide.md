# モノレポで学ぶ アプリ + インフラ構築の手順

## 目的
React + TypeScript のフロント、FastAPI のバックエンドをモノレポで管理しながら、
ローカル開発 → Docker化 → EC2デプロイ → ECSデプロイ → CI/CD → Terraform化
の順で段階的に学ぶ。

---

## 全体の流れ

1. **アプリを最小構成で作る**
2. **モノレポ構成に整理する**
3. **Docker でローカル実行する**
4. **EC2 に手動デプロイする**
5. **AWS ネットワークを理解する**
6. **ECS に手動デプロイする**
7. **フロントを S3 + CloudFront 配信にする**
8. **GitHub Actions / CodePipeline で自動デプロイする**
9. **Terraform でコード化する**

---

## 1. アプリを最小構成で作る

まずはインフラに入る前に、CRUD ができる最小のタスク管理アプリを作る。

### フロント
- React
- TypeScript

### バックエンド
- Python
- FastAPI

### 機能
- list
- create
- update
- delete

### ここでやること
- フロントから API を呼ぶ
- FastAPI で CRUD API を作る
- 一旦はメモリ保存や簡単な JSON 保存でよい
- まずはローカルで動く状態を作る

---

## 2. モノレポ構成に整理する

アプリとインフラを 1 リポジトリで管理する。

### 例
```txt
repo/
  frontend/
  backend/
  infra/
  .github/
  README.md
