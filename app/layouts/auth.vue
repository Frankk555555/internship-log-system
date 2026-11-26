<template>
  <div class="flex min-h-screen flex-col bg-white font-sans text-slate-900 lg:flex-row">
    <aside class="flex flex-col items-center justify-center bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_55%,#0f172a_100%)] px-6 py-10 text-center text-white lg:w-[43.75%] lg:py-6">
      <p class="rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3.5 py-1.5 text-[11px] font-medium text-indigo-200">
        Internship Work Log System
      </p>
      <h1 class="mt-5 text-2xl font-bold leading-snug xl:text-[32px]">
        ระบบบันทึกการปฏิบัติงาน<br>ของนักศึกษาฝึกงาน
      </h1>
      <p class="mt-5 text-sm text-slate-300">ติดตามชั่วโมงฝึกงาน บันทึกการปฏิบัติงาน และส่งตรวจประเมินผล</p>
    </aside>

    <main class="flex flex-1 justify-center px-6 py-10 lg:py-6 lg:pt-[15vh]">
      <div class="w-full max-w-lg">
        <slot />
      </div>
    </main>
  </div>
</template>
