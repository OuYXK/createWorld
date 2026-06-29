Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let node_module = require("node:module");
let node_url = require("node:url");
let node_path = require("node:path");
node_path = __toESM(node_path);
//#region electron/main.ts
(0, node_module.createRequire)(require("url").pathToFileURL(__filename).href);
var __dirname$1 = node_path.default.dirname((0, node_url.fileURLToPath)(require("url").pathToFileURL(__filename).href));
process.env.APP_ROOT = node_path.default.join(__dirname$1, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = node_path.default.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = node_path.default.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? node_path.default.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var mainWindow = null;
var reminderWindows = /* @__PURE__ */ new Map();
var taskWindows = /* @__PURE__ */ new Map();
function createWindow() {
	mainWindow = new electron.BrowserWindow({
		icon: node_path.default.join(process.env.VITE_PUBLIC, "favicon.svg"),
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		webPreferences: {
			preload: node_path.default.join(__dirname$1, "preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (VITE_DEV_SERVER_URL) mainWindow.loadURL(VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(node_path.default.join(RENDERER_DIST, "index.html"));
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}
electron.app.whenReady().then(() => {
	createWindow();
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("show-reminder", (_event, data) => {
	const { taskId, taskTitle, type, message } = data;
	const windowKey = `reminder-${taskId}-${type}`;
	if (reminderWindows.has(windowKey)) {
		reminderWindows.get(windowKey)?.focus();
		return;
	}
	const reminderWin = new electron.BrowserWindow({
		width: 360,
		height: 200,
		frame: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		resizable: false,
		movable: true,
		x: 100,
		y: 100,
		webPreferences: {
			preload: node_path.default.join(__dirname$1, "preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	const queryParams = new URLSearchParams({
		taskId,
		taskTitle,
		type,
		message
	});
	if (VITE_DEV_SERVER_URL) reminderWin.loadURL(`${VITE_DEV_SERVER_URL}#/reminder?${queryParams.toString()}`);
	else reminderWin.loadFile(node_path.default.join(RENDERER_DIST, "index.html"), { hash: `/reminder?${queryParams.toString()}` });
	reminderWindows.set(windowKey, reminderWin);
	reminderWin.on("closed", () => {
		reminderWindows.delete(windowKey);
	});
	if (electron.Notification.isSupported()) new electron.Notification({
		title: taskTitle,
		body: message
	}).show();
});
electron.ipcMain.handle("close-reminder", (_event, data) => {
	const { taskId, type } = data;
	const windowKey = `reminder-${taskId}-${type}`;
	const win = reminderWindows.get(windowKey);
	if (win) {
		win.close();
		reminderWindows.delete(windowKey);
	}
});
electron.ipcMain.handle("open-task-window", (_event, data) => {
	const { taskId } = data;
	if (taskWindows.has(taskId)) {
		taskWindows.get(taskId)?.focus();
		return;
	}
	const taskWin = new electron.BrowserWindow({
		width: 500,
		height: 600,
		frame: true,
		alwaysOnTop: true,
		resizable: true,
		minimizable: false,
		title: "任务进行中",
		webPreferences: {
			preload: node_path.default.join(__dirname$1, "preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	const queryParams = new URLSearchParams({ taskId });
	if (VITE_DEV_SERVER_URL) taskWin.loadURL(`${VITE_DEV_SERVER_URL}#/task-running?${queryParams.toString()}`);
	else taskWin.loadFile(node_path.default.join(RENDERER_DIST, "index.html"), { hash: `/task-running?${queryParams.toString()}` });
	taskWindows.set(taskId, taskWin);
	taskWin.on("closed", () => {
		taskWindows.delete(taskId);
		if (mainWindow) mainWindow.webContents.send("task-window-closed", { taskId });
	});
});
electron.ipcMain.handle("close-task-window", (_event, data) => {
	const { taskId } = data;
	const win = taskWindows.get(taskId);
	if (win) {
		win.close();
		taskWindows.delete(taskId);
	}
});
electron.ipcMain.handle("notify-main-window", (_event, data) => {
	if (mainWindow) mainWindow.webContents.send(data.event, data.payload);
});
//#endregion
exports.MAIN_DIST = MAIN_DIST;
exports.RENDERER_DIST = RENDERER_DIST;
exports.VITE_DEV_SERVER_URL = VITE_DEV_SERVER_URL;
