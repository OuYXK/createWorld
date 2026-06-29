<template>
  <div class="stats-panel">
    <div class="stats-header">
      <h3>今日统计</h3>
      <div class="date-picker">
        <input type="date" v-model="selectedDate" @change="updateStats" />
      </div>
    </div>

    <div class="stats-cards">
      <div class="stat-card total">
        <div class="stat-value">{{ stats.totalTasks }}</div>
        <div class="stat-label">总任务数</div>
      </div>
      <div class="stat-card completed">
        <div class="stat-value">{{ stats.completedTasks }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card duration">
        <div class="stat-value">{{ formatDuration(stats.totalDuration) }}</div>
        <div class="stat-label">总时长</div>
      </div>
      <div class="stat-card completion">
        <div class="stat-value">{{ completionRate }}%</div>
        <div class="stat-label">完成率</div>
      </div>
    </div>

    <div class="stats-section">
      <h4>主题时间分布</h4>
      <div class="theme-distribution" v-if="stats.themeDistribution.length > 0">
        <div
          v-for="item in stats.themeDistribution"
          :key="item.themeId"
          class="theme-bar-item"
        >
          <div class="theme-label">
            <span class="theme-dot" :style="{ backgroundColor: item.color }"></span>
            <span class="theme-name">{{ item.themeName }}</span>
            <span class="theme-duration">{{ formatDuration(item.duration) }}</span>
          </div>
          <div class="theme-bar-bg">
            <div
              class="theme-bar-fill"
              :style="{
                width: `${(item.duration / stats.totalDuration) * 100}%`,
                backgroundColor: item.color,
              }"
            ></div>
          </div>
        </div>
      </div>
      <div class="empty-state" v-else>
        暂无数据
      </div>
    </div>

    <div class="stats-section">
      <h4>暂停记录</h4>
      <div class="pause-stats">
        <div class="pause-stat-item">
          <span class="pause-count">{{ stats.pauseCount }}</span>
          <span class="pause-label">次暂停</span>
        </div>
        <div class="pause-stat-item">
          <span class="pause-time">{{ formatDuration(Math.floor(stats.totalPausedTime / 60000)) }}</span>
          <span class="pause-label">总暂停时长</span>
        </div>
      </div>
    </div>

    <div class="stats-section">
      <h4>今日任务列表</h4>
      <div class="daily-tasks-list" v-if="stats.tasks.length > 0">
        <div
          v-for="task in stats.tasks"
          :key="task.id"
          class="daily-task-item"
          :class="task.status"
        >
          <div class="task-time-range">{{ task.startTime }} - {{ task.endTime }}</div>
          <div class="task-title">{{ task.title }}</div>
          <div class="task-status-dot" :class="task.status"></div>
        </div>
      </div>
      <div class="empty-state" v-else>
        今日暂无任务
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTaskManager } from '@/composables/useTaskManager'

const { getDailyStats } = useTaskManager()

const selectedDate = ref(new Date().toISOString().split('T')[0])
const stats = ref<any>({
  totalTasks: 0,
  completedTasks: 0,
  totalDuration: 0,
  completedDuration: 0,
  themeDistribution: [],
  pauseCount: 0,
  totalPausedTime: 0,
  tasks: [],
})

const completionRate = computed(() => {
  if (stats.value.totalTasks === 0) return 0
  return Math.round((stats.value.completedTasks / stats.value.totalTasks) * 100)
})

const updateStats = () => {
  stats.value = getDailyStats(selectedDate.value)
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
}

watch(selectedDate, () => {
  updateStats()
})

onMounted(() => {
  updateStats()
})

defineExpose({ updateStats })
</script>

<style scoped>
.stats-panel {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stats-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.date-picker input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}

.date-picker input:focus {
  border-color: #3b82f6;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 16px;
  border-radius: 10px;
  text-align: center;
}

.stat-card.total {
  background: #eff6ff;
}

.stat-card.completed {
  background: #ecfdf5;
}

.stat-card.duration {
  background: #fef3c7;
}

.stat-card.completion {
  background: #f3e8ff;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-card.total .stat-value {
  color: #2563eb;
}

.stat-card.completed .stat-value {
  color: #059669;
}

.stat-card.duration .stat-value {
  color: #d97706;
}

.stat-card.completion .stat-value {
  color: #7c3aed;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.stats-section {
  margin-bottom: 24px;
}

.stats-section:last-child {
  margin-bottom: 0;
}

.stats-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.theme-distribution {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theme-bar-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.theme-name {
  flex: 1;
  color: #374151;
  font-weight: 500;
}

.theme-duration {
  color: #6b7280;
  font-size: 12px;
}

.theme-bar-bg {
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}

.theme-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.pause-stats {
  display: flex;
  gap: 24px;
}

.pause-stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.pause-count,
.pause-time {
  font-size: 20px;
  font-weight: 700;
  color: #f59e0b;
}

.pause-label {
  font-size: 13px;
  color: #6b7280;
}

.daily-tasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.daily-task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
}

.daily-task-item.completed {
  opacity: 0.6;
}

.daily-task-item.completed .task-title {
  text-decoration: line-through;
}

.task-time-range {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

.task-title {
  flex: 1;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-status-dot.pending {
  background: #9ca3af;
}

.task-status-dot.running {
  background: #10b981;
}

.task-status-dot.paused {
  background: #f59e0b;
}

.task-status-dot.completed {
  background: #6b7280;
}

.task-status-dot.cancelled,
.task-status-dot.ended {
  background: #d1d5db;
}

.empty-state {
  text-align: center;
  padding: 30px;
  color: #9ca3af;
  font-size: 13px;
}
</style>
