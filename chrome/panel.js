"use strict";

// Import stuff
const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;
const devtools = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools.require;
const {Promise: promise} = Cu.import("resource://gre/modules/Promise.jsm", {});
const Editor  = devtools("devtools/sourceeditor/editor");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/responsivedesign.jsm");

// Constants
const prefPrefix = "extensions.devtools-emulation.";
const UA_PREF = "general.useragent.override";

this.EXPORTED_SYMBOLS = ["EmulationPanel"];

function EmulationPanel(win, toolbox) {
	this.win = win;
	this.doc = this.win.document;
	this.toolbox = toolbox;
	this.target = this.toolbox.target;
	
	this.switchUA = this.switchUA.bind(this);

	this.init();
}

EmulationPanel.prototype = {
	// Destroy function
	destroy: function() {
		this.win = this.doc = this.toolbox = this.mm = null;
		this.resetDevice();
	},

	init: function() {
		this.UAInput = this.doc.querySelector("#user-agent-input");
		this.UAInput.addEventListener("change", () => {
			this.switchUA(this.UAInput.value);
		});
		this.getOldUA();

		this.PixelRatioInput = this.doc.querySelector("#pixel-ratio-input");
		this.PixelRatioInput.addEventListener("change", () => {
			this.setPixelRatio(this.PixelRatioInput.value);
		});

		this.devicesSelect = this.doc.querySelector("#devices-select");
		this.devicesSelect.addEventListener("change", () => {
			this.setDevice(this.devicesSelect.options[this.devicesSelect.selectedIndex]);
		});
		this.populateDevicesList();
		this.win.console.log(this.target);
	},

	populateDevicesList: function() {
		let devices = devtools("devtools/shared/devices").Devices;
		for (let type of devices.Types) {
			let optgroup = this.devicesSelect.querySelector("optgroup[data-devices='" + type + "']");
			for (let device of devices.FirefoxOS[type]) {
				this.appendDeviceOption(device, optgroup);
			}
			for (let device of devices.Others[type]) {
				this.appendDeviceOption(device, optgroup);
			}
		}
	},

	appendDeviceOption: function(device, optgroup) {
		let option = this.doc.createElement("option");
		option.textContent = device.name;
		for (let data in device) {
			option.dataset[data] = device[data];
		}
		optgroup.appendChild(option);
	},

	setDevice: function(option) {
		if (option.id == "default-device-option") {
			this.resetDevice();
			return;
		}
		let tab = this.target.tab;
		let XULWin = tab.ownerGlobal;
		let props = option.dataset;
		if (!ResponsiveUIManager.isActiveForTab(tab)) {
			ResponsiveUIManager.toggle(XULWin, tab);
		}
		ResponsiveUIManager.getResponsiveUIForTab(tab).setSize(props.width, props.height);

		this.switchUA(props.userAgent);
		this.setPixelRatio(props.pixelRatio);
	},

	resetDevice: function() {
		let tab = this.target.tab;
		if (ResponsiveUIManager.isActiveForTab(tab)) {
			ResponsiveUIManager.toggle(tab.ownerGlobal, tab);
		}
		this.resetUA();
		this.resetPixelRatio();
	},

	setPixelRatio: function(value) {
		if (value == "") {
			this.resetPixelRatio();
			return;
		}
		this.PixelRatioInput.value = value;
		value = parseInt(value);
		// This won't work properly if the devtools are zoomed in
		let pixelRatio = value / this.win.devicePixelRatio;
		let win = this.target.tab.ownerGlobal;
		let fullzoom = win.FullZoom;
		fullzoom._applyPrefToZoom(value, win.gBrowser.selectedBrowser);
	},

	resetPixelRatio: function() {
		this.PixelRatioInput.value = "";
		let win = this.target.tab.ownerGlobal;
		let fullzoom = winl.FullZoom;
		fullzoom._removePref(win.gBrowser.selectedBrowser);
	},

	getOldUA: function() {
		if (Services.prefs.getPrefType(UA_PREF) == 0) {
			this.oldUA = this.win.navigator.userAgent;
			this.isUASpoofed = false;
		}
		else {
			this.oldUA = this.storage.get(UA_PREF, false);
			this.isUASpoofed = true;
		}
		this.UAInput.placeholder = this.oldUA;
	},

	switchUA: function(value) {
		if (value == "") {
			this.resetUA();
			return;
		}
		this.storage.set(UA_PREF, value, false);
		this.UAInput.value = value;
		this.target.activeTab.reload();
	},

	resetUA: function() {
		if (this.isUASpoofed) {
			this.storage.set(UA_PREF, this.oldUA, false);
		}
		else {
			Services.prefs.clearUserPref(UA_PREF);
		}
		this.UAInput.value = "";
		this.target.activeTab.reload();
	},

	storage: {
		get: function(pref, HasPrefix = true) {
			if(HasPrefix) {
				var prefname = prefPrefix + pref;
			}
			else {
				var prefname = pref;
			}
			if(Services.prefs.getPrefType(prefname)) {
				Services.prefs.getCharPref(prefname);
			}
			else {
				Services.prefs.setCharPref(prefname, "");
				this.enablePrefSync(pref);
			}
			return Services.prefs.getCharPref(prefname);
		},
		set: function(pref, value, HasPrefix = true) {
			if(HasPrefix) {
				var prefname = prefPrefix + pref;
			}
			else {
				var prefname = pref;
			}
			Services.prefs.setCharPref(prefname, value);
		},
		enablePrefSync: function(pref) {
			let syncPrefPrefix = "services.sync.prefs.sync.";
			Services.prefs.setBoolPref(syncPrefPrefix + prefPrefix + pref, true)
		}
	}
};