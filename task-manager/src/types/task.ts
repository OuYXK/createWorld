export interface SubTask {
  id: string
  title: string
  completed: boolean
}

export interface TaskTheme {
  id: string
  name: string
  color: string
}

export type TaskType = 'daily' | 'long-term'
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'ended'

export interface PauseRecord {
  id: string
  startTime: number
  endTime: number | null
  reason: string
}

export interface Task {
  id: string
  title: string
  themeId: string
  details: string
  subTasks: SubTask[]
  type: TaskType
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  reminderMinutesBefore: number
  status: TaskStatus
  pauseRecords: PauseRecord[]
  actualStartTime: number | null
  actualEndTime: number | null
  totalPausedTime: number
  createdAt: number
  updatedAt: number
}

export interface TaskStats {
  date: string
  tasks: Task[]
  totalTasks: number
  completedTasks: number
  totalDuration: number
  completedDuration: number
  themeDistribution: { themeId: string; themeName: string; color: string; duration: number }[]
  pauseCount: number
  totalPausedTime: number
}
