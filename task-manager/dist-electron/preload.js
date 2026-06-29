let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	showReminder: (data) => electron.ipcRenderer.invoke("show-reminder", data),
	closeReminder: (data) => electron.ipcRenderer.invoke("close-reminder", data),
	openTaskWindow: (data) => electron.ipcRenderer.invoke("open-task-window", data),
	closeTaskWindow: (data) => electron.ipcRenderer.invoke("close-task-window", data),
	notifyMainWindow: (data) => electron.ipcRenderer.invoke("notify-main-window", data),
	onTaskWindowClosed: (callback) => {
		const listener = (_event, data) => callback(data);
		electron.ipcRenderer.on("task-window-closed", listener);
		return () => electron.ipcRenderer.removeListener("task-window-closed", listener);
	},
	onTaskUpdated: (callback) => {
		const listener = (_event, data) => callback(data);
		electron.ipcRenderer.on("task-updated", listener);
		return () => electron.ipcRenderer.removeListener("task-updated", listener);
	}
});
//#endregion
