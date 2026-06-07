import { Paper, Typography } from "@mui/material";
import { ShieldCheck } from "lucide-react";

export function EmptyState() {
  return (
    <Paper className="empty-state" variant="outlined">
      <ShieldCheck size={26} />
      <Typography component="strong">ยังไม่มีข้อมูลแดชบอร์ด</Typography>
      <Typography variant="body2">ซิงก์ข้อมูล Supabase จากคลังส่วนตัวก่อน แล้วกลับมาโหลดหน้านี้ใหม่</Typography>
    </Paper>
  );
}
