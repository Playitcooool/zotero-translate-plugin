var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await Zotero.initializationPromise;

  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "chrome/content/"],
  ]);

  const ctx = {
    rootURI,
  };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    `${rootURI}chrome/content/scripts/__addonRef__.js`,
    ctx,
  );

  // Call onStartup hook after script is loaded
  if (ctx.ZoteroTranslate?.hooks?.onStartup) {
    await ctx.ZoteroTranslate.hooks.onStartup();
  }
}

async function onMainWindowLoad({ window }, reason) {
  Zotero.ZoteroTranslate?.hooks?.onMainWindowLoad?.(window);
}

async function onMainWindowUnload({ window }, reason) {
  Zotero.ZoteroTranslate?.hooks?.onMainWindowUnload?.(window);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Zotero.ZoteroTranslate?.hooks?.onShutdown?.();

  Cc["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .flushBundles();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
