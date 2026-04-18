# AWS ネットワーク理解チェック 回答レビュー

このドキュメントは、AWS ネットワーク理解チェックに対する回答の判定と補足をまとめたものです。

## 1. VPC の役割

### 問題

VPC の役割を、AWS 上で何を分離・管理するものかという観点から説明してください。

### あなたの回答

VPC は AWS 上でネットワークを分離管理するものだと思います.

### 判定

正解です。

### 補足

VPC は、AWS 上に作る自分専用の仮想ネットワークです。

ポイント:

- ネットワーク空間を分離する
- IP アドレス範囲を管理する
- subnet, route table, security group などをその中で管理する

## 2. VPC と subnet の関係

### 問題

subnet は VPC とどういう関係にありますか。VPC と subnet の違いを説明してください。

### あなたの回答

VPC の中に複数の subnet を作ることができ, /16 の VPC を持っていたら, /24 の subnet などを作ることができます.

### 判定

概ね正解です。

### 補足

subnet は VPC の中の区画です。

VPC と subnet の違い:

- VPC はネットワーク全体
- subnet はその中の部分的な範囲

CIDR の例:

- VPC: `10.0.0.0/16`
- subnet: `10.0.1.0/24`, `10.0.2.0/24`

## 3. public subnet と private subnet の違い

### 問題

public subnet と private subnet の違いを、`インターネットから直接到達できるか` という観点で説明してください。

### あなたの回答

public のほうは外部からアクセスできるが, private は subnet 同士でしかやり取りできないはずです.

### 判定

一部正解ですが、不十分です。

### 補足

違いは「インターネットから直接到達可能かどうか」です。

- public subnet
  - internet gateway への route を持つ
  - public IP を持つインスタンスは外部から到達可能
- private subnet
  - internet gateway への直接 route を持たない
  - 外部から直接到達できない

`private は subnet 同士でしかやり取りできない` は不正確です。
private subnet でも、NAT gateway, VPC 内通信, ALB 経由の通信などは可能です。

## 4. subnet が public subnet になる条件

### 問題

subnet が public subnet になるために必要な条件を説明してください。
`internet gateway`, `route table`, `public IP` という言葉を使って説明してください。

### あなたの回答

public にするためには, internet gateway を public subnet に接続し, route table が internet gateway と public subnet のパスを作り, public subnet 内のインスタンスには public IP を割り当てる必要がある.

### 判定

概ね正解です。

### 補足

正確には次の条件が必要です。

1. VPC に internet gateway がアタッチされている
2. その subnet に関連付く route table に `0.0.0.0/0 -> internet gateway` がある
3. インスタンスに public IP が付いている

`internet gateway を public subnet に接続する` ではなく、internet gateway は VPC にアタッチされます。

## 5. route table の役割

### 問題

route table の役割は何ですか。特に `0.0.0.0/0` の route は何を意味しますか。

### あなたの回答

route table は指定された ip address に到達するためにはどこにアクセスしたら良いかを制御するものであり, 0.0.0.0/0 はすべての通信に対して意味をしている.

### 判定

正解です。

### 補足

`0.0.0.0/0` は「それ以外のすべての IPv4 宛先」を意味します。

つまり:

- 社内向けや VPC 内向け以外の通信
- 外部インターネット向け通信

をひとまとめにした default route と考えてよいです。

## 6. security group と route table の違い

### 問題

security group と route table はどちらも通信に関係しますが、何が違いますか。
それぞれが「何を決めるものか」を説明してください。

### あなたの回答

security group は通信できるプロトコルやポートをオプトイン方式で管理するもので, route table はどこにアクセスしたら良いかを制御するもの

### 判定

正解です。

### 補足

- route table
  - 通信をどこへ送るかを決める
- security group
  - その通信を許可するかを決める

つまり:

- route table は経路
- security group は通行許可

です。

## 7. EC2 を private subnet に置く理由

### 問題

EC2 を private subnet に置く理由を説明してください。
「なぜ public subnet に直接置かない方がよいのか」まで含めて答えてください。

### あなたの回答

ec2 を public subnet に置くと, 極端な話, だれでもその ec2 にアクセスできるようになるので, 攻撃とかされるリスクが高まってしまうため.

### 判定

正解です。

### 補足

より良い説明にすると次の通りです。

- EC2 を public subnet に置くと、public IP を持たせて直接公開しやすい
- その分、攻撃対象面が広がる
- private subnet に置けば、外部から直接アクセスされない
- 公開入口を ALB だけに絞れる

## 8. ALB を public subnet、EC2 を private subnet に置く構成の通信順

### 問題

ALB を public subnet に置き、EC2 を private subnet に置く構成では、外部ユーザーからのリクエストはどの順番で流れますか。
できるだけ具体的に説明してください。

### あなたの回答

まず ALB に通信が流れ, ロードバランサーがどのec2インスタンスに通信するかを決め, それから ec2 にリクエストが行くといった流れ

### 判定

概ね正解です。

### 補足

より正確な流れは次の通りです。

1. ユーザーが ALB の DNS 名にアクセスする
2. インターネットから ALB にリクエストが届く
3. ALB が listener rule と target group を見て転送先を決める
4. private subnet 上の EC2 にリクエストを送る
5. EC2 が応答する
6. 応答が ALB を経由してユーザーに返る

## 9. ALB と EC2 で security group を分ける場合の EC2 側 inbound

### 問題

ALB と EC2 で security group を分ける場合、EC2 側の inbound rule はどのような考え方で設定するのがよいですか。
`0.0.0.0/0` と比較しながら説明してください。

### あなたの回答

EC2 は ALB との通信しか許可しないようにして, セキュリティを高めるべきだと思います

### 判定

正解です。

### 補足

EC2 側は `0.0.0.0/0` を許可するのではなく、ALB の security group からの通信だけを許可するのがよいです。

考え方:

- ALB は外部公開
- EC2 は内部向け
- したがって EC2 は ALB 経由の通信だけ受ける

## 10. frontend と backend を直接ポート公開する構成の課題

### 問題

今のあなたの学習中アプリでは、frontend と backend を EC2 上で直接ポート公開していました。
この構成の課題を 2 つ以上挙げてください。

### あなたの回答

1 つめは他人も global ip さえどうにかできれば, ec2 にアクセスでき, 攻撃することが可能になってしまう点. もう一点は, わかりませんでした.

### 判定

一部正解です。

### 補足

あなたの 1 つめの回答は正しいです。

追加で挙げるべき課題:

- backend を直接公開してしまう
- frontend の dev server をそのまま公開している
- 公開ポートが増えて運用しにくい
- ALB や reverse proxy を前提にした構成へ移りにくい
- HTTPS 化やドメイン管理がしにくい

## 11. private subnet 上の backend が応答できる理由

### 問題

browser から `http://<ALB_DNS>` にアクセスしたとき、private subnet 上の backend が応答できるのはなぜですか。
`public IP がなくてもよい理由` を含めて説明してください。

### あなたの回答

わかりませんが, frontend が同じ subnet にあるから問題ない気がします.

### 判定

不正解です。

### 模範的な説明

private subnet 上の backend は public IP を持っていなくても、ALB からの内部通信を受けられるため応答できます。

理由:

- ALB は public subnet にいて、外部からの入口になる
- ALB と EC2 は同じ VPC 内で通信できる
- EC2 側 security group が ALB からの通信を許可している
- そのため、ユーザーは EC2 に直接入らなくても ALB 経由で backend を利用できる

`frontend が同じ subnet にあるから` ではありません。

## 12. CORS はどの層の問題か

### 問題

CORS はどの層の問題ですか。
`network レベルの到達性` と `browser の制約` を区別して説明してください。

### あなたの回答

わかりません.

### 判定

未回答です。

### 模範解答

CORS は browser の制約です。

区別:

- network レベルの到達性
  - そもそも相手に TCP / HTTP で届くか
  - VPC, route table, security group などの問題
- browser の制約
  - backend に届いていても、browser がレスポンスを frontend JavaScript に渡してよいかを制御する
  - これが CORS

つまり、CORS は「通信できるか」ではなく、「browser がそのレスポンスを読ませてよいか」の問題です。

## 13. VITE_API_BASE_URL に設定すべき値

### 問題

frontend の `VITE_API_BASE_URL` に設定すべき値は、`コンテナから見える backend の URL` ですか、それとも `browser から見える backend の URL` ですか。理由も説明してください。

### あなたの回答

わかりません.

### 判定

未回答です。

### 模範解答

設定すべきなのは、browser から見える backend の URL です。

理由:

- frontend の JavaScript は browser 上で動く
- API リクエストを送るのは browser
- したがって、browser が到達できる URL を設定する必要がある

例:

- 正しい例: `http://<EC2_PUBLIC_IP>:8000`
- 誤りになりやすい例: `http://backend:8000`

`backend:8000` は container 間通信では使えても、browser からは見えません。

## 14. `5173` と `8000` を直接開ける構成と、`80/443` を ALB で受ける構成の違い

### 問題

Security Group で `5173` と `8000` を直接開ける構成と、`80/443` だけを ALB で受ける構成では、運用上どんな違いがありますか。

### あなたの回答

ec2 が攻撃されてサービスが落ちることを防げる

### 判定

一部正解です。

### 補足

`攻撃されにくい` という方向性は正しいです。

より具体的には:

- `5173` / `8000` 直公開
  - 各アプリを直接外にさらす
  - 公開ポートが増える
  - dev server や内部 API をそのまま出しやすい
  - HTTPS, routing, health check, scaling の設計が弱い

- `80/443` を ALB で受ける
  - 公開入口を ALB に集約できる
  - backend を private subnet に置きやすい
  - HTTPS 化や path-based routing をしやすい
  - target health check やスケールと相性がよい

## 15. ECS に進む前に最低限説明できるべきこと

### 問題

今の段階から ECS に進む前に、ネットワーク理解として最低限説明できるべきことを、自分なりに 3 項目挙げてください。

### あなたの回答

vpc の中で, front のための ec2 は public subnet 二配置し, それ以外は private に配置すべき.

### 判定

不十分です。

### 補足

回答は 3 項目必要でした。

最低限説明できるとよい内容の例:

1. VPC / subnet / route table / security group の役割
2. public subnet と private subnet の違い
3. ALB を public subnet、アプリサーバーを private subnet に置く理由

追加で説明できると良い内容:

- browser から見える URL と container 間 URL の違い
- CORS は browser 側の制約であること
- 入口を ALB に集約するメリット

## 総評

全体として、次の点はしっかり理解できています。

- VPC と subnet の基本関係
- route table と security group の役割の違い
- EC2 を private subnet に置く意義
- ALB から EC2 に流す構成の大まかなイメージ

一方で、次の点は補強するとかなり強くなります。

- private subnet の正確な意味
- ALB 経由で private EC2 に届く理由
- CORS が browser 制約であること
- frontend の env は browser 視点で考えること

## 次に確認するとよいテーマ

次は次の 4 つを自分の言葉で説明できるようにするとよいです。

1. public subnet と private subnet の違い
2. ALB があると private EC2 でも公開アプリを動かせる理由
3. CORS と network 到達性の違い
4. frontend の API URL は browser 視点で決める理由

---

# 追加問題レビュー

## 追加問題 1

### 問題

private subnet 上の EC2 が public IP を持っていなくても、ALB 経由で外部ユーザーにサービスを返せるのはなぜですか。  
`VPC 内通信` と `ALB の役割` を使って説明してください。

### あなたの回答

まず外部からの通信が ALB が受け取り, VPC 内の通信を routing table で管理していればそれを VPC ないで ec2 に到達することができるため.

### 判定

部分正解です。

### 補足

骨子は正しいです。

より正確には次の通りです。

1. 外部ユーザーは public subnet 上の ALB にアクセスする
2. ALB が target group の設定に従って private subnet 上の EC2 に転送する
3. ALB と EC2 は同じ VPC 内で内部通信できる
4. そのため EC2 自身に public IP がなくても応答できる

ここでは `route table` よりも、`ALB が入口として動き、VPC 内で EC2 に転送する` という点が重要です。

## 追加問題 2

### 問題

public subnet にある ALB と private subnet にある EC2 が通信できる理由を説明してください。  
「同じ VPC にあること」と「security group」の両方に触れてください。

### あなたの回答

security group で, 同じ VPC にある ALB と ec2 の通信を許可していれば, 通信することができる

### 判定

正解です。

### 補足

より丁寧に言うと:

- ALB と EC2 は同じ VPC 内にある
- VPC 内では private IP ベースで通信できる
- そのうえで security group が通信を許可していれば到達できる

## 追加問題 3

### 問題

private subnet にある EC2 が、インターネットから直接アクセスされない理由を説明してください。  
`route table` と `public IP` を使って説明してください。

### あなたの回答

public ip が割り当てられていない上に, private subnet 内の ec2 に到達する経路が, route table に登録されていないから

### 判定

正解です。

### 補足

その理解でよいです。

ポイント:

- public IP がない
- internet gateway に直接出る route を持たない

この 2 つがそろうことで、外部から直接入れません。

## 追加問題 4

### 問題

frontend が `http://<EC2_PUBLIC_IP>:5173` で動いていて、backend が `http://<EC2_PUBLIC_IP>:8000` で動いているとき、browser から見るとこれは同一 origin ですか、別 origin ですか。理由も説明してください。

### あなたの回答

同一 origin です. なぜなら, front も back も ec2 の public ip にアクセスする必要があるからです

### 判定

不正解です。

### 模範解答

これは **別 origin** です。

origin は次の 3 要素で決まります。

- scheme
- host
- port

今回は host は同じでも、`5173` と `8000` で port が違うため別 origin です。

## 追加問題 5

### 問題

backend の API URL を browser が呼ぶとき、`http://backend:8000` を `VITE_API_BASE_URL` に設定してはいけないのはなぜですか。

### あなたの回答

browser からその API を呼ぶため, browser から到達可能, すなわち, 名前解決できるようなドメインや ipv4 アドレスである必要があるから.

### 判定

正解です。

### 補足

`backend` は Compose 内の service 名としては使えても、browser からは通常名前解決できません。

## 追加問題 6

### 問題

次の 2 つのうち、`VITE_API_BASE_URL` に入れるべきなのはどちらですか。理由も説明してください。  
1. container 間で疎通できる URL  
2. browser が到達できる URL

### あなたの回答

1 の container 間で疎通できる URL

### 判定

不正解です。

### 模範解答

正しいのは **2. browser が到達できる URL** です。

理由:

- frontend のコードは browser 上で動く
- 実際に API を呼ぶのは browser
- したがって browser が見える URL を設定する必要がある

## 追加問題 7

### 問題

browser で backend の URL を直接開くと見えるのに、frontend からの `fetch` だと失敗することがあります。これはどんなときに起こりますか。  
`CORS` を使って説明してください。

### あなたの回答

これは CORS によって, 同一 origin からのアクセスを拒否してしまうからです.

### 判定

不正解です。

### 模範解答

これは、**別 origin の frontend から backend を呼んでいて、backend がその origin を CORS で許可していないとき** に起こります。

重要なのは:

- backend にはリクエストが届くことがある
- しかし browser がレスポンスを frontend JavaScript に渡さない

CORS は「同一 origin を拒否する仕組み」ではありません。
別 origin アクセスを browser が制御する仕組みです。

## 追加問題 8

### 問題

CORS エラーと、Security Group による通信拒否は何が違いますか。  
browser 上でどう見えるか、backend にリクエストが届くか、という観点で説明してください。

### あなたの回答

security group による通信拒否は, そもそも backend にリクエストが届きませんが, cors エラーの場合, backend には到達できるが, 拒否されてしまうといった違いがある. browser からは, どっちも同じように見えている気がします. もしかしたら, error code が前者は 404 だが, 後者は異なるのかもしれないです

### 判定

部分正解です。

### 補足

正しい部分:

- security group では backend に届かない
- CORS では backend に届くことがある

不正確な部分:

- security group が原因で 404 になるわけではない
- browser からの見え方も同じではない

一般に:

- security group / network 問題
  - network error, timeout, connection failure に近い
- CORS
  - browser console に CORS error が出やすい

## 追加問題 9

### 問題

`OPTIONS` リクエストが先に飛ぶことがありますが、これは何のためですか。  
どんな種類の通信で起こりやすいかも説明してください。

### あなたの回答

post, put などで, 本当にそこに到達可能かを調べるため

### 判定

部分正解です。

### 補足

`POST` や `PUT` で起こりやすいのは正しいです。

ただし目的は「到達可能か確認」ではなく、**browser が事前確認を行うこと** です。

確認している内容:

- その origin を許可しているか
- その method を許可しているか
- その header を許可しているか

これを CORS preflight と呼びます。

## 追加問題 10

### 問題

`5173` と `8000` を直接公開する構成から、`80/443` を ALB で受ける構成に変えると、運用上どんなメリットがありますか。2 つ以上挙げてください。

### あなたの回答

ec2 を直接公開しないため, セキュリティ的に良いのと, 80/443 といった http/https の一般的なポートのみを空けるので, 管理がしやすい

### 判定

正解です。

### 補足

加えて:

- HTTPS 化しやすい
- health check を使いやすい
- path-based routing を使いやすい
- backend を private subnet に置きやすい

## 追加問題 11

### 問題

ALB を導入した場合、EC2 側の Security Group はどのように設定するのが望ましいですか。  
`ALB の Security Group を参照する` という言い方を使って説明してください。

### あなたの回答

ec2 の inbound は ALB との通信しか許可しないようにする

### 判定

概ね正解です。

### 模範解答

EC2 側の inbound rule は、`0.0.0.0/0` を許可するのではなく、**ALB の Security Group を source として参照し、その SG からの通信だけを許可する** のが望ましいです。

## 追加問題 12

### 問題

今のあなたのアプリを、将来的に `ALB + private subnet 上の backend` 構成へ持っていくとします。frontend の API 呼び出し先は最終的にどのような URL の形に寄せるのが自然ですか。  
たとえば `ALB の DNS`, `独自ドメイン`, `path ベース routing` などの観点で答えてください。

### あなたの回答

ドメインは alb のドメインにするのが良いと思います.

### 判定

部分正解です。

### 補足

ALB の DNS を使う方向性は自然です。

ただし将来的には次の形がより実務的です。

- `https://example.com`
- `https://example.com/api`

つまり:

- 独自ドメインを使う
- ALB を入口にする
- path-based routing で `/api` を backend に流す

という構成に寄せるのが自然です。

## 追加問題の総評

前回よりかなり理解が進んでいます。

特に良くなった点:

- private subnet の基本
- ALB と EC2 の関係
- browser から見える URL という観点の理解

引き続き補強するとよい点:

1. origin は `host` だけでなく `port` も含む
2. `VITE_API_BASE_URL` は browser 視点で決める
3. CORS は network 制約ではなく browser 制約
4. ALB は VPC 内で private EC2 に転送できる
