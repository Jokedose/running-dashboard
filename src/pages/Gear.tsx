import { ProgressBar } from "../components/ProgressBar";
import type { DashboardData } from "../types";
import { km, percent } from "../utils/format";

export function Gear({ data }: { data: DashboardData }) {
  return (
    <section className="page-stack">
      <div className="shoe-grid">
        {data.gear.map((shoe) => (
          <div className="shoe-card" key={shoe.shoe_slug}>
            <div>
              <h2>{shoe.shoe_name ?? shoe.shoe_slug}</h2>
              <p>{shoe.shoe_slug}</p>
            </div>
            <strong>{km(shoe.total_km)}</strong>
            <ProgressBar value={shoe.used_percent} label={`ใช้ไป ${percent(shoe.used_percent)} · เหลือ ${km(shoe.remaining_km)}`} />
            <span className="shoe-status">{shoe.status ?? "ใช้งาน"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
