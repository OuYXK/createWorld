<template>
  <div class="confirm-modal" v-if="visible" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>删除任务确认</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <p class="confirm-text">请选择删除「{{ taskTitle }}」的方式：</p>
        <div class="delete-options">
          <button class="delete-option completed" @click="$emit('confirm', 'completed')">
            <div class="option-icon">✓</div>
            <div class="option-info">
              <div class="option-title">标记为完成</div>
              <div class="option-desc">任务已完成，从列表中移除</div>
            </div>
          </button>
          <button class="delete-option ended" @click="$emit('confirm', 'ended')">
            <div class="option-icon">■</div>
            <div class="option-info">
              <div class="option-title">结束任务</div>
              <div class="option-desc">提前结束任务，保留记录</div>
            </div>
          </button>
          <button class="delete-option cancelled" @click="$emit('confirm', 'cancelled')">
            <div class="option-icon">✕</div>
            <div class="option-info">
              <div class="option-title">取消任务</div>
              <div class="option-desc">取消此任务，不保留进度</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  taskTitle: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm', type: 'completed' | 'ended' | 'cancelled'): void
}>()
</script>

<style scoped>
.confirm-modal {
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
  width: 440px;
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

.confirm-text {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #4b5563;
}

.delete-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.delete-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.delete-option:hover {
  transform: translateX(4px);
}

.delete-option.completed:hover {
  border-color: #10b981;
  background: #ecfdf5;
}

.delete-option.ended:hover {
  border-color: #f59e0b;
  background: #fffbeb;
}

.delete-option.cancelled:hover {
  border-color: #ef4444;
  background: #fef2f2;
}

.option-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.delete-option.completed .option-icon {
  background: #d1fae5;
  color: #059669;
}

.delete-option.ended .option-icon {
  background: #fef3c7;
  color: #d97706;
}

.delete-option.cancelled .option-icon {
  background: #fee2e2;
  color: #dc2626;
}

.option-info {
  flex: 1;
}

.option-title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  margin-bottom: 2px;
}

.option-desc {
  font-size: 12px;
  color: #6b7280;
}
</style>
