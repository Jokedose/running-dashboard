import { TriangleAlert } from "lucide-react";

export function TaperBanner({ phaseName }: { phaseName: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10,
        background: "#fef9ec", borderLeft: "4px solid #b08642", color: "#7a5300", fontWeight: 650,
      }}
    >
      <TriangleAlert size={18} />
      <span>ช่วง {phaseName} — งดเวททุก session ตามแผนจนถึงวันแข่ง</span>
    </div>
  );
}
