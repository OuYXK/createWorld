export interface ElectronAPI {
  showReminder: (data: { taskId: string; taskTitle: string; type: 'start' | 'end'; message: string }) => Promise<void>
  closeReminder: (data: { taskId: string; type: 'start' | 'end' }) => Promise<void>
  openTaskWindow: (data: { taskId: string }) => Promise<void>
  closeTaskWindow: (data: { taskId: string }) => Promise<void>
  notifyMainWindow: (data: { event: string; payload: any }) => Promise<void>
  onTaskWindowClosed: (callback: (data: { taskId: string }) => void) => () => void
  onTaskUpdated: (callback: (data: any) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
