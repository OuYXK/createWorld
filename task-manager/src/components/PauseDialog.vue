<template>
  <div class="pause-modal" v-if="visible" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>暂停任务</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <p class="desc">请填写暂停原因：</p>
        <div class="reason-presets">
          <button
            v-for="preset in presets"
            :key="preset"
            :class="{ active: reason === preset }"
            class="preset-btn"
            @click="reason = preset"
          >
            {{ preset }}
          </button>
        </div>
        <textarea
          v-model="reason"
          placeholder="请输入或选择暂停原因..."
          rows="4"
        ></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" @click="handleConfirm">确认暂停</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', reason: string): void
}>()

const presets = [
  '休息一下',
  '需要处理其他事情',
  '临时会议',
  '身体不适',
  '等待他人回复',
]

const reason = ref('')

const handleConfirm = () => {
  if (!reason.value.trim()) {
    alert('请填写暂停原因')
    return
  }
  emit('confirm', reason.value.trim())
  reason.value = ''
}
</script>

<style scoped>
.pause-modal {
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
  width: 420px;
  max-width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.desc {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #4b5563;
}

.reason-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preset-btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  background: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: #4b5563;
}

.preset-btn:hover {
  border-color: #f59e0b;
  background: #fffbeb;
  color: #d97706;
}

.preset-btn.active {
  border-color: #f59e0b;
  background: #fef3c7;
  color: #b45309;
}

textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

textarea:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
  background: #f59e0b;
  color: white;
}

.btn-primary:hover {
  background: #d97706;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}
</style>
