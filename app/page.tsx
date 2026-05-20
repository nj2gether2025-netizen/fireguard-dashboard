"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyrdGnZs18Ur6Cxf0nnC2TsRCZ1C1FmK1aVB8Dx-Kr0mGB90s4ZmCIBavldIRaHBt7OoQ/exec";
type Extinguisher = {
  id: string;
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

const MONTH_COLUMNS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

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
  const raw = String(value ?? "").trim();
  const v = raw.toLowerCase();
  if (["✓", "✔", "เช็คแล้ว", "ตรวจแล้ว", "ปกติ"].includes(raw) || ["checked", "done", "ok", "1", "yes", "y"].some((x) => v.includes(x))) return "checked";
  if (["×", "x", "X", "ยังไม่ตรวจ", "ผิดปกติ"].includes(raw) || ["unchecked", "pending", "no", "0", "n"].some((x) => v.includes(x))) return "unchecked";
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
          const checkedAtRaw = pick(r, ["ตรวจล่าสุด", "วันที่ตรวจ", "checkedAt", "date", "timestamp", "updatedAt"]);
          const date = parseDate(checkedAtRaw);
          const id = String(pick(r, ["รหัสถังดับเพลิง", "id", "fireId", "ถัง", "tankId", "qr", "serial"]) || `FG-${i + 1}`);
          const status = parseStatus(pick(r, ["status", "result", "สถานะ", "checked"]));
          const mapXRaw = pick(r, ["mapX", "x", "posX"]);
          const mapYRaw = pick(r, ["mapY", "y", "posY"]);
          const mapName = String(pick(r, ["mapName", "building", "map", "แผนผัง"]) || "แผนผังหลัก");
          const mapImage = String(pick(r, ["mapImage", "mapUrl", "image", "mapPath"]) || "/maps/er-floor1.png");
const monthlyStatus =
  MONTH_COLUMNS.find((m) => String(r[m] ?? "").trim() !== "") || "-";
          return {
            id,
            location: String(pick(r, ["จุดติดตั้ง", "location", "ตำแหน่ง"]) || "-"),
            zone: String(pick(r, ["อาคาร", "zone", "area"]) || "-"),
            inspector: String(pick(r, ["inspector", "ผู้ตรวจ", "checker", "name"]) || "ไม่ระบุ"),
            status: monthlyStatus === "-" ? status : parseStatus(monthlyStatus),
            checkedAt: monthlyStatus,
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

  const filtered = useMemo(() => (selectedMonth === "all" ? rows : rows.filter((r) => r.monthKey === selectedMonth)), [rows, selectedMonth]);
  const maps = useMemo(() => Array.from(new Set(filtered.map((r) => r.mapName))).sort(), [filtered]);

  const mapScoped = useMemo(
    () => (selectedMap === "all" ? filtered : filtered.filter((r) => r.mapName === selectedMap)),
    [filtered, selectedMap]
  );

  const selectedMapImage = useMemo(() => {
    if (selectedMap === "all") return "/maps/er-floor1.png";
    return mapScoped.find((r) => r.mapImage)?.mapImage || "/maps/er-floor1.png";
  }, [mapScoped, selectedMap]);

  useEffect(() => {
    if (selectedMap !== "all" && !maps.includes(selectedMap)) {
      setSelectedMap("all");
    }
  }, [maps, selectedMap]);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const checked = filtered.filter((r) => r.status === "checked").length;
    const unchecked = filtered.filter((r) => r.status === "unchecked").length;
    const completeness = total ? Math.round((checked / total) * 100) : 0;
    return { total, checked, unchecked, completeness };
  }, [filtered]);

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
            <Card label="ถังทั้งหมด" value={kpi.total} />
            <Card label="ตรวจแล้ว" value={kpi.checked} />
            <Card label="ยังไม่ตรวจ" value={kpi.unchecked} />
            <Card label="ความครบถ้วน" value={`${kpi.completeness}%`} />
          </section>

          <section className="filter">
            <label htmlFor="month">เลือกเดือน:</label>
            <select id="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="all">ทั้งหมด</option>
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <label htmlFor="map">เลือกอาคาร/แผนผัง:</label>
            <select id="map" value={selectedMap} onChange={(e) => { setSelectedMap(e.target.value); setActive(null); }}>
              <option value="all">ทั้งหมด</option>
              {maps.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </section>

          <MapSection data={mapScoped} mapImage={selectedMapImage} mapName={selectedMap} active={active} setActive={setActive} />
          <TableSection title="ตารางถังทั้งหมด" data={mapScoped} />
          <TableSection title="ตารางถังที่ยังไม่ตรวจ" data={mapScoped.filter((r) => r.status === "unchecked")} />
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
          <thead><tr><th>รหัส</th><th>โซน</th><th>ตำแหน่ง</th><th>สถานะ</th><th>ผู้ตรวจ</th><th>วันที่</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={`${title}-${r.id}`}>
                <td>{r.id}</td><td>{r.zone}</td><td>{r.location}</td><td>{statusText(r.status)}</td><td>{r.inspector}</td><td>{r.checkedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MapSection({
  data,
  mapImage,
  mapName,
  active,
  setActive
}: {
  data: Extinguisher[];
  mapImage: string;
  mapName: string;
  active: Extinguisher | null;
  setActive: (item: Extinguisher) => void;
}) {
  return (
    <section>
      <h2>แผนผังถังดับเพลิง {mapName !== "all" ? `(${mapName})` : ""}</h2>
      <div className="mapBox">
        <img src={mapImage} alt={`แผนผัง ${mapName === "all" ? "รวมทุกอาคาร" : mapName}`} className="map" />
        {data.map((r) => {
          if (r.mapX === null || r.mapY === null || Number.isNaN(r.mapX) || Number.isNaN(r.mapY)) return null;
          return (
            <button
              key={`marker-${r.id}`}
              className={`marker ${r.status} ${active?.id === r.id ? "active" : ""}`}
              style={{ left: `${r.mapX}%`, top: `${r.mapY}%` }}
              onClick={() => setActive(r)}
              aria-label={`ถัง ${r.id}`}
            />
          );
        })}
      </div>
      {active && <div className="detail">ถัง {active.id} | {active.zone} | {active.location} | {statusText(active.status)} | ผู้ตรวจ: {active.inspector} | วันที่: {active.checkedAt}</div>}
    </section>
  );
}

const statusText = (s: Extinguisher["status"]) => (s === "checked" ? "ตรวจแล้ว" : s === "unchecked" ? "ยังไม่ตรวจ" : "ไม่มีข้อมูล");
