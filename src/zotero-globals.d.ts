/// <reference path="../node_modules/zotero-types/index.d.ts" />

declare const Services: any;
declare const Components: any;
declare const Cc: any;
declare const APP_SHUTDOWN: number;

declare global {
  interface Window {
    rootURI?: string;
  }

  interface ZoteroReader {
    registerEventListener(eventType: string, handler: (...args: unknown[]) => void, id: string): void;
    unregisterEventListener(eventType: string, handler: (...args: unknown[]) => void, id: string): void;
  }

  namespace Zotero {
    interface Reader {
      registerEventListener(eventType: string, handler: (...args: unknown[]) => void, id: string): void;
      unregisterEventListener(eventType: string, handler: (...args: unknown[]) => void, id: string): void;
    }
    const Reader: ZoteroReader;
  }
}

export {};
