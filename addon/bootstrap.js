var chromeHandle;
var windowObserver;

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

  // Manually call onMainWindowLoad for the current main Zotero window
  // since Zotero 7 may not call the bootstrap function automatically
  const wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
    .getService(Components.interfaces.nsIWindowMediator);
  const mainWindow = wm.getMostRecentWindow("navigator:browser");
  if (mainWindow) {
    const url = mainWindow.location?.href || "";
    Zotero.log("ZoteroTranslate: Most recent window: " + url);
    if (url.includes("zotero") && !url.includes("devtools") && !url.includes("preferences")) {
      Zotero.log("ZoteroTranslate: Calling onMainWindowLoad for main Zotero window");
      Zotero.ZoteroTranslate?.hooks?.onMainWindowLoad?.(mainWindow);
    }
  }

  // Listen for new windows using observer service
  windowObserver = {
    observe: function(subject, topic, data) {
      if (topic === "domwindowopened") {
        const win = subject;
        win.addEventListener("load", function() {
          // Only call onMainWindowLoad for Zotero's main window
          const url = win.location?.href || "";
          Zotero.log("ZoteroTranslate: New window loaded: " + url);
          if (url.includes("zotero") && !url.includes("devtools") && !url.includes("preferences")) {
            Zotero.log("ZoteroTranslate: Calling onMainWindowLoad for main Zotero window");
            Zotero.ZoteroTranslate?.hooks?.onMainWindowLoad?.(win);
          }
        }, { once: true });
      }
    }
  };
  Services.obs.addObserver(windowObserver, "domwindowopened", false);
}

async function onMainWindowLoad({ window }, reason) {
  Zotero.log('ZoteroTranslate: bootstrap.onMainWindowLoad called');
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

  if (windowObserver) {
    Services.obs.removeObserver(windowObserver, "domwindowopened");
    windowObserver = null;
  }

  Cc["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .flushBundles();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
