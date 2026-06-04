import { Paper, Typography } from "@mui/material";
import { ShieldCheck } from "lucide-react";

export function EmptyState() {
  return (
    <Paper className="empty-state" variant="outlined">
      <ShieldCheck size={26} />
      <Typography component="strong">ยังไม่มีข้อมูล dashboard</Typography>
      <Typography variant="body2">sync Supabase จาก repo private ก่อน แล้วกลับมา refresh หน้านี้</Typography>
    </Paper>
  );
}
