<template>
  <div class="reminder-window" :class="type">
    <div class="reminder-icon">
      {{ type === 'start' ? '▶' : '⏸' }}
    </div>
    <div class="reminder-content">
      <div class="reminder-title">{{ type === 'start' ? '任务开始提醒' : '任务结束提醒' }}</div>
      <div class="task-name">{{ taskTitle }}</div>
      <div class="reminder-message">{{ message }}</div>
    </div>
    <div class="reminder-actions">
      <button v-if="type === 'start'" class="action-btn primary" @click="handleStartTask">
        开始任务
      </button>
      <button class="action-btn" @click="handleClose">
        知道了
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
const taskTitle = computed(() => params.taskTitle || '任务')
const type = computed(() => (params.type as 'start' | 'end') || 'start')
const message = computed(() => params.message || '')

const handleClose = () => {
  if (window.electronAPI) {
    window.electronAPI.closeReminder({
      taskId: taskId.value,
      type: type.value,
    })
  }
}

const handleStartTask = () => {
  if (window.electronAPI) {
    window.electronAPI.notifyMainWindow({
      event: 'start-task',
      payload: { taskId: taskId.value },
    })
    window.electronAPI.openTaskWindow({ taskId: taskId.value })
  }
  handleClose()
}
</script>

<style scoped>
.reminder-window {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
  border-radius: 12px;
  cursor: move;
}

.reminder-window.start {
  border-top: 4px solid #10b981;
}

.reminder-window.end {
  border-top: 4px solid #f59e0b;
}

.reminder-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.start .reminder-icon {
  color: #10b981;
}

.end .reminder-icon {
  color: #f59e0b;
}

.reminder-content {
  flex: 1;
}

.reminder-title {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.task-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.reminder-message {
  font-size: 13px;
  color: #4b5563;
}

.reminder-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #e5e7eb;
  color: #374151;
}

.action-btn:hover {
  background: #d1d5db;
}

.action-btn.primary {
  background: #10b981;
  color: white;
}

.action-btn.primary:hover {
  background: #059669;
}
</style>
