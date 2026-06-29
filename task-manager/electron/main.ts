import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let mainWindow: BrowserWindow | null = null
let reminderWindows: Map<string, BrowserWindow> = new Map()
let taskWindows: Map<string, BrowserWindow> = new Map()

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.svg'),
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('show-reminder', (_event, data: { taskId: string; taskTitle: string; type: 'start' | 'end'; message: string }) => {
  const { taskId, taskTitle, type, message } = data
  const windowKey = `reminder-${taskId}-${type}`

  if (reminderWindows.has(windowKey)) {
    reminderWindows.get(windowKey)?.focus()
    return
  }

  const reminderWin = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const queryParams = new URLSearchParams({
    taskId,
    taskTitle,
    type,
    message,
  })

  if (VITE_DEV_SERVER_URL) {
    reminderWin.loadURL(`${VITE_DEV_SERVER_URL}#/reminder?${queryParams.toString()}`)
  } else {
    reminderWin.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/reminder?${queryParams.toString()}`,
    })
  }

  reminderWindows.set(windowKey, reminderWin)

  reminderWin.on('closed', () => {
    reminderWindows.delete(windowKey)
  })

  if (Notification.isSupported()) {
    new Notification({
      title: taskTitle,
      body: message,
    }).show()
  }
})

ipcMain.handle('close-reminder', (_event, data: { taskId: string; type: 'start' | 'end' }) => {
  const { taskId, type } = data
  const windowKey = `reminder-${taskId}-${type}`
  const win = reminderWindows.get(windowKey)
  if (win) {
    win.close()
    reminderWindows.delete(windowKey)
  }
})

ipcMain.handle('open-task-window', (_event, data: { taskId: string }) => {
  const { taskId } = data

  if (taskWindows.has(taskId)) {
    taskWindows.get(taskId)?.focus()
    return
  }

  const taskWin = new BrowserWindow({
    width: 500,
    height: 600,
    frame: true,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    title: '任务进行中',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const queryParams = new URLSearchParams({ taskId })

  if (VITE_DEV_SERVER_URL) {
    taskWin.loadURL(`${VITE_DEV_SERVER_URL}#/task-running?${queryParams.toString()}`)
  } else {
    taskWin.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/task-running?${queryParams.toString()}`,
    })
  }

  taskWindows.set(taskId, taskWin)

  taskWin.on('closed', () => {
    taskWindows.delete(taskId)
    if (mainWindow) {
      mainWindow.webContents.send('task-window-closed', { taskId })
    }
  })
})

ipcMain.handle('close-task-window', (_event, data: { taskId: string }) => {
  const { taskId } = data
  const win = taskWindows.get(taskId)
  if (win) {
    win.close()
    taskWindows.delete(taskId)
  }
})

ipcMain.handle('notify-main-window', (_event, data: { event: string; payload: any }) => {
  if (mainWindow) {
    mainWindow.webContents.send(data.event, data.payload)
  }
})
