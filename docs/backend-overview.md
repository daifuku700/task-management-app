# Backend の仕組み

このドキュメントでは、このプロジェクトの backend がどのように動いているかを整理します。

## 使用技術

- Python
- FastAPI
- uv
- Uvicorn

backend は `backend/` ディレクトリにあります。

## 役割

backend の役割は、task データを管理する API を提供することです。

現在の API は次の通りです。

- `GET /tasks`
- `POST /tasks`
- `PUT /tasks/{task_id}`
- `DELETE /tasks/{task_id}`

## データの持ち方

現在は task をメモリ上の list で保持しています。

そのため、プロセスやコンテナを再起動するとデータは消えます。

これは学習初期には問題ありませんが、本番では database が必要になります。

## FastAPI の役割

FastAPI は HTTP リクエストを受け取り、Python の関数に対応付けます。

たとえば:

- `@app.get("/tasks")`
- `@app.post("/tasks")`

のように書くことで、URL と処理を結び付けています。

## Uvicorn の役割

Uvicorn は ASGI server です。

FastAPI アプリそのものは web server ではないため、実際に HTTP リクエストを受けるには Uvicorn のような server が必要です。

ローカル開発では通常次のように起動します。

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## uv の役割

`uv` は Python プロジェクトの依存関係管理と実行を担当します。

このプロジェクトでは次のように使っています。

- `uv sync`
  - 依存関係をインストールする
- `uv run ...`
  - 仮想環境内でコマンドを実行する

依存関係は `pyproject.toml` と `uv.lock` で管理しています。

## CORS の役割

frontend と backend は別 origin で動くことがあります。

例:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`

このとき、ブラウザは cross-origin request として扱うため、backend 側で CORS を許可する必要があります。

現在の backend は `FRONTEND_ORIGINS` 環境変数から許可 origin を読みます。

例:

```bash
FRONTEND_ORIGINS=http://localhost:5173
```

複数許可する場合:

```bash
FRONTEND_ORIGINS=http://localhost:5173,http://<EC2_PUBLIC_IP>:5173
```

## ローカル開発時の動き

ローカルでは通常:

- frontend が `5173`
- backend が `8000`

で動きます。

frontend は `http://localhost:8000/tasks` にリクエストし、backend は `http://localhost:5173` からの通信を CORS で許可します。

## EC2 上での動き

EC2 では frontend と backend をそれぞれ public IP 経由で見る構成にしています。

例:

- frontend: `http://<EC2_PUBLIC_IP>:5173`
- backend: `http://<EC2_PUBLIC_IP>:8000`

このとき backend は `FRONTEND_ORIGINS=http://<EC2_PUBLIC_IP>:5173` を許可する必要があります。

## deployment 寄り Dockerfile の考え方

backend は deployment 寄り Dockerfile にすることで、次の状態を目指します。

- build 時に依存関係を入れる
- runtime で状態を変えない
- bind mount や runtime `uv sync` に依存しない
- `.venv` を image の中に持つ

これにより、EC2 や ECS へ持っていきやすくなります。

## 今後の発展

今後は次のような改善が考えられます。

- database の導入
- migration の導入
- 認証の追加
- reverse proxy の導入
- production 向け app server 構成の見直し
