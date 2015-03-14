"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");

XPCOMUtils.defineLazyGetter(this, "osString", () =>
	Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS);


XPCOMUtils.defineLazyGetter(this, "toolStrings", () =>
	Services.strings.createBundle("chrome://devtools-emulation/locale/strings.properties"));

XPCOMUtils.defineLazyGetter(this, "toolDefinition", () => ({
	id: "emulation",
	icon: "chrome://devtools-emulation/skin/images/tool-emulation.svg",
	invertIconForLightTheme: true,
	url: "chrome://devtools-emulation/content/panel.xhtml",
	label: toolStrings.GetStringFromName("emulation.label"),
	tooltip: toolStrings.GetStringFromName("emulation.tooltip"),

	isTargetSupported: function(target) {
		return true;
		// target.isLocalTab
	},

	build: function(iframeWindow, toolbox) {
		Cu.import("chrome://devtools-emulation/content/panel.js");
		return new EmulationPanel(iframeWindow, toolbox);
	}
}));

function startup() {
	gDevTools.registerTool(toolDefinition);
}

function shutdown() {
	gDevTools.unregisterTool(toolDefinition);
	Services.obs.notifyObservers(null, "startupcache-invalidate", null);
}

function install() {
}

function uninstall() {
}
