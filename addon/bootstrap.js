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
    _globalThis: globalThis,
  };
  globalThis.rootURI = rootURI;

  Services.scriptloader.loadSubScript(
    `${rootURI}chrome/content/scripts/__addonRef__.js`,
    ctx,
  );

  // Call onStartup hook after script is loaded
  // Script sets Zotero.ZoteroTranslate, not ctx.ZoteroTranslate
  if (Zotero.ZoteroTranslate?.hooks?.onStartup) {
    await Zotero.ZoteroTranslate.hooks.onStartup();
  }

  // Register preference pane directly in bootstrap
  try {
    Zotero.PreferencePanes.register({
      pluginID: 'zoterotranslate@plugin.local',
      src: rootURI + 'chrome/content/preferences.xhtml',
      label: 'Zotero Translate',
    });
  } catch (e) {
    Zotero.log(`Failed to register preference pane: ${e}`);
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
