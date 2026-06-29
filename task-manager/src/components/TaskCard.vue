<template>
  <div
    class="task-card"
    :class="{
      running: task.status === 'running',
      paused: task.status === 'paused',
      completed: task.status === 'completed',
      cancelled: task.status === 'cancelled',
      ended: task.status === 'ended',
    }"
  >
    <div class="task-header">
      <div class="task-theme" :style="{ backgroundColor: theme?.color }"></div>
      <div class="task-time">
        <span class="start-time">{{ task.startTime }}</span>
        <span class="time-sep">-</span>
        <span class="end-time">{{ task.endTime }}</span>
      </div>
      <div class="task-type-badge" v-if="task.type === 'long-term'">长期</div>
    </div>

    <div class="task-body">
      <h3 class="task-title">{{ task.title }}</h3>
      <div class="task-theme-name" :style="{ color: theme?.color }">{{ theme?.name }}</div>
      <p class="task-details" v-if="task.details">{{ task.details }}</p>

      <div class="subtasks-preview" v-if="task.subTasks.length > 0">
        <span class="subtasks-count">
          {{ task.subTasks.filter(st => st.completed).length }}/{{ task.subTasks.length }} 子任务
        </span>
        <div class="subtasks-progress-bar">
          <div
            class="subtasks-progress"
            :style="{
              width: `${(task.subTasks.filter(st => st.completed).length / task.subTasks.length) * 100}%`,
              backgroundColor: theme?.color,
            }"
          ></div>
        </div>
      </div>
    </div>

    <div class="task-status-bar">
      <span class="status-badge" :class="task.status">
        {{ statusText }}
      </span>
      <span class="reminder-info" v-if="task.reminderMinutesBefore > 0">
        ⏰ 提前{{ task.reminderMinutesBefore }}分钟
      </span>
    </div>

    <div class="task-actions">
      <button
        v-if="task.status === 'pending'"
        class="action-btn start"
        @click="$emit('start')"
      >
        开始
      </button>
      <button
        v-if="task.status === 'running'"
        class="action-btn pause"
        @click="$emit('pause')"
      >
        暂停
      </button>
      <button
        v-if="task.status === 'paused'"
        class="action-btn resume"
        @click="$emit('resume')"
      >
        继续
      </button>
      <button
        v-if="task.status === 'running' || task.status === 'paused'"
        class="action-btn complete"
        @click="$emit('complete')"
      >
        完成
      </button>
      <button
        v-if="task.status === 'pending'"
        class="action-btn edit"
        @click="$emit('edit')"
      >
        编辑
      </button>
      <button
        class="action-btn delete"
        @click="$emit('delete')"
      >
        删除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task, TaskTheme } from '@/types/task'

const props = defineProps<{
  task: Task
  theme?: TaskTheme
}>()

defineEmits<{
  (e: 'start'): void
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'complete'): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()

const statusText = computed(() => {
  const map: Record<string, string> = {
    pending: '待开始',
    running: '进行中',
    paused: '已暂停',
    completed: '已完成',
    cancelled: '已取消',
    ended: '已结束',
  }
  return map[props.task.status] || props.task.status
})
</script>

<style scoped>
.task-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #e5e7eb;
  transition: all 0.2s;
  position: relative;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.task-card.running {
  border-left-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%);
}

.task-card.paused {
  border-left-color: #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
}

.task-card.completed {
  border-left-color: #6b7280;
  opacity: 0.7;
}

.task-card.completed .task-title {
  text-decoration: line-through;
  color: #9ca3af;
}

.task-card.cancelled,
.task-card.ended {
  border-left-color: #9ca3af;
  opacity: 0.6;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.task-theme {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-time {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.time-sep {
  margin: 0 4px;
}

.task-type-badge {
  margin-left: auto;
  background: #f3e8ff;
  color: #7c3aed;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.task-body {
  margin-bottom: 12px;
}

.task-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.task-theme-name {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
}

.task-details {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.subtasks-preview {
  margin-top: 10px;
}

.subtasks-count {
  font-size: 12px;
  color: #6b7280;
  display: block;
  margin-bottom: 4px;
}

.subtasks-progress-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.subtasks-progress {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.task-status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.status-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.status-badge.pending {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.running {
  background: #d1fae5;
  color: #059669;
}

.status-badge.paused {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.completed {
  background: #e5e7eb;
  color: #6b7280;
}

.status-badge.cancelled,
.status-badge.ended {
  background: #f3f4f6;
  color: #9ca3af;
}

.reminder-info {
  font-size: 11px;
  color: #9ca3af;
}

.task-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  min-width: 60px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.start {
  background: #10b981;
  color: white;
}

.action-btn.start:hover {
  background: #059669;
}

.action-btn.pause {
  background: #f59e0b;
  color: white;
}

.action-btn.pause:hover {
  background: #d97706;
}

.action-btn.resume {
  background: #10b981;
  color: white;
}

.action-btn.resume:hover {
  background: #059669;
}

.action-btn.complete {
  background: #3b82f6;
  color: white;
}

.action-btn.complete:hover {
  background: #2563eb;
}

.action-btn.edit {
  background: #e5e7eb;
  color: #374151;
}

.action-btn.edit:hover {
  background: #d1d5db;
}

.action-btn.delete {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.delete:hover {
  background: #fecaca;
}
</style>
