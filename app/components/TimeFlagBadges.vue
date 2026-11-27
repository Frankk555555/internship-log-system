<script setup lang="ts">
import type { WorkLog } from '~/types/worklog'

// ให้พี่เลี้ยงเห็นว่าเวลาของรายการไม่ได้มาจากระบบจับเวลา หรือถูกแก้หลังส่งกลับ
const props = defineProps<{
  worklog: WorkLog
}>()

const isManual = computed(() => props.worklog.timeSource === 'manual' || props.worklog.timeSource === 'timer_manual_end')
</script>

<template>
  <div v-if="isManual || worklog.timeEdited" class="flex flex-wrap gap-1">
    <StatusBadge v-if="isManual" label="กรอกเวลาเอง" tone="amber" />
    <StatusBadge v-if="worklog.timeEdited" label="แก้เวลาแล้ว" tone="blue" />
  </div>
</template>
