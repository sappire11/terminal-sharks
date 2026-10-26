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
數值定義在 `src/term.ts` 的 `COLORS` 與 `SLATE`。

操作：滑鼠移動會引誘魚群、點擊會濺起水花；`q` / `Esc` / `Ctrl-C` 離開。
需要支援 24-bit 色彩的終端機（iTerm2、WezTerm、Kitty、Ghostty 等）。

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
