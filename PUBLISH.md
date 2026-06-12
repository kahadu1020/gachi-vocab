# GitHub Pages でスマホから使う

GitHub ユーザー名が `kahadu` の場合、リポジトリ名を `gachi-vocab` にすると公開URLは次の形になります。

```text
https://kahadu.github.io/gachi-vocab/
```

## ブラウザだけで公開する手順

1. GitHubで新しいリポジトリを作ります。
   - Repository name: `gachi-vocab`
   - Public を選びます。
   - README は作らなくて大丈夫です。
2. 作ったリポジトリの画面で `uploading an existing file` を選びます。
3. このフォルダ内のファイルをアップロードします。
   - `.nojekyll`
   - `app.js`
   - `data.js`
   - `icon.svg`
   - `index.html`
   - `manifest.webmanifest`
   - `README.md`
   - `server.mjs`
   - `styles.css`
   - `sw.js`
4. `Commit changes` を押します。
5. `Settings` → `Pages` を開きます。
6. `Build and deployment` の Source を `Deploy from a branch` にします。
7. Branch を `main`、フォルダを `/root` にして `Save` します。
8. 数分待つと `https://kahadu.github.io/gachi-vocab/` で開けます。

## スマホに入れる

iPhoneならSafariで公開URLを開いて、共有ボタンから「ホーム画面に追加」を選びます。

AndroidならChromeで公開URLを開いて、メニューから「ホーム画面に追加」または「アプリをインストール」を選びます。

## 進捗の注意

進捗はそのスマホのブラウザ内に保存されます。サイトデータやブラウザアプリのデータを消す前に、右上の `⇩` でJSONを書き出しておくと復元できます。
