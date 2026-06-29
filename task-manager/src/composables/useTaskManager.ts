import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Task, TaskTheme, TaskStatus, PauseRecord, SubTask } from '@/types/task'
import {
  getTasks,
  addTask as storageAddTask,
  updateTask as storageUpdateTask,
  deleteTask as storageDeleteTask,
  getThemes,
  addTheme as storageAddTheme,
  generateId,
  getTaskById,
} from '@/services/storage'

const tasks = ref<Task[]>([])
const themes = ref<TaskTheme[]>([])
let reminderTimer: number | null = null
const remindedTasks = ref<Set<string>>(new Set())

export function useTaskManager() {
  const loadData = () => {
    tasks.value = getTasks()
    themes.value = getThemes()
  }

  const today = computed(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })

  const todayTasks = computed(() => {
    return tasks.value.filter(task => {
      if (task.type === 'daily') {
        return task.startDate === today.value
      } else {
        return task.startDate <= today.value && task.endDate >= today.value
      }
    }).sort((a, b) => a.startTime.localeCompare(b.startTime))
  })

  const longTermTasks = computed(() => {
    return tasks.value.filter(task => task.type === 'long-term')
  })

  const getThemeById = (themeId: string): TaskTheme | undefined => {
    return themes.value.find(t => t.id === themeId)
  }

  const createTask = (data: {
    title: string
    themeId: string
    details: string
    subTasks: { title: string }[]
    type: 'daily' | 'long-term'
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    reminderMinutesBefore: number
  }): Task => {
    const now = Date.now()
    const task: Task = {
      id: generateId(),
      title: data.title,
      themeId: data.themeId,
      details: data.details,
      subTasks: data.subTasks.map(st => ({
        id: generateId(),
        title: st.title,
        completed: false,
      })),
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime,
      endTime: data.endTime,
      reminderMinutesBefore: data.reminderMinutesBefore,
      status: 'pending',
      pauseRecords: [],
      actualStartTime: null,
      actualEndTime: null,
      totalPausedTime: 0,
      createdAt: now,
      updatedAt: now,
    }
    tasks.value = storageAddTask(task)
    return task
  }

  const addNewTheme = (name: string, color: string): TaskTheme => {
    const newTheme: TaskTheme = {
      id: generateId(),
      name,
      color,
    }
    themes.value = storageAddTheme(newTheme)
    return newTheme
  }

  const updateTaskStatus = (taskId: string, status: TaskStatus): void => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = status
      if (status === 'running' && !task.actualStartTime) {
        task.actualStartTime = Date.now()
      }
      if (status === 'completed' || status === 'ended' || status === 'cancelled') {
        task.actualEndTime = Date.now()
      }
      tasks.value = storageUpdateTask(task)
    }
  }

  const toggleSubTask = (taskId: string, subTaskId: string): void => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      const subTask = task.subTasks.find(st => st.id === subTaskId)
      if (subTask) {
        subTask.completed = !subTask.completed
        tasks.value = storageUpdateTask(task)
      }
    }
  }

  const pauseTask = (taskId: string, reason: string): void => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task && task.status === 'running') {
      const pauseRecord: PauseRecord = {
        id: generateId(),
        startTime: Date.now(),
        endTime: null,
        reason,
      }
      task.pauseRecords.push(pauseRecord)
      task.status = 'paused'
      tasks.value = storageUpdateTask(task)
    }
  }

  const resumeTask = (taskId: string): void => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task && task.status === 'paused') {
      const currentPause = task.pauseRecords.find(pr => pr.endTime === null)
      if (currentPause) {
        currentPause.endTime = Date.now()
        task.totalPausedTime += currentPause.endTime - currentPause.startTime
      }
      task.status = 'running'
      tasks.value = storageUpdateTask(task)
    }
  }

  const removeTask = (taskId: string): void => {
    tasks.value = storageDeleteTask(taskId)
  }

  const getTaskDurationMinutes = (task: Task): number => {
    const [startH, startM] = task.startTime.split(':').map(Number)
    const [endH, endM] = task.endTime.split(':').map(Number)
    return (endH * 60 + endM) - (startH * 60 + startM)
  }

  const checkReminders = () => {
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const todayStr = now.toISOString().split('T')[0]

    todayTasks.value.forEach(task => {
      if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'ended') {
        return
      }

      const [startH, startM] = task.startTime.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const reminderStartKey = `${task.id}-start-${todayStr}`

      if (!remindedTasks.value.has(reminderStartKey)) {
        const diffMinutes = startMinutes - nowMinutes
        if (diffMinutes <= task.reminderMinutesBefore && diffMinutes >= 0) {
          if (window.electronAPI) {
            window.electronAPI.showReminder({
              taskId: task.id,
              taskTitle: task.title,
              type: 'start',
              message: `任务即将开始，还有 ${diffMinutes} 分钟`,
            })
          }
          remindedTasks.value.add(reminderStartKey)
        }
      }

      const [endH, endM] = task.endTime.split(':').map(Number)
      const endMinutes = endH * 60 + endM
      const reminderEndKey = `${task.id}-end-${todayStr}`

      if (!remindedTasks.value.has(reminderEndKey)) {
        const diffMinutes = endMinutes - nowMinutes
        if (diffMinutes <= task.reminderMinutesBefore && diffMinutes >= 0) {
          if (window.electronAPI) {
            window.electronAPI.showReminder({
              taskId: task.id,
              taskTitle: task.title,
              type: 'end',
              message: `任务即将结束，还有 ${diffMinutes} 分钟`,
            })
          }
          remindedTasks.value.add(reminderEndKey)
        }
      }
    })
  }

  const startReminderCheck = () => {
    if (reminderTimer) return
    reminderTimer = window.setInterval(checkReminders, 30000)
    checkReminders()
  }

  const stopReminderCheck = () => {
    if (reminderTimer) {
      clearInterval(reminderTimer)
      reminderTimer = null
    }
  }

  const getDailyStats = (date: string) => {
    const dayTasks = tasks.value.filter(task => {
      if (task.type === 'daily') {
        return task.startDate === date
      } else {
        return task.startDate <= date && task.endDate >= date
      }
    })

    const themeMap = new Map<string, { themeName: string; color: string; duration: number }>()

    let totalDuration = 0
    let completedDuration = 0
    let pauseCount = 0
    let totalPausedTime = 0

    dayTasks.forEach(task => {
      const duration = getTaskDurationMinutes(task)
      totalDuration += duration

      if (task.status === 'completed') {
        completedDuration += duration
      }

      const theme = getThemeById(task.themeId)
      if (theme) {
        const existing = themeMap.get(task.themeId)
        if (existing) {
          existing.duration += duration
        } else {
          themeMap.set(task.themeId, {
            themeName: theme.name,
            color: theme.color,
            duration,
          })
        }
      }

      pauseCount += task.pauseRecords.length
      totalPausedTime += task.totalPausedTime
    })

    const themeDistribution = Array.from(themeMap.entries()).map(([themeId, data]) => ({
      themeId,
      ...data,
    }))

    return {
      date,
      tasks: dayTasks,
      totalTasks: dayTasks.length,
      completedTasks: dayTasks.filter(t => t.status === 'completed').length,
      totalDuration,
      completedDuration,
      themeDistribution,
      pauseCount,
      totalPausedTime,
    }
  }

  onMounted(() => {
    loadData()
    startReminderCheck()
  })

  onUnmounted(() => {
    stopReminderCheck()
  })

  return {
    tasks,
    themes,
    todayTasks,
    longTermTasks,
    today,
    getThemeById,
    createTask,
    addNewTheme,
    updateTaskStatus,
    toggleSubTask,
    pauseTask,
    resumeTask,
    removeTask,
    getTaskDurationMinutes,
    getDailyStats,
    getTaskById: (id: string) => tasks.value.find(t => t.id === id),
    startReminderCheck,
    stopReminderCheck,
    loadData,
  }
}
