# Docker の仕組み

このドキュメントでは、このプロジェクトで使っている Docker と Docker Compose の考え方を整理します。

## Docker を使う理由

Docker を使うと、アプリの実行環境をコンテナとしてまとめられます。

このプロジェクトでは次の利点があります。

- ローカル環境差分を減らせる
- EC2 でも同じ構成を再現しやすい
- frontend と backend をまとめて起動できる

## Dockerfile の役割

Dockerfile は、イメージを作るための手順書です。

たとえば backend の Dockerfile では、次のようなことを定義します。

- base image
- 作業ディレクトリ
- 依存関係のインストール
- ソースコードのコピー
- 起動コマンド

`WORKDIR /app` は、以降の命令を `/app` を作業ディレクトリとして実行する、という意味です。

## Compose の役割

`compose.yml` は、複数コンテナをまとめて起動するための設定ファイルです。

このプロジェクトでは次の 2 サービスがあります。

- `frontend`
- `backend`

Compose を使うことで:

- まとめて build できる
- まとめて起動できる
- port, environment, volume を一元管理できる

## ports の意味

例:

```yaml
ports:
  - "8000:8000"
```

これは:

- 左側: ホスト側ポート
- 右側: コンテナ側ポート

を意味します。

つまり `http://localhost:8000` にアクセスすると、コンテナ内の `8000` 番へ届きます。

## environment の意味

Compose の `environment` は、コンテナ内で動くプロセスに環境変数を渡します。

例:

```yaml
environment:
  FRONTEND_ORIGINS: http://localhost:5173
```

backend では FastAPI アプリがこの値を読みます。

frontend では Vite の Node プロセスが `VITE_API_BASE_URL` を読み、その値を `import.meta.env` としてブラウザ側コードで使えるようにします。

## volumes の意味

Compose の `volumes` には主に 2 種類あります。

### bind mount

例:

```yaml
- ./frontend:/app
```

これはホストの `./frontend` を、コンテナ内 `/app` にそのまま見せます。

特徴:

- ホストで編集したファイルがすぐコンテナに反映される
- 開発向き

### named volume

例:

```yaml
- frontend-node_modules:/app/node_modules
```

これは Docker が管理する volume を `/app/node_modules` に mount します。

特徴:

- ホストのファイルとは独立して保持される
- `node_modules` のような依存ファイルの保存に向いている

`volumes:` の末尾にある

```yaml
volumes:
  frontend-node_modules:
```

は、その named volume の定義です。

## frontend-node_modules を使う理由

frontend では `./frontend:/app` を bind mount しています。

このとき、image build 時に入れた `/app/node_modules` は bind mount に隠されやすいです。

そのため `node_modules` だけを named volume に分けて、依存関係を保持しています。

## local の .venv と Docker の衝突

backend を Docker 化するとき、local の `.venv` とコンテナ内の `.venv` が衝突しやすいです。

典型的な問題:

- ホスト側 `.venv` を bind mount で見せてしまう
- コンテナ内の Python 実行環境と整合しない
- permission error や broken virtual environment が起きる

このため backend は、development 用と deployment 用で考え方を分けた方が整理しやすいです。

## development と deployment の違い

### development 寄り

- bind mount を使う
- `--reload` を使う
- コード変更がすぐ反映される

### deployment 寄り

- build 時に依存関係を入れる
- runtime で状態を変えない
- bind mount を使わない
- image の中だけで完結する

backend は deployment 寄りに寄せた方が EC2 や ECS に持っていきやすいです。

## よく使うコマンド

起動:

```bash
docker compose up -d --build
```

状態確認:

```bash
docker compose ps
```

ログ確認:

```bash
docker compose logs -f
```

停止:

```bash
docker compose down
```

volume も削除:

```bash
docker compose down -v
```

## 今後の発展

今後は次のような段階に進めます。

- frontend を production build にする
- reverse proxy を入れる
- backend を内部向けにする
- ECS や S3 + CloudFront に展開する
