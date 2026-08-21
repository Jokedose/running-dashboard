import type { ReactNode } from "react";
import type { PageSummary as PageSummaryData } from "../utils/summary";

/**
 * แถบสรุปบนสุดของหน้า — ตอบ "ตอนนี้เป็นยังไง แล้วควรทำอะไร" ก่อนที่สายตาจะไปถึงกราฟ
 *
 * ใช้พาเลตต์ tone ชุดเดียวกับ home-hero (good/warn/hot) แต่เตี้ยกว่าและไม่มีวงแหวน
 * เพราะหน้าย่อยมีเนื้อหาต่อข้างล่างอีกยาว — hero เต็มตัวจะดันทุกอย่างตกจอ
 *
 * `aside` มีไว้ให้หน้าที่ยังต้องการภาพประกอบของตัวเอง (เช่นวงแหวนการฟื้นตัวที่ Home
 * หรือตัวนับถอยหลังที่ Race) เสียบเข้ามาแทนคอลัมน์ตัวเลข — เพื่อให้ทั้งแอปใช้แถบ
 * เดียวกันได้โดยไม่ต้องทิ้งของที่สื่อความได้ดีกว่าตัวเลขล้วน
 */
export function PageSummary({
  summary,
  aside,
  actions,
}: {
  summary: PageSummaryData;
  aside?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={`page-summary ${summary.tone}${aside ? " has-aside" : ""}`} aria-label="สรุปหน้านี้">
      <div className="page-summary-copy">
        {summary.badge && <span className="page-summary-badge">{summary.badge}</span>}
        <strong>{summary.headline}</strong>
        <p>{summary.detail}</p>
        {actions && <div className="page-summary-actions">{actions}</div>}
      </div>
      {aside ? (
        <div className="page-summary-aside">{aside}</div>
      ) : (
        summary.facts.length > 0 && (
          <dl className="page-summary-facts">
            {summary.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )
      )}
      {aside && summary.facts.length > 0 && (
        <dl className="page-summary-facts wide">
          {summary.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
