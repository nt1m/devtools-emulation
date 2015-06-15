"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;
const devtools = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools.require;
const {Promise: promise} = Cu.import("resource://gre/modules/Promise.jsm", {});
const Editor  = devtools("devtools/sourceeditor/editor");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/responsivedesign.jsm");
Cu.import("resource:///modules/devtools/DeveloperToolbar.jsm");

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
	destroy() {
		this.win = this.doc = this.toolbox = this.mm = null;
		this.resetDevice();
	},

	init() {
		this.UAInput = this.doc.querySelector("#user-agent-input");
		this.UAInput.addEventListener("change", () => {
			this.switchUA(this.UAInput.value);
		});
		this.getOldUA();

		this.PixelRatioInput = this.doc.querySelector("#pixel-ratio-input");
		this.PixelRatioInput.addEventListener("change", () => {
			this.setPixelRatio(this.PixelRatioInput.value);
		});

		this.mediaSelect = this.doc.querySelector("#media-select");
		this.populateMediaSelect();
		this.mediaSelect.addEventListener("change", () => {
			this.setMediaQuery(this.mediaSelect.value);
		});

		this.devicesSelect = this.doc.querySelector("#devices-select");
		this.devicesSelect.addEventListener("change", () => {
			this.setDevice(this.devicesSelect.options[this.devicesSelect.selectedIndex]);
		});
		this.populateDevicesList();
	},

	populateDevicesList() {
		devtools("devtools/shared/devices").GetDevices().then(devices => {
			for (let type of devices.TYPES) {
				let optgroup = this.doc.createElement("optgroup");
				optgroup.label = type.charAt(0).toUpperCase() + type.slice(1);
				this.devicesSelect.appendChild(optgroup);
				for (let device of devices[type]) {
					this.appendDeviceOption(device, optgroup);
				}
			}
		});
	},

	appendDeviceOption(device, optgroup) {
		let option = this.doc.createElement("option");
		option.textContent = device.name;
		for (let data in device) {
			option.dataset[data] = device[data];
		}
		optgroup.appendChild(option);
	},

	setDevice(option) {
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

	resetDevice() {
		let tab = this.target.tab;
		if (ResponsiveUIManager.isActiveForTab(tab)) {
			ResponsiveUIManager.toggle(tab.ownerGlobal, tab);
		}
		if (this.isUASpoofed) {
			this.resetUA();
		}
		this.resetPixelRatio();
	},

	populateMediaSelect() {
		let values = ["braille", "embossed", "handheld", "print", "projection",
					  "screen", "speech", "tty", "tv"];
		let defaultOption = this.doc.createElement("option");
		defaultOption.innerHTML = "Default";
		defaultOption.value = "";
		this.mediaSelect.appendChild(defaultOption);

		for (let value of values) {
			let option = this.doc.createElement("option");
			option.value = option.innerHTML = value;
			this.mediaSelect.appendChild(option);
		}
	},

	setMediaQuery(value) {
		let command;
		if (!value || value == "") {
			command = "media reset";
		}
		else {
			command = "media emulate " + value;
		}
		CommandUtils.createRequisition(this.target, {
			environment: CommandUtils.createEnvironment(this, "target")
		}).then(requisition => {
			requisition.updateExec(command);
		});
	},

	setPixelRatio(value) {
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

	resetPixelRatio() {
		this.PixelRatioInput.value = "";
		let win = this.target.tab.ownerGlobal;
		let fullzoom = winl.FullZoom;
		fullzoom._removePref(win.gBrowser.selectedBrowser);
	},

	getOldUA() {
		if (Services.prefs.getPrefType(UA_PREF) == 0) {
			this.oldUA = this.win.navigator.userAgent;
			this.isUASpoofedByDefault = false;
		}
		else {
			this.oldUA = this.prefs.get(UA_PREF, false);
			this.isUASpoofedByDefault = true;
		}
		this.UAInput.placeholder = this.oldUA;
	},

	switchUA(value) {
		if (value == "") {
			this.resetUA();
			return;
		}
		this.prefs.set(UA_PREF, value, false);
		this.UAInput.value = value;
		this.isUASpoofed = true;
		this.target.activeTab.reload();
	},

	resetUA() {
		if (this.isUASpoofedByDefault) {
			this.prefs.set(UA_PREF, this.oldUA, false);
		}
		else {
			Services.prefs.clearUserPref(UA_PREF);
		}
		this.UAInput.value = "";
		this.isUASpoofed = false;
		this.target.activeTab.reload();
	},

	prefs: {
		get(pref, HasPrefix = true) {
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
		set(pref, value, HasPrefix = true) {
			if(HasPrefix) {
				var prefname = prefPrefix + pref;
			}
			else {
				var prefname = pref;
			}
			Services.prefs.setCharPref(prefname, value);
		},
		enablePrefSync(pref) {
			let syncPrefPrefix = "services.sync.prefs.sync.";
			Services.prefs.setBoolPref(syncPrefPrefix + prefPrefix + pref, true)
		}
	}
};
