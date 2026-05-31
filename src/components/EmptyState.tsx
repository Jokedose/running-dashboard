import { ShieldCheck } from "lucide-react";

export function EmptyState() {
  return (
    <div className="empty-state">
      <ShieldCheck size={26} />
      <strong>ยังไม่มีข้อมูล dashboard</strong>
      <p>sync Supabase จาก repo private ก่อน แล้วกลับมา refresh หน้านี้</p>
    </div>
  );
}
