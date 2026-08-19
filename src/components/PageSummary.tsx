import type { PageSummary as PageSummaryData } from "../utils/summary";

/**
 * แถบสรุปบนสุดของหน้า — ตอบ "ตอนนี้เป็นยังไง แล้วควรทำอะไร" ก่อนที่สายตาจะไปถึงกราฟ
 *
 * ใช้พาเลตต์ tone ชุดเดียวกับ home-hero (good/warn/hot) แต่เตี้ยกว่าและไม่มีวงแหวน
 * เพราะหน้าย่อยมีเนื้อหาต่อข้างล่างอีกยาว — hero เต็มตัวจะดันทุกอย่างตกจอ
 */
export function PageSummary({ summary }: { summary: PageSummaryData }) {
  return (
    <section className={`page-summary ${summary.tone}`} aria-label="สรุปหน้านี้">
      <div className="page-summary-copy">
        <strong>{summary.headline}</strong>
        <p>{summary.detail}</p>
      </div>
      {summary.facts.length > 0 && (
        <dl className="page-summary-facts">
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
