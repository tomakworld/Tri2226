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
