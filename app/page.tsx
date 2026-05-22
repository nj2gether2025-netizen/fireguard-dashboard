"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = "/api/fireguard";
type Extinguisher = {
  id: string;
  location: string;
  zone: string;
  inspector: string;
  status: "checked" | "unchecked" | "warning" | "danger" | "unknown";
  checkedAt: string;
  monthlyStatuses: Record<string, unknown>;
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

const getRecords = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];

  if (payload && typeof payload === "object") {
    const response = payload as Record<string, unknown>;
    if (Array.isArray(response.data)) return response.data as Record<string, unknown>[];
    if (Array.isArray(response.value)) return response.value as Record<string, unknown>[];
  }

  return [];
};

const parseStatus = (value: unknown): Extinguisher["status"] => {
  const raw = String(value ?? "").trim();
  const v = raw.toLowerCase();
  if (["ตรวจแล้ว", "ปกติ", "✓", "✔"].includes(raw) || ["checked", "done", "ok", "1", "yes", "y"].includes(v)) return "checked";
  if (raw === "ผิดปกติ" || v === "danger") return "danger";
  if (raw === "ใกล้ตรวจสอบ" || v === "warning") return "warning";
  if (["ยังไม่ตรวจ", "×", "x", "X"].includes(raw) || ["unchecked", "pending", "no", "0", "n"].includes(v)) return "unchecked";
  return "unknown";
};

const needsInspection = (status: Extinguisher["status"]) => status !== "checked";

const getLatestStatusValue = (record: Record<string, unknown>) => {
  const latest = pick(record, ["ตรวจล่าสุด"]);
  const latestMonth = String(latest).trim();

  if (MONTH_COLUMNS.includes(latestMonth)) {
    return record[latestMonth] ?? "";
  }

  return latest || pick(record, ["status", "result", "สถานะ", "checked"]);
};

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
        const raw = getRecords(json);

        const mapped: Extinguisher[] = raw.map((r: Record<string, unknown>, i: number) => {
          const checkedAtRaw = pick(r, ["ตรวจล่าสุด", "วันที่ตรวจ", "checkedAt", "date", "timestamp", "updatedAt"]);
          const id = String(pick(r, ["รหัสถังดับเพลิง", "id", "fireId", "ถัง", "tankId", "qr", "serial"]) || `FG-${i + 1}`);
          const status = parseStatus(getLatestStatusValue(r));
          const mapXRaw = pick(r, ["mapX", "x", "posX"]);
          const mapYRaw = pick(r, ["mapY", "y", "posY"]);
          const mapName = String(pick(r, ["mapName", "building", "map", "แผนผัง"]) || "แผนผังหลัก");
          const mapImage = String(pick(r, ["mapImage", "mapUrl", "image", "mapPath"]) || "/maps/er-floor1.png");
          return {
            id,
            location: String(pick(r, ["จุดติดตั้ง", "location", "ตำแหน่ง"]) || "-"),
            zone: String(pick(r, ["อาคาร", "zone", "area"]) || "-"),
            inspector: String(pick(r, ["inspector", "ผู้ตรวจ", "checker", "name"]) || "ไม่ระบุ"),
            status,
            checkedAt: String(checkedAtRaw || "-"),
            monthlyStatuses: Object.fromEntries(MONTH_COLUMNS.map((month) => [month, r[month] ?? ""])),
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

  const filtered = useMemo(
    () =>
      selectedMonth === "all"
        ? rows
        : rows.map((r) => ({
            ...r,
            status: parseStatus(r.monthlyStatuses[selectedMonth])
          })),
    [rows, selectedMonth]
  );
  const maps = useMemo(() => Array.from(new Set(filtered.map((r) => r.mapName))).sort(), [filtered]);

  const mapScoped = useMemo(
    () => (selectedMap === "all" ? filtered : filtered.filter((r) => r.mapName === selectedMap)),
    [filtered, selectedMap]
  );

  const selectedMapImage = useMemo(() => {
    return mapScoped.find((r) => r.mapImage)?.mapImage || "/maps/er-floor1.png";
  }, [mapScoped]);

  useEffect(() => {
    if (selectedMap !== "all" && !maps.includes(selectedMap)) {
      setSelectedMap("all");
    }
  }, [maps, selectedMap]);

  const kpi = useMemo(() => {
    const total = mapScoped.length;
    const checked = mapScoped.filter((r) => r.status === "checked").length;
    const unchecked = mapScoped.filter((r) => needsInspection(r.status)).length;
    const completeness = total ? Math.round((checked / total) * 100) : 0;
    return { total, checked, unchecked, completeness };
  }, [mapScoped]);

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
              {MONTH_COLUMNS.map((month) => (
                <option key={month} value={month}>
                  {month}
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
          <TableSection title="ตารางถังที่ยังไม่ตรวจ" data={mapScoped.filter((r) => needsInspection(r.status))} />
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
  if (mapName === "all") {
    return (
      <section>
        <h2>แผนผังถังดับเพลิง</h2>
        <p>เลือกอาคาร/แผนผังก่อนเพื่อดูตำแหน่งถังบนแผนผัง</p>
      </section>
    );
  }

  return (
    <section>
      <h2>แผนผังถังดับเพลิง {mapName !== "all" ? `(${mapName})` : ""}</h2>
      <div className="mapBox">
        <div className="mapStage">
          <img src={mapImage} alt={`แผนผัง ${mapName === "all" ? "รวมทุกอาคาร" : mapName}`} className="map" />
          <div className="markerLayer">
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
        </div>
      </div>
      {active && <div className="detail">ถัง {active.id} | {active.zone} | {active.location} | {statusText(active.status)} | ผู้ตรวจ: {active.inspector} | วันที่: {active.checkedAt}</div>}
    </section>
  );
}

const statusText = (s: Extinguisher["status"]) => (
  s === "checked" ? "ตรวจแล้ว" : s === "warning" ? "ใกล้ตรวจสอบ" : s === "danger" ? "ผิดปกติ" : s === "unchecked" ? "ยังไม่ตรวจ" : "ไม่มีข้อมูล"
);
