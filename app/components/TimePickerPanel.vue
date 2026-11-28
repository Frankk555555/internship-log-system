<script setup lang="ts">
// ตัวเลือกเวลาแบบ 24 ชั่วโมง ตัวเลือกเวลาของเบราว์เซอร์แสดง AM/PM ตามภาษาของเครื่อง จึงทำเอง
const props = defineProps<{
  /** "HH:MM" ไม่มีค่าเมื่อยังไม่ได้เลือกหรือพิมพ์ผิดรูปแบบ */
  value?: string
  label: string
}>()

const emit = defineEmits<{
  pick: [value: string]
  /** เลือกครบแล้ว ปิดแผงได้ */
  done: []
}>()

type Part = 'hour' | 'minute'

const pad = (value: number) => String(value).padStart(2, '0')
/** ตำแหน่งที่แสดงเมื่อยังไม่มีค่า: เริ่มที่ช่วงเช้าของวันทำงาน */
const fallback: Record<Part, string> = { hour: '08', minute: '00' }

const columns = [
  { part: 'hour' as const, title: 'ชั่วโมง', options: Array.from({ length: 24 }, (_, index) => pad(index)) },
  { part: 'minute' as const, title: 'นาที', options: Array.from({ length: 60 }, (_, index) => pad(index)) },
]

const selected = computed<Record<Part, string | undefined>>(() => ({
  hour: props.value?.slice(0, 2),
  minute: props.value?.slice(3, 5),
}))

/** ตัวเลือกที่รับโฟกัสด้วยแป้น Tab ของแต่ละคอลัมน์ */
const current = (part: Part) => selected.value[part] ?? fallback[part]

function choose(part: Part, option: string) {
  const hour = part === 'hour' ? option : selected.value.hour ?? fallback.hour
  const minute = part === 'minute' ? option : selected.value.minute ?? fallback.minute
  emit('pick', `${hour}:${minute}`)
}

const root = useTemplateRef<HTMLElement>('root')
const optionOf = (part: Part, option: string) => root.value?.querySelector<HTMLElement>(`[data-part="${part}"][data-value="${option}"]`)

/** เลื่อนให้ตัวเลือกอยู่กลางคอลัมน์ โดยไม่เลื่อนหน้าเว็บ */
function center(part: Part, option: string) {
  const element = optionOf(part, option)
  const list = element?.parentElement
  if (element && list) list.scrollTop = element.offsetTop - (list.clientHeight - element.offsetHeight) / 2
}

onMounted(async () => {
  await nextTick()
  for (const { part } of columns) center(part, current(part))
})

async function focusOption(part: Part, option: string) {
  await nextTick()
  center(part, option)
  optionOf(part, option)?.focus({ preventScroll: true })
}

function onClick(part: Part, option: string) {
  choose(part, option)
  // เลือกชั่วโมงแล้วไปต่อที่นาที เลือกนาทีแล้วจบ
  if (part === 'hour') focusOption('minute', current('minute'))
  else emit('done')
}

// ลูกศรเลื่อนและเลือกภายในคอลัมน์ ตามรูปแบบรายการตัวเลือกมาตรฐาน
function onKey(event: KeyboardEvent, part: Part, options: string[]) {
  const index = options.indexOf(current(part))
  const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }
  let next: number | undefined
  if (event.key in steps) next = (index + steps[event.key]! + options.length) % options.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = options.length - 1
  if (next === undefined) return

  event.preventDefault()
  choose(part, options[next]!)
  focusOption(part, options[next]!)
}
</script>

<template>
  <div ref="root" class="p-3" role="group" :aria-label="`เลือก${label}`">
    <div class="flex gap-2">
      <div v-for="column in columns" :key="column.part">
        <p :id="`time-${column.part}-title`" class="pb-1.5 text-center text-2xs font-semibold text-slate-600">{{ column.title }}</p>
        <div
          class="relative h-48 w-16 overflow-y-auto overscroll-contain rounded-lg border border-line p-1"
          role="listbox"
          :aria-labelledby="`time-${column.part}-title`"
          @keydown="onKey($event, column.part, column.options)"
        >
          <button
            v-for="option in column.options"
            :key="option"
            type="button"
            role="option"
            :data-part="column.part"
            :data-value="option"
            :aria-selected="selected[column.part] === option"
            :tabindex="current(column.part) === option ? 0 : -1"
            class="block h-9 w-full rounded-md text-sm tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
            :class="selected[column.part] === option ? 'bg-brand font-semibold text-white' : 'text-slate-700 hover:bg-page'"
            @click="onClick(column.part, option)"
          >
            {{ option }}
          </button>
        </div>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between gap-3">
      <p class="text-xs font-semibold tabular-nums text-ink" role="status">{{ value ? `${value} น.` : 'ยังไม่ได้เลือก' }}</p>
      <button type="button" class="btn btn-secondary min-h-8 px-3 text-2xs" @click="emit('done')">ตกลง</button>
    </div>
  </div>
</template>
