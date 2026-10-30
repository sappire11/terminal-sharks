# terminal-sharks

把 [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks) 的 ASCII 鯊魚搬到終端機上游動。

> 本專案修改自 [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks)
> （MIT License，Copyright (c) 2026 drewdi）。原作的模擬與繪製程式沿用並經過修改，
> 修改內容見下方〈與原作的差異〉。

```sh
npm install
npm start                                   # 預設：八種鯊魚同時出場
npm start -- thresher,hammerhead            # 指定鯊魚種類，第一隻最大
npm start -- classic:white,mako:dark,tiger:natural   # 種類:灰階
```

種類：`classic` `hammerhead` `greathammer` `tiger` `zebra` `mako` `thresher` `nurse`

灰階：`white` `light` `mid` `dark` `slate`，或 `natural`（該種類原本的淡色調）。
沒指定時以四隻為一批自動配色：第一批是由亮到中灰的中性灰，第二批是低明度的藍灰。
數值定義在 `src/lineup.ts` 的 `COLORS` 與 `SLATE`。

操作：滑鼠移動會引誘魚群、點擊會濺起水花；`q` / `Esc` / `Ctrl-C` 離開。
需要支援 24-bit 色彩的終端機（iTerm2、WezTerm、Kitty、Ghostty 等）。

## 視窗版與 Windows 螢幕保護程式

同一套模擬與繪製，直接畫在瀏覽器 canvas 上（`src/web.ts`），再用 Tauri 包成 `.scr`。

有兩個場景，在「螢幕保護程式設定」按「設定」切換：

- **鯊魚海洋**：同終端機版。
- **宇宙：藍咩與航星者**：像素風的夜空（`src/space/`）。藍咩四處漫遊、看流星、打瞌睡；
  航星者停停飄飄、來拜訪她、列隊飛過、圍觀長角；相遇時會冒愛心，偶爾說「咩!」「嘎!」。

螢保模式下每個螢幕各一片畫面；按鍵、點擊或移動滑鼠超過 10px 就結束。
控制台裡的小預覽框不支援，會保持空白。

### 建置

需要 Rust（rustup）與 Visual Studio C++ Build Tools（「使用 C++ 的桌面開發」）。

```sh
npm run dev                              # 瀏覽器開 http://localhost:5173 ；?mode=saver 模擬螢保、?sharks=tiger,mako 指定種類
                                         # ?scene=space 宇宙場景、&events=fast 事件密集、?mode=sprites 看所有像素圖
npm run tauri dev -- -- /s               # 用 Tauri 視窗跑螢保模式
npm run scr                              # 建置 → release/terminal-sharks.scr，並打包 release/terminal-sharks.zip
node scripts/make-scr.mjs --pack-only    # 不重建，只用現有 .scr 重新打包 zip
```

圖示已產生在 `src-tauri/icons/`；改了 `app-icon.svg` 才需要重跑
`node node_modules/@tauri-apps/cli/tauri.js icon app-icon.svg`（`npx tauri` 可能卡在安裝確認提示）。

分享給別人：傳 `release/terminal-sharks.zip`，內含 `.scr` 與給收檔人看的
[`安裝說明.txt`](docs/安裝說明.txt)。Email 多半會擋執行檔（zip 也會被掃出來），
請用雲端硬碟分享連結、LINE 或 USB。

### 安裝

需要 Windows 10 / 11（64 位元）與 WebView2 Runtime（Windows 11 內建）。

1. **解除封鎖**（在解壓縮之前）：對下載的 `terminal-sharks.zip` 按右鍵 →「內容」→ 勾選「解除封鎖」→「確定」。
   沒做的話，閒置啟動時 SmartScreen 的警告顯示不出來，結果是時間到了什麼都沒出現。
2. 解壓縮，把 `terminal-sharks.scr` 放到固定位置（例如 `C:\Tools\`）。
   安裝後 Windows 只記住路徑，檔案被搬走或刪掉就會失效；不要留在「下載」或直接從 zip 裡執行。
3. 對 `terminal-sharks.scr` 按右鍵 →「測試」。若出現「Windows 已保護您的電腦」，按「其他資訊」→「仍要執行」。
4. 按右鍵 →「安裝」，在「螢幕保護程式設定」設定等候時間 →「確定」。
5. 切換場景：對 `.scr` 按右鍵 →「設定」（或直接按兩下），選「鯊魚海洋」或「宇宙：藍咩與航星者」，選了就會儲存。

**快捷鍵（可選）**：在桌面新增捷徑，位置填 `"C:\Tools\terminal-sharks.scr" /s`（`/s` 直接進螢保），
再到捷徑「內容」→「快速鍵」按一個字母（例如 `S` → `Ctrl + Alt + S`）。
捷徑必須放在桌面最外層或開始功能表（`Win + R` → `shell:programs`，可建子資料夾）才有效，桌面上的資料夾裡不行。

**解除安裝**：螢幕保護程式設定選「(無)」，再刪除 `.scr` 與捷徑。

**常見問題**

- 時間到了沒出現 → 多半是沒解除封鎖：對 `.scr` 按右鍵 →「內容」→「解除封鎖」，再重新安裝。
- 白畫面或沒反應 → 安裝 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Evergreen Bootstrapper）。
- 被防毒擋 → 程式沒有數位簽章，部分防毒會誤判；公司電腦請先詢問 IT。
- 關不掉 → `Ctrl + Alt + Delete` →「工作管理員」→ 結束 terminal-sharks。

## 運作方式

`src/world.ts`（模擬）、`src/renderer.ts`（逐格繪製）、`src/math.ts`、`src/species.ts` 取自上游（MIT）。
`src/term.ts` 提供一個假的 canvas 2D context，把 renderer 每格畫的字元與顏色記錄下來，
再以 ANSI truecolor 輸出到終端機。一個終端機字元對應 10×20 px 的格子，所以鯊魚比例不會被壓扁。

## 與原作的差異

### 尺寸與體型

- **隨終端機放大**：原作把鯊魚身長上限設在 430 px（為網頁大螢幕設計），
  終端機版取消上限（`World.maxSharkLength`），身長固定是畫面短邊的 44%；
  調整視窗大小時，現有鯊魚也會等比例縮放。
- **更修長**：`AsciiRenderer.slenderness` 只縮放身體寬度與各鰭往兩側伸出的距離，不影響身長。
  原作為 1，終端機版設為 0.9（`src/term.ts`）。
- **各自的色調**：`SharkSpec` 可帶 `tint`，覆蓋該種類原本的膚色倍率。

### 游動節奏

- **擺尾頻率依前進距離計算**：原作依時間擺尾，含固定底數，游得慢也一直擺，
  約每前進 0.12 個身長擺一次，鯊魚越大越不自然。
  現在每前進 `TAIL_STRIDE`（0.45）個身長擺一次尾，游得快擺得快、滑行時幾乎不擺。
- **擺動集中在後半身**：前半身幾乎不動，只有頭部微幅回擺，擺動從後半身漸增到尾巴，
  波長也拉長，看起來是尾巴在掃，而不是全身 S 形扭動。
- **隨機快慢**：每隻鯊魚各自在滑行（0.55 倍）、巡游（1 倍）、衝刺（1.8 倍）之間隨機切換，
  各持續一段隨機時間；衝刺時加速快，滑行時慢慢減速。
  巡游與遠距離跟蹤獵物時都會套用；越接近獵物，越轉為原作的最後衝刺。
  參數在 `src/world.ts` 開頭的 `PACES`。

### 終端機輸出

- 每秒 60 張；每張畫面依實際經過時間推進模擬（必要時平均切成多個小步），
  避免 Node 計時器的誤差造成動作一頓一頓。
- 只重畫有變化的格子，並使用同步輸出（DEC 2026）避免畫面撕裂；
  終端機來不及消化時會跳過該張畫面，而不是累積延遲。

## License

MIT。本專案依原作的 MIT 授權發佈，`LICENSE` 保留原作完整的版權與授權聲明。
