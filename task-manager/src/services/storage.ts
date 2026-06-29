import type { Task, TaskTheme } from '@/types/task'

const STORAGE_KEYS = {
  TASKS: 'task_manager_tasks',
  THEMES: 'task_manager_themes',
}

const defaultThemes: TaskTheme[] = [
  { id: 'theme-1', name: '工作', color: '#3B82F6' },
  { id: 'theme-2', name: '学习', color: '#10B981' },
  { id: 'theme-3', name: '生活', color: '#F59E0B' },
  { id: 'theme-4', name: '运动', color: '#EF4444' },
  { id: 'theme-5', name: '娱乐', color: '#8B5CF6' },
]

export function getThemes(): TaskTheme[] {
  const stored = localStorage.getItem(STORAGE_KEYS.THEMES)
  if (stored) {
    return JSON.parse(stored)
  }
  saveThemes(defaultThemes)
  return defaultThemes
}

export function saveThemes(themes: TaskTheme[]): void {
  localStorage.setItem(STORAGE_KEYS.THEMES, JSON.stringify(themes))
}

export function addTheme(theme: TaskTheme): TaskTheme[] {
  const themes = getThemes()
  themes.push(theme)
  saveThemes(themes)
  return themes
}

export function getTasks(): Task[] {
  const stored = localStorage.getItem(STORAGE_KEYS.TASKS)
  if (stored) {
    return JSON.parse(stored)
  }
  return []
}

export function saveTasks(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks))
}

export function addTask(task: Task): Task[] {
  const tasks = getTasks()
  tasks.push(task)
  saveTasks(tasks)
  return tasks
}

export function updateTask(updatedTask: Task): Task[] {
  const tasks = getTasks()
  const index = tasks.findIndex(t => t.id === updatedTask.id)
  if (index !== -1) {
    tasks[index] = { ...updatedTask, updatedAt: Date.now() }
    saveTasks(tasks)
  }
  return tasks
}

export function deleteTask(taskId: string): Task[] {
  const tasks = getTasks().filter(t => t.id !== taskId)
  saveTasks(tasks)
  return tasks
}

export function getTaskById(taskId: string): Task | undefined {
  return getTasks().find(t => t.id === taskId)
}

export function getTasksByDate(date: string): Task[] {
  return getTasks().filter(task => {
    if (task.type === 'daily') {
      return task.startDate === date
    } else {
      return task.startDate <= date && task.endDate >= date
    }
  })
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
