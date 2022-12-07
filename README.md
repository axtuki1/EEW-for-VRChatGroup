# EEW for VRChatGroup

日本の緊急地震速報をVRChat Groupの  
Announcementに送信できるNode.jsアプリケーションです。

VRChatのREST APIは基本的に公開されていない為、  
2022年12月時点のWebサイトの仕様を基に作成している本アプリが、  
今後の更新で利用できなくなる場合があります。

## 注意

Node.js v18よりフラグなしで実行できる`fetch`を利用しています。

## 使い方

`config`フォルダ内の`template.json`を`config.json`へリネームします。
```
$ cp ./config/template.json ./config/config.json
(mvでも可)
```

`config.json`内の設定項目を入力します。

- 対象グループのID  
  (ttps://vrchat.com/home/group/grp_xxxx... の `grp_xxxx...` の部分)
- アナウンスを行うアカウント情報  
  (新規アカウントを推奨します)
- 通知を行う最小震度

必要なライブラリのインストールとビルドを行います。

```
$ npm install
$ npm run build
```

ビルドが完了したら実行します。

```
$ npm run start
```

## おことわり

情報の伝達速度は使用するサーバーやVRChatサーバー等の  
回線速度や処理能力によって左右されます。  
本アプリに全てを頼るのではなく様々な手段を予め用意しておきましょう。  

本アプリを利用することで発生したトラブルや  
損害に対して一切責任を負いませんのでご了承ください。

