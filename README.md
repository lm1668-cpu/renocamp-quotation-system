# 裝修工程報價系統示例

一個以香港室內裝修工程流程為背景的報價單建立器示例，展示工程目錄、分區、數量／單價、報價預覽與列印流程。

> **示例資料聲明：** 本 repository 的工程項目、成本示例、樓宇類型係數、訂閱金額及付款文字均為虛構測試資料，並非市場報價或任何公司的實際收費。請勿用於估價、採購、正式報價或付款。

## 本機執行

需要 Node.js 及 npm。於 repository 根目錄執行：

```sh
npm install
npm run dev
```

開啟終端輸出的本機網址即可試用。`npm run typecheck`、`npm test` 及 `npm run lint` 可用於基本檢查；`npm test` 執行公開示例的核心報價測試。

目錄由 `src/lib/quotes/data.ts` 載入虛構快照；公開示例版固定讀取本地資料，不會連接任何遠端目錄或資料庫。不要把真實客戶資料、工程資料、成本價或登入憑證放進此 repository。

## 設定與安全

此 repository 只供本機示範與程式研究，不含業主帳戶 ID、正式 Worker 名稱、真實資料庫 URL 或可用 OAuth 憑證。保留的通用 Worker 設定只供本機預覽。認證預設不啟用；若要在其他環境部署，請先自行完成登入驗證、存取控制、資料庫隔離與安全檢查，並把必需的設定放在部署環境的 secret store，而非 Git 檔案。

`.env.example` 只列出環境變數名稱及安全的本機示例預設，不含任何 secret。可按需要複製為 `.env`；`.env`、`.dev.vars` 及本機建置輸出會由 `.gitignore` 排除。請勿直接部署此示例，亦不要接上真實客戶資料或正式付款渠道。

## 主要程式位置

- `src/components/`：報價建立、主頁、管理畫面及列印版面。
- `src/lib/quotes/`：示例目錄、報價型別、計算及本機快照。
- `migrations/`：本機示例資料庫 schema。

## License

本 repository 暫未指定授權條款；如需再散佈或商業使用，請先取得 repository owner 的許可。
