<template>
  <div class="app" v-if="!isReminderView && !isTaskRunningView">
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">📋 任务管理器</h1>
        <span class="today-date">{{ formattedDate }}</span>
      </div>
      <div class="header-right">
        <button class="add-task-btn" @click="showTaskForm = true">
          + 添加任务
        </button>
      </div>
    </header>

    <div class="app-main">
      <div class="main-content">
        <div class="tabs">
          <button
            :class="{ active: activeTab === 'today' }"
            @click="activeTab = 'today'"
          >
            今日任务
            <span class="tab-badge">{{ todayTasks.length }}</span>
          </button>
          <button
            :class="{ active: activeTab === 'long-term' }"
            @click="activeTab = 'long-term'"
          >
            长期任务
            <span class="tab-badge">{{ longTermTasks.length }}</span>
          </button>
          <button
            :class="{ active: activeTab === 'all' }"
            @click="activeTab = 'all'"
          >
            全部任务
            <span class="tab-badge">{{ tasks.length }}</span>
          </button>
        </div>

        <div class="tasks-container">
          <div v-if="displayedTasks.length === 0" class="empty-state">
            <div class="empty-icon">📝</div>
            <p>暂无任务，点击右上角添加任务</p>
          </div>
          <div class="tasks-grid" v-else>
            <TaskCard
              v-for="task in displayedTasks"
              :key="task.id"
              :task="task"
              :theme="getThemeById(task.themeId)"
              @start="handleStartTask(task)"
              @pause="handlePauseTask(task)"
              @resume="handleResumeTask(task)"
              @complete="handleCompleteTask(task)"
              @edit="handleEditTask(task)"
              @delete="handleDeleteTask(task)"
            />
          </div>
        </div>
      </div>

      <aside class="sidebar">
        <StatsPanel ref="statsPanel" />
      </aside>
    </div>

    <TaskForm
      :visible="showTaskForm"
      :themes="themes"
      :edit-task="editingTask"
      @close="closeTaskForm"
      @submit="handleTaskSubmit"
      @add-theme="handleAddTheme"
    />

    <DeleteConfirm
      :visible="showDeleteConfirm"
      :task-title="deletingTask?.title || ''"
      @close="showDeleteConfirm = false"
      @confirm="handleDeleteConfirm"
    />

    <PauseDialog
      :visible="showPauseDialog"
      @close="showPauseDialog = false"
      @confirm="handlePauseConfirm"
    />
  </div>

  <ReminderView v-if="isReminderView" />
  <TaskRunningView v-if="isTaskRunningView" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import TaskCard from './components/TaskCard.vue'
import TaskForm from './components/TaskForm.vue'
import DeleteConfirm from './components/DeleteConfirm.vue'
import PauseDialog from './components/PauseDialog.vue'
import StatsPanel from './components/StatsPanel.vue'
import ReminderView from './views/ReminderView.vue'
import TaskRunningView from './views/TaskRunningView.vue'
import { useTaskManager } from './composables/useTaskManager'
import type { Task } from './types/task'

const {
  tasks,
  themes,
  todayTasks,
  longTermTasks,
  today,
  getThemeById,
  createTask,
  addNewTheme,
  updateTaskStatus,
  pauseTask,
  resumeTask,
  removeTask,
  loadData,
} = useTaskManager()

const statsPanel = ref<InstanceType<typeof StatsPanel> | null>(null)

const activeTab = ref<'today' | 'long-term' | 'all'>('today')
const showTaskForm = ref(false)
const editingTask = ref<Task | null>(null)
const showDeleteConfirm = ref(false)
const deletingTask = ref<Task | null>(null)
const showPauseDialog = ref(false)
const pausingTask = ref<Task | null>(null)

const isReminderView = computed(() => {
  return window.location.hash.includes('/reminder')
})

const isTaskRunningView = computed(() => {
  return window.location.hash.includes('/task-running')
})

const formattedDate = computed(() => {
  const d = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
})

const displayedTasks = computed(() => {
  if (activeTab.value === 'today') {
    return todayTasks.value
  } else if (activeTab.value === 'long-term') {
    return longTermTasks.value
  }
  return tasks.value
})

const handleTaskSubmit = (data: any) => {
  createTask(data)
  showTaskForm.value = false
  editingTask.value = null
  refreshStats()
}

const handleAddTheme = (data: { name: string; color: string }) => {
  addNewTheme(data.name, data.color)
}

const handleStartTask = (task: Task) => {
  updateTaskStatus(task.id, 'running')
  if (window.electronAPI) {
    window.electronAPI.openTaskWindow({ taskId: task.id })
  }
  refreshStats()
}

const handlePauseTask = (task: Task) => {
  pausingTask.value = task
  showPauseDialog.value = true
}

const handlePauseConfirm = (reason: string) => {
  if (pausingTask.value) {
    pauseTask(pausingTask.value.id, reason)
    showPauseDialog.value = false
    pausingTask.value = null
    refreshStats()
  }
}

const handleResumeTask = (task: Task) => {
  resumeTask(task.id)
  refreshStats()
}

const handleCompleteTask = (task: Task) => {
  updateTaskStatus(task.id, 'completed')
  refreshStats()
}

const handleEditTask = (task: Task) => {
  editingTask.value = task
  showTaskForm.value = true
}

const handleDeleteTask = (task: Task) => {
  deletingTask.value = task
  showDeleteConfirm.value = true
}

const handleDeleteConfirm = (type: 'completed' | 'ended' | 'cancelled') => {
  if (deletingTask.value) {
    updateTaskStatus(deletingTask.value.id, type)
    showDeleteConfirm.value = false
    deletingTask.value = null
    refreshStats()
  }
}

const closeTaskForm = () => {
  showTaskForm.value = false
  editingTask.value = null
}

const refreshStats = () => {
  setTimeout(() => {
    if (statsPanel.value) {
      statsPanel.value.updateStats()
    }
  }, 50)
}

onMounted(() => {
  loadData()

  if (window.electronAPI) {
    window.electronAPI.onTaskWindowClosed(() => {
      loadData()
      refreshStats()
    })

    window.electronAPI.onTaskUpdated(() => {
      loadData()
      refreshStats()
    })
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f3f4f6;
  color: #1f2937;
}

#app {
  width: 100%;
  height: 100vh;
}
</style>

<style scoped>
.app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}

.app-header {
  background: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
}

.today-date {
  font-size: 14px;
  color: #6b7280;
}

.add-task-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.add-task-btn:hover {
  background: #2563eb;
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tabs button {
  padding: 10px 20px;
  border: none;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tabs button:hover {
  background: #f9fafb;
}

.tabs button.active {
  background: #3b82f6;
  color: white;
}

.tab-badge {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.tabs button.active .tab-badge {
  background: rgba(255, 255, 255, 0.2);
}

.tasks-container {
  min-height: 200px;
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  color: #9ca3af;
  font-size: 14px;
}

.sidebar {
  width: 340px;
  padding: 24px;
  padding-left: 0;
  overflow-y: auto;
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .app-main {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    padding: 0 24px 24px;
  }
}
</style>
