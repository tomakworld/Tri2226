/* localStorage 版本的儲存層：介面模仿原本 Claude 的 window.storage,
   讓 App.jsx 幾乎不用改。資料存在「使用者自己的瀏覽器」中,
   每個訪客各自獨立,互不影響。 */
const PREFIX = "tri226:";

export const storage = {
  async get(key) {
    const v = localStorage.getItem(PREFIX + key);
    if (v === null) throw new Error("not found");
    return { key, value: v };
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value);
    return { key, value };
  },
};
