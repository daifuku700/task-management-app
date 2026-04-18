# frontend を S3 + CloudFront で配信する手順

このドキュメントでは、frontend を production build し、S3 に配置して CloudFront 経由で配信するまでの流れをまとめます。

## 目的

これまで frontend は Vite の開発サーバーで動かしていました。

ここからは、frontend を静的ファイルとして配信する構成に進みます。

最終的なイメージは次の通りです。

```text
Browser
  -> CloudFront
  -> S3 (frontend build files)

Browser
  -> ALB
  -> ECS
  -> backend
```

つまり:

- frontend は `S3 + CloudFront`
- backend は `ECS + ALB`

という役割分担にします。

## ここで理解したいこと

- frontend は静的ファイルとして配信できること
- Vite の production build では環境変数を build 時に埋め込むこと
- S3 はファイルの保管場所であること
- CloudFront は CDN 兼 配信入口であること
- CloudFront から S3 へは OAC を使って安全に接続するのがよいこと

## 1. frontend の production 用 API URL を決める

frontend は browser 上で動くため、API URL は browser が見える URL である必要があります。

今の backend は ALB 経由で公開できているので、frontend では backend の API URL を ALB 側に向けます。

例:

```env
VITE_API_BASE_URL=http://<ALB_DNS>
```

この場合、frontend のコードでは:

```ts
fetch(`${API_BASE_URL}/tasks`)
```

となるため、最終的に `http://<ALB_DNS>/tasks` を呼びます。

## 2. `.env.production` を用意する

`frontend/` 配下に production 用の env ファイルを作ります。

例:

```env
VITE_API_BASE_URL=http://<ALB_DNS>
```

ポイント:

- `VITE_` prefix が必要
- build 時に値が埋め込まれる
- build 後に env を変えても反映されない

つまり、API の向き先を変えるときは build のやり直しが必要です。

## 3. frontend を production build する

ローカルで実行します。

```bash
cd frontend
npm install
npm run build
```

build 成果物は通常 `frontend/dist/` に出力されます。

ここにある HTML / CSS / JavaScript が、S3 に置く対象です。

## 4. S3 bucket を作る

AWS コンソールで:

1. `Amazon S3`
2. `Create bucket`

設定例:

- Bucket name: 一意な名前
  - 例: `task-app-frontend-yourname`
- Region: backend や CloudFront と同じリージョンでもよい
- Block Public Access: **そのまま有効**

重要:

今回は CloudFront を通して配信するため、S3 bucket 自体は public にしません。

## 5. build 結果を S3 にアップロードする

方法はコンソールでも CLI でもよいですが、最初はコンソールでも十分です。

アップロードする対象:

- `frontend/dist/` の中身すべて

注意:

- `dist` フォルダそのものではなく、中のファイルをアップロードする
- `index.html` が bucket のルートに来るようにする

CLI 例:

```bash
aws s3 sync frontend/dist s3://<YOUR_BUCKET_NAME> --delete
```

## 6. CloudFront Distribution を作る

AWS コンソールで:

1. `Amazon CloudFront`
2. `Distributions`
3. `Create distribution`

### Origin の設定

Origin として、作成した S3 bucket を選びます。

ここで重要なのは:

- S3 website endpoint を origin にするのではなく
- 通常の S3 bucket origin を使うこと

そのうえで **Origin Access Control (OAC)** を使います。

AWS docs でも、S3 origin を CloudFront 経由だけで見せる場合は OAC が推奨です。

### OAC の設定

CloudFront の origin access 設定で:

- `Origin access control settings (recommended)`

を選びます。

必要なら新規 OAC を作成します。

CloudFront 側で bucket policy を更新する提案が出たら、それを使って設定して構いません。

これにより:

- browser は CloudFront にアクセス
- CloudFront だけが S3 bucket を読める

状態になります。

## 7. Default root object を設定する

CloudFront Distribution の設定で:

- Default root object: `index.html`

を設定します。

これを入れておくと、CloudFront の root URL にアクセスしたとき `index.html` が返ります。

## 8. SPA 用に Custom Error Response を設定する

React Router を使う SPA 構成では、直接 `/some/path` にアクセスしたときに 404 になることがあります。

今後に備えて、CloudFront に次の設定を入れておくと安全です。

- 403 -> `/index.html`
- 404 -> `/index.html`

Response code は `200` に変えます。

これで SPA の client-side routing に対応しやすくなります。

今のアプリが root path だけなら、後でも構いません。

## 9. CloudFront のデプロイ完了を待つ

Distribution 作成後、デプロイには少し時間がかかります。

Status が `Deployed` になるのを待ちます。

その後、CloudFront の domain name を確認します。

例:

```text
d123456abcdef8.cloudfront.net
```

## 10. frontend を確認する

ブラウザで次にアクセスします。

```text
https://<CLOUDFRONT_DOMAIN>
```

または HTTP の場合:

```text
http://<CLOUDFRONT_DOMAIN>
```

ここで frontend が表示されれば、静的配信は成功です。

さらに task 一覧取得などを試し、backend の ALB と通信できるか確認します。

今回の学習到達点としては、CloudFront distribution を作成し、CloudFront domain から frontend が表示されるところまで確認できています。

## 11. API 通信で失敗したときの確認ポイント

### frontend は表示されるが API が失敗する

確認:

1. `.env.production` の `VITE_API_BASE_URL` が ALB に向いているか
2. build をやり直したか
3. `dist` を再アップロードしたか
4. backend の CORS に CloudFront 側 origin が含まれているか

CloudFront を使うと frontend の origin は次のようになります。

```text
https://<CLOUDFRONT_DOMAIN>
```

したがって backend には、その origin を `FRONTEND_ORIGINS` で許可する必要があります。

例:

```text
https://<CLOUDFRONT_DOMAIN>
```

もし将来独自ドメインを使うなら、その origin に合わせて更新します。

## 12. CORS の注意

EC2 のときは frontend origin が:

```text
http://<EC2_PUBLIC_IP>:5173
```

でした。

CloudFront に移すと:

```text
https://<CLOUDFRONT_DOMAIN>
```

に変わります。

つまり backend 側で許可すべき origin も変わります。

ここを更新しないと、frontend は表示されても API 通信だけ失敗します。

## 13. 今後の理想形

将来的には次のような形に寄せるのが自然です。

- frontend: `https://example.com`
- backend API: `https://example.com/api`

この場合:

- CloudFront または ALB を入口に統一できる
- browser 視点で分かりやすい
- CORS の扱いも単純化しやすい

今はまだ ALB の DNS を API 向き先として使えば十分です。

## ここまでで理解したいこと

この工程で重要なのは次の 6 点です。

1. frontend は静的ファイルとして配信できる
2. Vite の env は build 時に埋め込まれる
3. S3 は配信元ファイルの保管場所
4. CloudFront は外部公開の入口
5. S3 bucket は public にせず、CloudFront OAC で守る
6. backend CORS の許可 origin は CloudFront の domain に合わせる必要がある

## 次のステップ

ここまでできたら、次は自動デプロイです。

次のテーマ:

- GitHub Actions
- CodePipeline
- Source / Build / Deploy
- Rolling update / Blue-Green deploy

つまり、今まで手動でやっていた

- frontend build / upload
- backend image build / push
- ECS 更新

を自動化していく段階に進みます。
