"use client";

import { type MouseEvent, useEffect, useMemo, useState } from "react";

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
type TableView = "all" | "unchecked" | "checked";

const MONTH_COLUMNS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const CURRENT_MONTH = MONTH_COLUMNS[new Date().getMonth()];
const CURRENT_DATE_LABEL = new Intl.DateTimeFormat("th-TH", { dateStyle: "full" }).format(new Date());

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

const getCurrentMonthStatusValue = (record: Record<string, unknown>) =>
  record[CURRENT_MONTH] ?? pick(record, ["status", "result", "สถานะ", "checked"]);

export default function HomePage() {
  const [rows, setRows] = useState<Extinguisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedMap, setSelectedMap] = useState("all");
  const [active, setActive] = useState<Extinguisher | null>(null);
  const [tableView, setTableView] = useState<TableView>("unchecked");

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
          const status = parseStatus(getCurrentMonthStatusValue(r));
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

  const tableOptions: { label: string; title: string; data: Extinguisher[]; value: TableView }[] = [
    { label: "ทั้งหมด", title: "ตารางถังทั้งหมด", data: mapScoped, value: "all" },
    { label: "ยังไม่ได้ตรวจ", title: "ตารางถังที่ยังไม่ตรวจ", data: mapScoped.filter((r) => needsInspection(r.status)), value: "unchecked" },
    { label: "ตรวจแล้ว", title: "ตารางถังที่ตรวจแล้ว", data: mapScoped.filter((r) => r.status === "checked"), value: "checked" }
  ];
  const selectedTable = tableOptions.find((option) => option.value === tableView) ?? tableOptions[0];

  return (
    <main className="container">
      <header>
        <h1>FireGuard QR Dashboard</h1>
        <p>ENV Team โรงพยาบาลบางคล้า</p>
        <p className="dashboardDate">วันที่ปัจจุบัน: {CURRENT_DATE_LABEL} | ข้อมูลเดือน: {selectedMonth}</p>
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
          <section className="tablePanel">
            <div className="tableTabs" aria-label="เลือกตารางถัง">
              {tableOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`tableTab ${tableView === option.value ? "active" : ""}`}
                  onClick={() => setTableView(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <TableSection title={selectedTable.title} data={selectedTable.data} />
          </section>
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
      <div className="tableWrap desktopTable">
        <table>
          <thead><tr><th>รหัส</th><th>โซน</th><th>ตำแหน่ง</th><th>สถานะ</th><th>ผู้ตรวจ</th><th>วันที่</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={`${title}-${r.id}`} className={`statusRow ${r.status}`}>
                <td data-label="รหัส">{r.id}</td><td data-label="โซน">{r.zone}</td><td data-label="ตำแหน่ง">{r.location}</td><td data-label="สถานะ">{statusText(r.status)}</td><td data-label="ผู้ตรวจ">{r.inspector}</td><td data-label="วันที่">{r.checkedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobileTankList">
        {data.map((r) => (
          <article key={`mobile-${title}-${r.id}`} className="mobileTankCard">
            <div className="mobileTankHeader">
              <h3>{r.id}</h3>
              <span className={`statusBadge ${r.status}`}>{mobileStatusText(r.status)}</span>
            </div>
            <p><strong>อาคาร:</strong> {r.zone}</p>
            <p><strong>จุดติดตั้ง:</strong> {r.location}</p>
            <p><strong>สถานะ:</strong> {mobileStatusText(r.status)}</p>
            <p><strong>{r.status === "unchecked" ? "วันที่ตรวจล่าสุด" : "เดือน/วันที่"}:</strong> {r.checkedAt}</p>
            {r.inspector !== "ไม่ระบุ" && <p><strong>ผู้ตรวจ:</strong> {r.inspector}</p>}
          </article>
        ))}
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
  const [coordinate, setCoordinate] = useState<{ mapX: number; mapY: number } | null>(null);

  const readMapCoordinate = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mapX = ((event.clientX - rect.left) / rect.width) * 100;
    const mapY = ((event.clientY - rect.top) / rect.height) * 100;

    setCoordinate({ mapX, mapY });
  };

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
      <p className="mapHint">คลิกบนแผนผังเพื่อดูค่า mapX/mapY แล้วนำไปใส่ Google Sheet</p>
      <div className="mapBox">
        <div className="mapStage" onClick={readMapCoordinate}>
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
      {coordinate && (
        <div className="coordinateBox">
          {active && <p>กำลังปรับ: รหัสถัง {active.id}</p>}
          <p>mapX: {coordinate.mapX.toFixed(2)}</p>
          <p>mapY: {coordinate.mapY.toFixed(2)}</p>
        </div>
      )}
      {active && <div className="detail">ถัง {active.id} | {active.zone} | {active.location} | {statusText(active.status)} | ผู้ตรวจ: {active.inspector} | วันที่: {active.checkedAt}</div>}
    </section>
  );
}

const statusText = (s: Extinguisher["status"]) => (
  s === "checked" ? "ตรวจแล้ว" : s === "warning" ? "ใกล้ตรวจสอบ" : s === "danger" ? "ผิดปกติ" : s === "unchecked" ? "ยังไม่ตรวจ" : "ไม่มีข้อมูล"
);

const mobileStatusText = (s: Extinguisher["status"]) => (
  s === "checked" ? "ตรวจแล้ว" : s === "danger" ? "ผิดปกติ" : s === "unchecked" ? "ยังไม่ได้ตรวจ" : statusText(s)
);
