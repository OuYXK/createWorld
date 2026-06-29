<template>
  <div class="task-running-window" v-if="task">
    <div class="window-header">
      <div class="header-left">
        <div class="theme-dot" :style="{ backgroundColor: theme?.color }"></div>
        <div class="header-text">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-theme-name" :style="{ color: theme?.color }">{{ theme?.name }}</div>
        </div>
      </div>
      <div class="header-right">
        <div class="timer-display">{{ formatTime(elapsedTime) }}</div>
      </div>
    </div>

    <div class="status-bar" :class="task.status">
      <span class="status-text">
        {{ task.status === 'running' ? '任务进行中...' : task.status === 'paused' ? '任务已暂停' : '任务状态' }}
      </span>
    </div>

    <div class="task-details-section" v-if="task.details">
      <h4>任务细节</h4>
      <p class="details-text">{{ task.details }}</p>
    </div>

    <div class="subtasks-section">
      <div class="section-header">
        <h4>子任务</h4>
        <span class="subtasks-progress">
          {{ completedSubTasks }}/{{ task.subTasks.length }}
        </span>
      </div>
      <div class="subtasks-list" v-if="task.subTasks.length > 0">
        <div
          v-for="subTask in task.subTasks"
          :key="subTask.id"
          class="subtask-item"
          :class="{ completed: subTask.completed }"
        >
          <label class="subtask-checkbox">
            <input
              type="checkbox"
              :checked="subTask.completed"
              @change="handleToggleSubTask(subTask.id)"
            />
            <span class="checkmark"></span>
          </label>
          <span class="subtask-title">{{ subTask.title }}</span>
        </div>
      </div>
      <div class="empty-subtasks" v-else>
        暂无子任务
      </div>
    </div>

    <div class="pause-records-section" v-if="task.pauseRecords.length > 0">
      <h4>暂停记录 ({{ task.pauseRecords.length }}次)</h4>
      <div class="pause-records-list">
        <div
          v-for="record in task.pauseRecords.slice().reverse()"
          :key="record.id"
          class="pause-record-item"
        >
          <div class="pause-reason">{{ record.reason }}</div>
          <div class="pause-time">
            {{ formatDateTime(record.startTime) }}
            <template v-if="record.endTime">
              - {{ formatDuration(record.endTime - record.startTime) }}
            </template>
            <template v-else>
              - 进行中
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="window-footer">
      <button
        v-if="task.status === 'running'"
        class="footer-btn pause"
        @click="showPauseDialog = true"
      >
        暂停任务
      </button>
      <button
        v-if="task.status === 'paused'"
        class="footer-btn resume"
        @click="handleResume"
      >
        继续任务
      </button>
      <button class="footer-btn complete" @click="handleComplete">
        完成任务
      </button>
      <button class="footer-btn close" @click="handleClose">
        关闭窗口
      </button>
    </div>

    <div class="pause-dialog-overlay" v-if="showPauseDialog" @click.self="showPauseDialog = false">
      <div class="pause-dialog">
        <h3>暂停任务</h3>
        <p>请填写暂停原因：</p>
        <div class="pause-presets">
          <button
            v-for="preset in pausePresets"
            :key="preset"
            :class="{ active: pauseReason === preset }"
            @click="pauseReason = preset"
          >
            {{ preset }}
          </button>
        </div>
        <textarea
          v-model="pauseReason"
          placeholder="请输入暂停原因..."
          rows="3"
        ></textarea>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="showPauseDialog = false">取消</button>
          <button class="btn-confirm" @click="handlePause">确认暂停</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Task, TaskTheme } from '@/types/task'
import { getTaskById, getThemes } from '@/services/storage'

const getQueryParams = () => {
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex === -1) return {}
  const queryString = hash.slice(queryIndex + 1)
  const params = new URLSearchParams(queryString)
  return Object.fromEntries(params.entries())
}

const params = getQueryParams()
const taskId = computed(() => params.taskId || '')

const task = ref<Task | null>(null)
const theme = ref<TaskTheme | undefined>(undefined)
const elapsedTime = ref(0)
const timerInterval = ref<number | null>(null)
const showPauseDialog = ref(false)
const pauseReason = ref('')

const pausePresets = [
  '休息一下',
  '需要处理其他事情',
  '临时会议',
  '身体不适',
  '等待他人回复',
]

const completedSubTasks = computed(() => {
  if (!task.value) return 0
  return task.value.subTasks.filter(st => st.completed).length
})

const loadTask = () => {
  const t = getTaskById(taskId.value)
  if (t) {
    task.value = { ...t }
    const themes = getThemes()
    theme.value = themes.find(th => th.id === task.value!.themeId)
    calculateElapsedTime()
  }
}

const calculateElapsedTime = () => {
  if (!task.value || !task.value.actualStartTime) {
    elapsedTime.value = 0
    return
  }

  let total = Date.now() - task.value.actualStartTime
  total -= task.value.totalPausedTime

  const currentPause = task.value.pauseRecords.find(pr => pr.endTime === null)
  if (currentPause) {
    total -= (Date.now() - currentPause.startTime)
  }

  elapsedTime.value = Math.max(0, total)
}

const startTimer = () => {
  if (timerInterval.value) return
  timerInterval.value = window.setInterval(() => {
    if (task.value && task.value.status === 'running') {
      calculateElapsedTime()
    }
  }, 1000)
}

const stopTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const formatDateTime = (timestamp: number): string => {
  const d = new Date(timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}分${seconds}秒`
}

const handleToggleSubTask = (subTaskId: string) => {
  if (!task.value) return
  const subTask = task.value.subTasks.find(st => st.id === subTaskId)
  if (subTask) {
    subTask.completed = !subTask.completed
    saveTask()
  }
}

const handlePause = () => {
  if (!task.value || !pauseReason.value.trim()) {
    alert('请填写暂停原因')
    return
  }

  const pauseRecord = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    startTime: Date.now(),
    endTime: null,
    reason: pauseReason.value.trim(),
  }

  task.value.pauseRecords.push(pauseRecord)
  task.value.status = 'paused'
  saveTask()
  showPauseDialog.value = false
  pauseReason.value = ''
}

const handleResume = () => {
  if (!task.value) return
  const currentPause = task.value.pauseRecords.find(pr => pr.endTime === null)
  if (currentPause) {
    currentPause.endTime = Date.now()
    task.value.totalPausedTime += currentPause.endTime - currentPause.startTime
  }
  task.value.status = 'running'
  saveTask()
}

const handleComplete = () => {
  if (!task.value) return
  if (confirm('确定要完成此任务吗？')) {
    task.value.status = 'completed'
    task.value.actualEndTime = Date.now()
    saveTask()
    notifyMainWindow()
  }
}

const handleClose = () => {
  if (window.electronAPI) {
    window.electronAPI.closeTaskWindow({ taskId: taskId.value })
  }
}

const saveTask = () => {
  if (!task.value) return
  const tasks = JSON.parse(localStorage.getItem('task_manager_tasks') || '[]')
  const index = tasks.findIndex((t: Task) => t.id === task.value!.id)
  if (index !== -1) {
    task.value.updatedAt = Date.now()
    tasks[index] = task.value
    localStorage.setItem('task_manager_tasks', JSON.stringify(tasks))
  }
  notifyMainWindow()
}

const notifyMainWindow = () => {
  if (window.electronAPI) {
    window.electronAPI.notifyMainWindow({
      event: 'task-updated',
      payload: { taskId: taskId.value },
    })
  }
}

onMounted(() => {
  loadTask()
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.task-running-window {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f9fafb;
}

.window-header {
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.task-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.task-theme-name {
  font-size: 12px;
  font-weight: 500;
}

.timer-display {
  font-size: 24px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: #10b981;
}

.status-bar {
  padding: 8px 20px;
  font-size: 13px;
  text-align: center;
}

.status-bar.running {
  background: #d1fae5;
  color: #059669;
}

.status-bar.paused {
  background: #fef3c7;
  color: #d97706;
}

.task-details-section,
.subtasks-section,
.pause-records-section {
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #f3f4f6;
}

.task-details-section h4,
.subtasks-section h4,
.pause-records-section h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.details-text {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  white-space: pre-wrap;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-header h4 {
  margin: 0;
}

.subtasks-progress {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.subtasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
  transition: background 0.2s;
}

.subtask-item:hover {
  background: #f3f4f6;
}

.subtask-item.completed .subtask-title {
  text-decoration: line-through;
  color: #9ca3af;
}

.subtask-checkbox {
  position: relative;
  display: inline-block;
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.subtask-checkbox input {
  opacity: 0;
  width: 0;
  height: 0;
}

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  background: white;
}

.subtask-checkbox input:checked ~ .checkmark {
  background: #10b981;
  border-color: #10b981;
}

.checkmark:after {
  content: '';
  position: absolute;
  display: none;
}

.subtask-checkbox input:checked ~ .checkmark:after {
  display: block;
}

.subtask-checkbox .checkmark:after {
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.subtask-title {
  font-size: 13px;
  color: #374151;
  flex: 1;
}

.empty-subtasks {
  text-align: center;
  padding: 20px;
  color: #9ca3af;
  font-size: 13px;
}

.pause-records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 100px;
  overflow-y: auto;
}

.pause-record-item {
  padding: 8px 10px;
  background: #fffbeb;
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
}

.pause-reason {
  font-size: 13px;
  color: #92400e;
  font-weight: 500;
  margin-bottom: 2px;
}

.pause-time {
  font-size: 11px;
  color: #b45309;
}

.window-footer {
  margin-top: auto;
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 8px;
}

.footer-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-btn.pause {
  background: #fef3c7;
  color: #b45309;
}

.footer-btn.pause:hover {
  background: #fde68a;
}

.footer-btn.resume {
  background: #d1fae5;
  color: #059669;
}

.footer-btn.resume:hover {
  background: #a7f3d0;
}

.footer-btn.complete {
  background: #dbeafe;
  color: #1d4ed8;
}

.footer-btn.complete:hover {
  background: #bfdbfe;
}

.footer-btn.close {
  background: #f3f4f6;
  color: #4b5563;
}

.footer-btn.close:hover {
  background: #e5e7eb;
}

.pause-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.pause-dialog {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 360px;
  max-width: 90%;
}

.pause-dialog h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.pause-dialog p {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #4b5563;
}

.pause-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.pause-presets button {
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: white;
  font-size: 11px;
  cursor: pointer;
  color: #4b5563;
}

.pause-presets button.active {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #b45309;
}

.pause-dialog textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

.pause-dialog textarea:focus {
  border-color: #f59e0b;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.btn-confirm {
  background: #f59e0b;
  color: white;
}
</style>
