import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  showReminder: (data: { taskId: string; taskTitle: string; type: 'start' | 'end'; message: string }) => Promise<void>
  closeReminder: (data: { taskId: string; type: 'start' | 'end' }) => Promise<void>
  openTaskWindow: (data: { taskId: string }) => Promise<void>
  closeTaskWindow: (data: { taskId: string }) => Promise<void>
  notifyMainWindow: (data: { event: string; payload: any }) => Promise<void>
  onTaskWindowClosed: (callback: (data: { taskId: string }) => void) => () => void
  onTaskUpdated: (callback: (data: any) => void) => () => void
}

const electronAPI: ElectronAPI = {
  showReminder: (data) => ipcRenderer.invoke('show-reminder', data),
  closeReminder: (data) => ipcRenderer.invoke('close-reminder', data),
  openTaskWindow: (data) => ipcRenderer.invoke('open-task-window', data),
  closeTaskWindow: (data) => ipcRenderer.invoke('close-task-window', data),
  notifyMainWindow: (data) => ipcRenderer.invoke('notify-main-window', data),
  onTaskWindowClosed: (callback) => {
    const listener = (_event: any, data: { taskId: string }) => callback(data)
    ipcRenderer.on('task-window-closed', listener)
    return () => ipcRenderer.removeListener('task-window-closed', listener)
  },
  onTaskUpdated: (callback) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('task-updated', listener)
    return () => ipcRenderer.removeListener('task-updated', listener)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
