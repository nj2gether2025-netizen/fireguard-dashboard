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
type StatusCounts = { total: number; checked: number; unchecked: number; warning: number; danger: number; unknown: number };
type OverlayKey = "checked" | "danger" | "unchecked" | "updated";
type OverlayPosition = { left: number; top: number };
type KpiTone = "neutral" | "success" | "warning" | "danger" | "muted";

const MONTH_COLUMNS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const CURRENT_MONTH = MONTH_COLUMNS[new Date().getMonth()];
const CURRENT_DATE_LABEL = new Intl.DateTimeFormat("th-TH", { dateStyle: "full" }).format(new Date());
const CURRENT_MAP_DATE_LABEL = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
const DEFAULT_MAP_OVERLAY_POSITIONS: Record<OverlayKey, OverlayPosition> = {
  checked: { left: 55.2, top: 14.9 },
  danger: { left: 68.2, top: 14.9 },
  unchecked: { left: 80.9, top: 14.9 },
  updated: { left: 93.1, top: 14.9 }
};
const MAP_OVERLAY_POSITIONS: Record<string, Record<OverlayKey, OverlayPosition>> = {
  "cr.png": {
    checked: { left: 54.0, top: 16.8 },
    danger: { left: 66.4, top: 16.8 },
    unchecked: { left: 78.9, top: 16.8 },
    updated: { left: 91.8, top: 16.8 }
  },
  "er-floor1.png": {
    checked: { left: 50.8, top: 7.9 },
    danger: { left: 64.0, top: 7.9 },
    unchecked: { left: 77.1, top: 7.9 },
    updated: { left: 91.2, top: 7.9 }
  },
  "er-floor2.png": {
    checked: { left: 50.7, top: 8.9 },
    danger: { left: 64.1, top: 8.9 },
    unchecked: { left: 77.4, top: 8.9 },
    updated: { left: 91.4, top: 8.9 }
  },
  "ipd.png": {
    checked: { left: 54.1, top: 8.2 },
    danger: { left: 66.6, top: 8.2 },
    unchecked: { left: 79.3, top: 8.2 },
    updated: { left: 92.4, top: 8.2 }
  },
  "mt-floor1.png": {
    checked: { left: 53.3, top: 10.9 },
    danger: { left: 65.0, top: 10.9 },
    unchecked: { left: 78.0, top: 10.9 },
    updated: { left: 92.2, top: 10.9 }
  },
  "mt-floor2.png": {
    checked: { left: 53.9, top: 17.0 },
    danger: { left: 66.4, top: 17.0 },
    unchecked: { left: 78.8, top: 17.0 },
    updated: { left: 91.7, top: 17.0 }
  },
  "opd.png": {
    checked: { left: 54.6, top: 10.7 },
    danger: { left: 66.6, top: 10.7 },
    unchecked: { left: 79.6, top: 10.7 },
    updated: { left: 92.6, top: 10.7 }
  }
};

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

const hasMonthStatusValue = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const getCurrentMonthStatusValue = (record: Record<string, unknown>) =>
  record[CURRENT_MONTH] ?? pick(record, ["status", "result", "สถานะ", "checked"]);

export default function HomePage() {
  const [rows, setRows] = useState<Extinguisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedMap, setSelectedMap] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const filtered = useMemo(() => {
    if (selectedMonth === "all") {
      // "all" intentionally keeps the current snapshot loaded from the source.
      return rows;
    }

    return rows.map((r) => {
      const monthStatus = r.monthlyStatuses[selectedMonth];
      const hasRecordInSelectedMonth = hasMonthStatusValue(monthStatus);

      return {
        ...r,
        status: hasRecordInSelectedMonth ? parseStatus(monthStatus) : "unchecked",
        checkedAt: hasRecordInSelectedMonth ? selectedMonth : "ยังไม่ตรวจ"
      };
    });
  }, [rows, selectedMonth]);
  const maps = useMemo(() => Array.from(new Set(filtered.map((r) => r.mapName))).sort(), [filtered]);

  const mapScoped = useMemo(
    () => (selectedMap === "all" ? filtered : filtered.filter((r) => r.mapName === selectedMap)),
    [filtered, selectedMap]
  );

  const activeItem = useMemo(
    () => (activeId ? mapScoped.find((r) => r.id === activeId) ?? null : null),
    [activeId, mapScoped]
  );

  const selectedMapImage = useMemo(() => {
    return mapScoped.find((r) => r.mapImage)?.mapImage || "/maps/er-floor1.png";
  }, [mapScoped]);

  useEffect(() => {
    if (selectedMap !== "all" && !maps.includes(selectedMap)) {
      setSelectedMap("all");
    }
  }, [maps, selectedMap]);

  useEffect(() => {
    if (activeId && !mapScoped.some((r) => r.id === activeId)) {
      setActiveId(null);
    }
  }, [activeId, mapScoped]);

  const kpi = useMemo(() => {
    const total = mapScoped.length;
    const checked = mapScoped.filter((r) => r.status === "checked").length;
    const warning = mapScoped.filter((r) => r.status === "warning" || r.status === "unchecked").length;
    const danger = mapScoped.filter((r) => r.status === "danger").length;
    const unknown = mapScoped.filter((r) => r.status === "unknown").length;
    const unchecked = mapScoped.filter((r) => needsInspection(r.status)).length;
    const completeness = total ? Math.round((checked / total) * 100) : 0;
    return { total, checked, warning, danger, unknown, unchecked, completeness };
  }, [mapScoped]);

  const tableOptions: { label: string; title: string; data: Extinguisher[]; value: TableView }[] = [
    { label: "ทั้งหมด", title: "ตารางถังทั้งหมด", data: mapScoped, value: "all" },
    { label: "ยังไม่ได้ตรวจ", title: "ตารางถังที่ยังไม่ตรวจ", data: mapScoped.filter((r) => needsInspection(r.status)), value: "unchecked" },
    { label: "ตรวจแล้ว", title: "ตารางถังที่ตรวจแล้ว", data: mapScoped.filter((r) => r.status === "checked"), value: "checked" }
  ];
  const selectedTable = tableOptions.find((option) => option.value === tableView) ?? tableOptions[0];

  return (
    <main className="container">
      <header className="dashboardHeader">
        <div>
          <p className="eyebrow">ระบบติดตามการตรวจถังดับเพลิง</p>
          <h1>FireGuard QR Dashboard</h1>
          <p className="hospitalUnit">ENV Team โรงพยาบาลบางคล้า</p>
        </div>
        <div className="headerMeta" aria-label="ข้อมูลปัจจุบันของแดชบอร์ด">
          <span>วันที่อัปเดต: {CURRENT_DATE_LABEL}</span>
          <span>เดือนที่เลือก: {selectedMonth}</span>
        </div>
      </header>
      {loading && <LoadingPanel />}
      {error && <ErrorPanel message={error} />}

      {!loading && !error && (
        <>
          <section className="kpis">
            <Card label="ถังทั้งหมด" value={kpi.total} tone="neutral" helper="ในขอบเขตที่เลือก" />
            <Card label="ตรวจแล้ว/ปกติ" value={kpi.checked} tone="success" helper={`${kpi.completeness}% ครบถ้วน`} />
            <Card label="รอตรวจ/ใกล้ครบกำหนด" value={kpi.warning} tone="warning" helper="ต้องติดตามตามรอบ" />
            <Card label="ผิดปกติ/อันตราย" value={kpi.danger} tone="danger" helper="ควรเร่งตรวจสอบ" />
            <Card label="ไม่มีข้อมูล" value={kpi.unknown} tone="muted" helper="สถานะไม่ชัดเจน" />
          </section>

          <section className="filter" aria-label="ตัวกรองข้อมูล">
            <div className="filterControl">
              <label htmlFor="month">เดือนที่ต้องการดู</label>
              <select id="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="all">ทั้งหมด</option>
                {MONTH_COLUMNS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="filterControl">
              <label htmlFor="map">อาคาร/แผนผัง</label>
              <select id="map" value={selectedMap} onChange={(e) => { setSelectedMap(e.target.value); setActiveId(null); }}>
                <option value="all">ทั้งหมด</option>
                {maps.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {mapScoped.length === 0 ? (
            <EmptyState selectedMonth={selectedMonth} selectedMap={selectedMap} />
          ) : (
            <>
              <MapSection data={mapScoped} mapImage={selectedMapImage} mapName={selectedMap} active={activeItem} setActiveId={setActiveId} />
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
        </>
      )}
    </main>
  );
}

function Card({ label, value, tone, helper }: { label: string; value: string | number; tone: KpiTone; helper: string }) {
  return (
    <article className={`card ${tone}`}>
      <h3>{label}</h3>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function LoadingPanel() {
  return (
    <section className="statePanel" aria-live="polite">
      <span className="stateIndicator" />
      <div>
        <h2>กำลังโหลดข้อมูลการตรวจถังดับเพลิง</h2>
        <p>ระบบกำลังเชื่อมต่อข้อมูลล่าสุดจากแหล่งข้อมูล FireGuard กรุณารอสักครู่</p>
      </div>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="statePanel errorPanel" role="alert">
      <div>
        <h2>ไม่สามารถโหลดข้อมูล Dashboard ได้</h2>
        <p className="errorMessage">{message}</p>
        <p>สาเหตุที่เป็นไปได้: การเชื่อมต่อข้อมูลขัดข้อง, Apps Script ไม่ตอบสนอง หรือสิทธิ์เข้าถึงข้อมูลไม่ถูกต้อง</p>
        <p>โปรดลองรีเฟรชหน้าเว็บอีกครั้ง หากยังพบปัญหาให้แจ้งผู้ดูแลระบบหรือทีม ENV เพื่อตรวจสอบ</p>
      </div>
    </section>
  );
}

function EmptyState({ selectedMonth, selectedMap }: { selectedMonth: string; selectedMap: string }) {
  return (
    <section className="statePanel emptyPanel">
      <div>
        <h2>ไม่พบข้อมูลตามตัวกรองที่เลือก</h2>
        <p>เดือนที่เลือก: {selectedMonth} | อาคาร/แผนผัง: {selectedMap === "all" ? "ทั้งหมด" : selectedMap}</p>
        <p>ลองเลือกเดือนหรืออาคารอื่น หรือแจ้งผู้ดูแลให้ตรวจสอบข้อมูลใน Google Sheet</p>
      </div>
    </section>
  );
}

function TableSection({ title, data }: { title: string; data: Extinguisher[] }) {
  return (
    <section>
      <h2>{title}</h2>
      {data.length === 0 ? (
        <EmptyState selectedMonth={title} selectedMap="ตารางนี้" />
      ) : (
        <>
          <div className="tableWrap desktopTable">
            <table>
              <thead><tr><th>รหัส</th><th>อาคาร/โซน</th><th>ตำแหน่ง</th><th>สถานะ</th><th>ผู้ตรวจ</th><th>วันที่</th></tr></thead>
              <tbody>
                {data.map((r) => (
                  <tr key={`${title}-${r.id}`} className={`statusRow ${r.status}`}>
                    <td data-label="รหัส">{r.id}</td><td data-label="อาคาร/โซน">{r.zone}</td><td data-label="ตำแหน่ง">{r.location}</td><td data-label="สถานะ"><span className={`statusBadge ${r.status}`}>{statusText(r.status)}</span></td><td data-label="ผู้ตรวจ">{r.inspector}</td><td data-label="วันที่">{r.checkedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobileTankList">
            {data.map((r) => (
              <article key={`mobile-${title}-${r.id}`} className={`mobileTankCard ${r.status}`}>
                <div className="mobileTankHeader">
                  <div>
                    <span className="mobileTankLabel">รหัสถัง/จุดตรวจ</span>
                    <h3>{r.id}</h3>
                  </div>
                  <span className={`statusBadge ${r.status}`}>{mobileStatusText(r.status)}</span>
                </div>
                <dl className="mobileTankDetails">
                  <div><dt>อาคาร/ชั้น/โซน</dt><dd>{r.zone}</dd></div>
                  <div><dt>ตำแหน่ง</dt><dd>{r.location}</dd></div>
                  <div><dt>วันที่ตรวจ</dt><dd>{r.checkedAt}</dd></div>
                  {r.inspector !== "ไม่ระบุ" && <div><dt>ผู้ตรวจ</dt><dd>{r.inspector}</dd></div>}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function MapSection({
  data,
  mapImage,
  mapName,
  active,
  setActiveId
}: {
  data: Extinguisher[];
  mapImage: string;
  mapName: string;
  active: Extinguisher | null;
  setActiveId: (id: string) => void;
}) {
  const [coordinate, setCoordinate] = useState<{ mapX: number; mapY: number } | null>(null);
  const [coordinateToolOpen, setCoordinateToolOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const statusCounts = useMemo(() => {
    return data.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      { total: 0, checked: 0, unchecked: 0, warning: 0, danger: 0, unknown: 0 }
    ) as StatusCounts;
  }, [data]);

  const readMapCoordinate = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mapX = ((event.clientX - rect.left) / rect.width) * 100;
    const mapY = ((event.clientY - rect.top) / rect.height) * 100;

    setCoordinate({ mapX, mapY });
    setCopyStatus("");
  };

  const copyCoordinate = async () => {
    if (!coordinate) return;

    const text = `mapX: ${coordinate.mapX.toFixed(2)}, mapY: ${coordinate.mapY.toFixed(2)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("คัดลอกพิกัดแล้ว");
    } catch {
      setCopyStatus("คัดลอกอัตโนมัติไม่ได้ กรุณาคัดลอกค่าจาก panel");
    }
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
      <div className="mapHeader">
        <div>
          <h2>แผนผังถังดับเพลิง {mapName !== "all" ? `(${mapName})` : ""}</h2>
          <p className="mapHint">เลือกจุดบนแผนผังเพื่อดูรายละเอียดถังดับเพลิง</p>
        </div>
        <button
          type="button"
          className="coordinateToolToggle"
          onClick={() => {
            setCoordinateToolOpen((open) => !open);
            setCopyStatus("");
          }}
        >
          เครื่องมือพิกัดแผนที่
        </button>
      </div>
      <div className="mapBox">
        <div className="mapStage" onClick={readMapCoordinate}>
          <img src={mapImage} alt={`แผนผัง ${mapName === "all" ? "รวมทุกอาคาร" : mapName}`} className="map" />
          <MapImageStatusCounts counts={statusCounts} mapImage={mapImage} />
          <div className="markerLayer">
            {data.map((r) => {
              if (r.mapX === null || r.mapY === null || Number.isNaN(r.mapX) || Number.isNaN(r.mapY)) return null;
              return (
                <button
                  key={`marker-${r.id}`}
                  className={`marker ${r.status} ${active?.id === r.id ? "active" : ""}`}
                  style={{ left: `${r.mapX}%`, top: `${r.mapY}%` }}
                  onClick={() => setActiveId(r.id)}
                  aria-label={`ถัง ${r.id}`}
                />
              );
            })}
          </div>
        </div>
      </div>
      {coordinateToolOpen && (
        <div className="coordinatePanel">
          <div>
            <p className="coordinatePanelLabel">โหมดแก้พิกัดแผนที่</p>
            <h3>เครื่องมือพิกัดสำหรับผู้ดูแล</h3>
            <p>คลิกบนแผนที่เพื่อดูค่า mapX/mapY แล้วนำไปปรับใน Google Sheet</p>
          </div>
          <dl className="coordinateValues">
            <div>
              <dt>รหัสถัง/จุดล่าสุดที่คลิก</dt>
              <dd>{active ? active.id : "ยังไม่ได้เลือกจุดตรวจ"}</dd>
            </div>
            <div>
              <dt>mapX ล่าสุด</dt>
              <dd>{coordinate ? coordinate.mapX.toFixed(2) : "-"}</dd>
            </div>
            <div>
              <dt>mapY ล่าสุด</dt>
              <dd>{coordinate ? coordinate.mapY.toFixed(2) : "-"}</dd>
            </div>
          </dl>
          <div className="coordinateActions">
            <button type="button" onClick={copyCoordinate} disabled={!coordinate}>
              คัดลอกพิกัด
            </button>
            <button type="button" className="secondary" onClick={() => setCoordinateToolOpen(false)}>
              ปิดเครื่องมือ
            </button>
          </div>
          {copyStatus && <p className="copyStatus">{copyStatus}</p>}
        </div>
      )}
      {active && (
        <article className={`inspectionDetail ${active.status}`}>
          <div className="inspectionDetailHeader">
            <div>
              <span className="mobileTankLabel">รายละเอียดจุดตรวจ</span>
              <h3>{active.id}</h3>
            </div>
            <span className={`statusBadge ${active.status}`}>{statusText(active.status)}</span>
          </div>
          <dl className="inspectionDetailGrid">
            <div><dt>อาคาร/ชั้น/โซน</dt><dd>{active.zone}</dd></div>
            <div><dt>ตำแหน่ง</dt><dd>{active.location}</dd></div>
            <div><dt>ผู้ตรวจ</dt><dd>{active.inspector}</dd></div>
            <div><dt>วันที่ตรวจ</dt><dd>{active.checkedAt}</dd></div>
          </dl>
        </article>
      )}
    </section>
  );
}

function MapImageStatusCounts({
  counts,
  mapImage
}: {
  counts: StatusCounts;
  mapImage: string;
}) {
  const notChecked = counts.unchecked + counts.warning + counts.unknown;
  const imageName = mapImage.split("/").pop() ?? "";
  const positions = MAP_OVERLAY_POSITIONS[imageName] ?? DEFAULT_MAP_OVERLAY_POSITIONS;
  const positionStyle = (key: OverlayKey) => ({
    left: `${positions[key].left}%`,
    top: `${positions[key].top}%`
  });

  return (
    <div className="mapImageCounts" aria-label="จำนวนถังตามสถานะบนแผนผัง">
      <span className="mapImageCount checked" style={positionStyle("checked")} title="ปกติ">{counts.checked}</span>
      <span className="mapImageCount danger" style={positionStyle("danger")} title="ผิดปกติ">{counts.danger}</span>
      <span className="mapImageCount unchecked" style={positionStyle("unchecked")} title="ยังไม่ได้ตรวจ">{notChecked}</span>
      <span className="mapImageCount updated" style={positionStyle("updated")} title="อัปเดตล่าสุด">{CURRENT_MAP_DATE_LABEL}</span>
    </div>
  );
}

const statusText = (s: Extinguisher["status"]) => (
  s === "checked" ? "ตรวจแล้ว" : s === "warning" ? "ใกล้ตรวจสอบ" : s === "danger" ? "ผิดปกติ" : s === "unchecked" ? "ยังไม่ตรวจ" : "ไม่มีข้อมูล"
);

const mobileStatusText = (s: Extinguisher["status"]) => (
  s === "checked" ? "ตรวจแล้ว" : s === "danger" ? "ผิดปกติ" : s === "unchecked" ? "ยังไม่ได้ตรวจ" : statusText(s)
);
