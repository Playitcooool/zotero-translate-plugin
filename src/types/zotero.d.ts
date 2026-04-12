declare const Zotero: {
  Prefs: {
    get(key: string): string | number | boolean;
    set(key: string, value: string | number | boolean): void;
    clear(key: string): void;
  };
  Menu?: {
    register(id: string, options: { label: string; callback: () => void }): void;
  };
  Message?: {
    listen(handler: (msg: { type: string; data?: unknown }) => void): void;
    reply(msg: { type: string }; response: object): void;
  };
  http?: {
    request(url: string, options?: object): Promise<object>;
  };
  Addon?: {
    getPlugin(id: string): { [key: string]: unknown };
  };
};

declare const Components: {
  classes: { [key: string]: unknown };
};
