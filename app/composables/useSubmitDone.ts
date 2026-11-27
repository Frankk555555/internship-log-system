import type { WorkLog } from '~/types/worklog'

/** ส่งตรวจสำเร็จ แจ้งผลแล้วกลับหน้าหลัก โดยไม่ให้กดย้อนกลับมาที่ฟอร์มที่ส่งไปแล้ว */
export function useSubmitDone() {
  const notify = useNotify()

  return async (log: WorkLog, title: string) => {
    notify('success', title, `${log.title}\n${formatThaiDate(log.date)} • ${log.startTime}–${log.endTime} น. รอพี่เลี้ยงตรวจ`)
    await navigateTo('/', { replace: true })
  }
}
