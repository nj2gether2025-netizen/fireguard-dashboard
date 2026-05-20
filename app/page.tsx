"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyykPLFJX4QlL--C3-E-F0Ji-lt516M7UB2BtTRv05G2ttkf7jt-QpDSqEw2A9fwjlUXQ/exec";

type Extinguisher = {
  fireCode: string;
  location: string;
  zone: string;
  inspector: string;
  status: "checked" | "unchecked" | "unknown";
  checkedAt: string;
  monthKey: string;
  mapX: number | null;
  mapY: number | null;
  mapName: string;
  mapImage: string;
};

const pick = (obj: Record<string, unknown>, keys: string[]) => {
  const found = keys.find((k) => obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "");
  return found ? obj[found] : "";
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseStatus = (value: unknown): Extinguisher["status"] => {
  const v = String(value ?? "").toLowerCase();
  if (["checked", "ตรวจแล้ว", "done", "ok", "1", "yes", "y"].some((x) => v.includes(x))) return "checked";
  if (["unchecked", "ยังไม่ตรวจ", "pending", "no", "0", "n"].some((x) => v.includes(x))) return "unchecked";
  return "unknown";
};

const monthFormat = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

export default function HomePage() {
  const [rows, setRows] = useState<Extinguisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedMap, setSelectedMap] = useState("all");
  const [active, setActive] = useState<Extinguisher | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (${res.status})`);
        const json = await res.json();
        const raw = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

        const mapped: Extinguisher[] = raw.map((r: Record<string, unknown>, i: number) => {
          const checkedAtRaw = pick(r, ["checkedAt", "date", "วันที่ตรวจ", "timestamp", "updatedAt"]);
          const date = parseDate(checkedAtRaw);
          const fireCode = String(pick(r, ["รหัสถังดับเพลิง", "fireCode", "id", "fireId", "tankId", "qr", "serial"]) || `ไม่พบรหัส-${i + 1}`);
          const status = parseStatus(pick(r, ["status", "result", "สถานะ", "checked"]));
          const mapXRaw = pick(r, ["mapX", "x", "posX"]);
          const mapYRaw = pick(r, ["mapY", "y", "posY"]);
          const mapName = String(pick(r, ["mapName", "ชื่อแผนผัง", "building", "map"]) || "ไม่ระบุแผนผัง");
          const mapImage = String(pick(r, ["mapImage", "รูปแผนผัง", "mapPath", "image"]) || "");

          return {
            fireCode,
            location: String(pick(r, ["location", "ตำแหน่ง", "point", "spot"]) || "ไม่ระบุ"),
            zone: String(pick(r, ["zone", "area", "แผนก", "unit"]) || "ไม่ระบุ"),
            inspector: String(pick(r, ["inspector", "ผู้ตรวจ", "checker", "name"]) || "ไม่ระบุ"),
            status,
            checkedAt: date ? date.toLocaleDateString("th-TH") : "-",
            monthKey: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "unknown",
            mapX: mapXRaw === "" ? null : Number(mapXRaw),
            mapY: mapYRaw === "" ? null : Number(mapYRaw),
            mapName,
            mapImage
          };
        });

        setRows(mapped);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const months = useMemo(() => {
    const unique = Array.from(new Set(rows.map((r) => r.monthKey).filter((m) => m !== "unknown"))).sort().reverse();
    return unique.map((m) => {
      const [y, mm] = m.split("-").map(Number);
      return { key: m, label: monthFormat.format(new Date(y, mm - 1, 1)) };
    });
  }, [rows]);

  const maps = useMemo(() => {
    const unique = Array.from(new Set(rows.map((r) => r.mapName).filter(Boolean))).sort((a, b) => a.localeCompare(b, "th"));
    return unique;
  }, [rows]);

  const monthFiltered = useMemo(() => (selectedMonth === "all" ? rows : rows.filter((r) => r.monthKey === selectedMonth)), [rows, selectedMonth]);
  const selectedMapRows = useMemo(
    () => (selectedMap === "all" ? [] : monthFiltered.filter((r) => r.mapName === selectedMap)),
    [monthFiltered, selectedMap]
  );

  const selectedMapImage = useMemo(() => {
    if (selectedMap === "all") return "";
    const row = selectedMapRows.find((r) => r.mapImage.trim() !== "");
    return row?.mapImage || "";
  }, [selectedMap, selectedMapRows]);

  const kpiAll = useMemo(() => {
    const total = rows.length;
    const checked = rows.filter((r) => r.status === "checked").length;
    const unchecked = rows.filter((r) => r.status === "unchecked").length;
    const completeness = total ? Math.round((checked / total) * 100) : 0;
    return { total, checked, unchecked, completeness };
  }, [rows]);

  const kpiMap = useMemo(() => {
    const total = selectedMapRows.length;
    const checked = selectedMapRows.filter((r) => r.status === "checked").length;
    const unchecked = selectedMapRows.filter((r) => r.status === "unchecked").length;
    return { total, checked, unchecked };
  }, [selectedMapRows]);

  return (
    <main className="container">
      <header>
        <h1>FireGuard QR Dashboard</h1>
        <p>ENV Team โรงพยาบาลบางคล้า</p>
      </header>
      {loading && <p>กำลังโหลดข้อมูล...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="kpis">
            <Card label="ถังทั้งหมด (ภาพรวม)" value={kpiAll.total} />
            <Card label="ตรวจแล้ว (ภาพรวม)" value={kpiAll.checked} />
            <Card label="ยังไม่ตรวจ (ภาพรวม)" value={kpiAll.unchecked} />
            <Card label="ความครบถ้วน (ภาพรวม)" value={`${kpiAll.completeness}%`} />
          </section>

          <section className="kpis mapKpis">
            <Card label="ถังในแผนผังนี้" value={selectedMap === "all" ? "-" : kpiMap.total} />
            <Card label="ตรวจแล้ว (แผนผังนี้)" value={selectedMap === "all" ? "-" : kpiMap.checked} />
            <Card label="ยังไม่ตรวจ (แผนผังนี้)" value={selectedMap === "all" ? "-" : kpiMap.unchecked} />
          </section>

          <section className="filter filterWrap">
            <div>
              <label htmlFor="month">เลือกเดือน:</label>
              <select id="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="all">ทั้งหมด</option>
                {months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="map">เลือกแผนผัง/อาคาร:</label>
              <select id="map" value={selectedMap} onChange={(e) => { setSelectedMap(e.target.value); setActive(null); }}>
                <option value="all">ทั้งหมด</option>
                {maps.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </section>

          <MapSection selectedMap={selectedMap} mapImage={selectedMapImage} data={selectedMapRows} active={active} setActive={setActive} />
          <TableSection title="ตารางถังทั้งหมด" data={monthFiltered} />
          <TableSection title="ตารางถังที่ยังไม่ตรวจ" data={monthFiltered.filter((r) => r.status === "unchecked")} />
        </>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return <article className="card"><h3>{label}</h3><strong>{value}</strong></article>;
}

function TableSection({ title, data }: { title: string; data: Extinguisher[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="tableWrap">
        <table>
          <thead><tr><th>รหัสถังดับเพลิง</th><th>แผนผัง</th><th>โซน</th><th>ตำแหน่ง</th><th>สถานะ</th><th>ผู้ตรวจ</th><th>วันที่</th></tr></thead>
          <tbody>
            {data.map((r, idx) => (
              <tr key={`${title}-${r.fireCode}-${idx}`}>
                <td>{r.fireCode}</td><td>{r.mapName}</td><td>{r.zone}</td><td>{r.location}</td><td>{statusText(r.status)}</td><td>{r.inspector}</td><td>{r.checkedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MapSection({ selectedMap, mapImage, data, active, setActive }: { selectedMap: string; mapImage: string; data: Extinguisher[]; active: Extinguisher | null; setActive: (item: Extinguisher) => void }) {
  if (selectedMap === "all") {
    return <section><h2>แผนผังถังดับเพลิง</h2><p>กรุณาเลือกแผนผัง/อาคารก่อนเพื่อแสดงรูปแผนผังและ marker</p></section>;
  }

  if (!mapImage) {
    return <section><h2>แผนผังถังดับเพลิง</h2><p>ไม่พบไฟล์รูปสำหรับแผนผังที่เลือก</p></section>;
  }

  return (
    <section>
      <h2>แผนผังถังดับเพลิง: {selectedMap}</h2>
      <div className="mapBox">
        <img src={mapImage} alt={`แผนผัง ${selectedMap}`} className="map" />
        {data.map((r, idx) => {
          if (r.mapX === null || r.mapY === null || Number.isNaN(r.mapX) || Number.isNaN(r.mapY)) return null;
          return (
            <button
              key={`marker-${r.fireCode}-${idx}`}
              className={`marker ${r.status} ${active?.fireCode === r.fireCode ? "active" : ""}`}
              style={{ left: `${r.mapX}%`, top: `${r.mapY}%` }}
              onClick={() => setActive(r)}
              aria-label={`ถัง ${r.fireCode}`}
            />
          );
        })}
      </div>
      {active && <div className="detail">ถัง {active.fireCode} | {active.zone} | {active.location} | {statusText(active.status)} | ผู้ตรวจ: {active.inspector} | วันที่: {active.checkedAt}</div>}
    </section>
  );
}

const statusText = (s: Extinguisher["status"]) => (s === "checked" ? "ตรวจแล้ว" : s === "unchecked" ? "ยังไม่ตรวจ" : "ไม่มีข้อมูล");
