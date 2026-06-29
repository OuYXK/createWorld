<template>
  <div class="task-form-modal" v-if="visible" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ isEdit ? '编辑任务' : '添加任务' }}</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>任务标题</label>
          <input type="text" v-model="form.title" placeholder="请输入任务标题" />
        </div>

        <div class="form-group">
          <label>任务类型</label>
          <div class="type-selector">
            <button
              :class="{ active: form.type === 'daily' }"
              @click="form.type = 'daily'"
            >
              当天任务
            </button>
            <button
              :class="{ active: form.type === 'long-term' }"
              @click="form.type = 'long-term'"
            >
              长期任务
            </button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" v-model="form.startDate" />
          </div>
          <div class="form-group" v-if="form.type === 'long-term'">
            <label>结束日期</label>
            <input type="date" v-model="form.endDate" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>开始时间</label>
            <input type="time" v-model="form.startTime" />
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <input type="time" v-model="form.endTime" />
          </div>
        </div>

        <div class="form-group">
          <label>任务主题</label>
          <div class="theme-selector">
            <div
              v-for="theme in themes"
              :key="theme.id"
              :class="{ active: form.themeId === theme.id }"
              class="theme-option"
              :style="{ borderColor: theme.color }"
              @click="form.themeId = theme.id"
            >
              <span class="theme-dot" :style="{ backgroundColor: theme.color }"></span>
              {{ theme.name }}
            </div>
            <div class="theme-option add-theme" @click="showAddTheme = true">
              <span class="add-icon">+</span>
              添加主题
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>提前提醒（分钟）</label>
          <select v-model="form.reminderMinutesBefore">
            <option :value="0">不提醒</option>
            <option :value="5">5分钟前</option>
            <option :value="10">10分钟前</option>
            <option :value="15">15分钟前</option>
            <option :value="30">30分钟前</option>
            <option :value="60">1小时前</option>
          </select>
        </div>

        <div class="form-group">
          <label>任务细节</label>
          <textarea
            v-model="form.details"
            placeholder="请输入任务细节描述..."
            rows="3"
          ></textarea>
        </div>

        <div class="form-group">
          <label>子任务（分任务）</label>
          <div class="subtasks-list">
            <div
              v-for="(subTask, index) in form.subTasks"
              :key="index"
              class="subtask-item"
            >
              <input
                type="text"
                v-model="subTask.title"
                :placeholder="`子任务 ${index + 1}`"
              />
              <button class="remove-subtask" @click="removeSubTask(index)">×</button>
            </div>
          </div>
          <button class="add-subtask-btn" @click="addSubTask">+ 添加子任务</button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose">取消</button>
        <button class="btn btn-primary" @click="handleSubmit">保存</button>
      </div>
    </div>

    <div class="add-theme-modal" v-if="showAddTheme" @click.self="showAddTheme = false">
      <div class="modal-content small">
        <div class="modal-header">
          <h3>添加新主题</h3>
          <button class="close-btn" @click="showAddTheme = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>主题名称</label>
            <input type="text" v-model="newThemeName" placeholder="请输入主题名称" />
          </div>
          <div class="form-group">
            <label>主题颜色</label>
            <div class="color-picker">
              <div
                v-for="color in presetColors"
                :key="color"
                :class="{ active: newThemeColor === color }"
                class="color-option"
                :style="{ backgroundColor: color }"
                @click="newThemeColor = color"
              ></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddTheme = false">取消</button>
          <button class="btn btn-primary" @click="handleAddTheme">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { TaskTheme } from '@/types/task'

const props = defineProps<{
  visible: boolean
  themes: TaskTheme[]
  editTask?: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: any): void
  (e: 'addTheme', data: { name: string; color: string }): void
}>()

const presetColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

const isEdit = computed(() => !!props.editTask)

const getDefaultForm = () => ({
  title: '',
  themeId: props.themes[0]?.id || '',
  details: '',
  subTasks: [{ title: '' }],
  type: 'daily' as 'daily' | 'long-term',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '10:00',
  reminderMinutesBefore: 10,
})

const form = ref(getDefaultForm())
const showAddTheme = ref(false)
const newThemeName = ref('')
const newThemeColor = ref(presetColors[0])

watch(() => props.visible, (val) => {
  if (val) {
    if (props.editTask) {
      form.value = {
        title: props.editTask.title,
        themeId: props.editTask.themeId,
        details: props.editTask.details,
        subTasks: props.editTask.subTasks.map((st: any) => ({ title: st.title })),
        type: props.editTask.type,
        startDate: props.editTask.startDate,
        endDate: props.editTask.endDate,
        startTime: props.editTask.startTime,
        endTime: props.editTask.endTime,
        reminderMinutesBefore: props.editTask.reminderMinutesBefore,
      }
    } else {
      form.value = getDefaultForm()
    }
  }
})

watch(() => form.value.type, (type) => {
  if (type === 'daily') {
    form.value.endDate = form.value.startDate
  }
})

const handleClose = () => {
  emit('close')
}

const handleSubmit = () => {
  if (!form.value.title.trim()) {
    alert('请输入任务标题')
    return
  }
  if (!form.value.themeId) {
    alert('请选择任务主题')
    return
  }
  const subTasks = form.value.subTasks.filter(st => st.title.trim())
  emit('submit', {
    ...form.value,
    subTasks,
  })
}

const addSubTask = () => {
  form.value.subTasks.push({ title: '' })
}

const removeSubTask = (index: number) => {
  form.value.subTasks.splice(index, 1)
}

const handleAddTheme = () => {
  if (!newThemeName.value.trim()) {
    alert('请输入主题名称')
    return
  }
  emit('addTheme', {
    name: newThemeName.value.trim(),
    color: newThemeColor.value,
  })
  newThemeName.value = ''
  showAddTheme.value = false
}
</script>

<style scoped>
.task-form-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-content.small {
  width: 400px;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.type-selector {
  display: flex;
  gap: 12px;
}

.type-selector button {
  flex: 1;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.type-selector button:hover {
  border-color: #93c5fd;
}

.type-selector button.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 500;
}

.theme-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  background: white;
}

.theme-option:hover {
  background: #f9fafb;
}

.theme-option.active {
  background: #f0f9ff;
}

.theme-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.theme-option.add-theme {
  border-style: dashed;
  color: #6b7280;
}

.theme-option.add-theme:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.add-icon {
  font-size: 16px;
  font-weight: bold;
}

.subtasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.subtask-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.subtask-item input {
  flex: 1;
}

.remove-subtask {
  width: 32px;
  height: 32px;
  border: none;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-subtask:hover {
  background: #fecaca;
}

.add-subtask-btn {
  background: none;
  border: 1px dashed #d1d5db;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: #6b7280;
  font-size: 13px;
  width: 100%;
}

.add-subtask-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s;
  border: 3px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border-color: #1f2937;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.add-theme-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
</style>
