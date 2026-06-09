/*
  Security note:
  - Do not paste real LINE tokens, user IDs, group IDs, API keys, or other credentials into this source file.
  - Store LINE_CHANNEL_ACCESS_TOKEN and LINE_GROUP_ID (or GROUP_ID) in Apps Script > Project Settings > Script Properties.

  วิธีใช้:
  1. ในไฟล์ รหัส.gs เดิม ให้หา function monthlyFireGuardAlert()
  2. แทนที่เฉพาะ function monthlyFireGuardAlert() เดิมด้วยฟังก์ชันด้านล่าง
  3. สำคัญ: ห้ามใส่ token จริง หรือ userId/groupId จริงลงใน source code ให้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_GROUP_ID หรือ GROUP_ID ใน Script Properties แทน
  4. Copy helper functions ตั้งแต่ buildFireGuardMonthlyAlertMessage_ ลงไปวางท้ายไฟล์ รหัส.gs
  5. ไม่ต้องลบ doPost, sendLineTest, sendMayUncheckedAlert, runMayAlert, isWorkingDay, isHoliday, doGet
*/

function monthlyFireGuardAlert() {
  // อ่านค่า credential จาก Script Properties เท่านั้น ห้าม hardcode token จริงใน source code
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  const userId = properties.getProperty("LINE_GROUP_ID") || properties.getProperty("GROUP_ID");

  if (!token) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN in Script Properties");
  }
  if (!userId) {
    throw new Error("Missing LINE_GROUP_ID or GROUP_ID in Script Properties");
  }

  const message = buildFireGuardMonthlyAlertMessage_();

  UrlFetchApp.fetch(
    "https://api.line.me/v2/bot/message/push",
    {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      payload: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "text",
            text: message
          }
        ]
      })
    }
  );
}

function buildFireGuardMonthlyAlertMessage_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DashboardData");
  if (!sheet) {
    throw new Error("ไม่พบชีต DashboardData");
  }

  const rows = getFireGuardDashboardRecords_(sheet);
  const monthName = getFireGuardCurrentMonthName_();
  const summary = summarizeFireGuardDashboard_(rows, monthName);
  const buildingNames = Object.keys(summary.buildings).sort();
  const buildingLines = [];

  for (let i = 0; i < buildingNames.length; i++) {
    const building = buildingNames[i];
    const item = summary.buildings[building];
    buildingLines.push(
      "🏥 อาคาร" + building + "\n" +
      "ทั้งหมด " + item.total + " | ตรวจแล้ว " + item.checked + " | ยังไม่ได้ตรวจ " + item.unchecked
    );
  }

  return [
    "🧯 FireGuard Alert",
    "สรุปสถานะการตรวจถังดับเพลิง ประจำเดือนนี้",
    "",
    "📊 ภาพรวม",
    "ถังทั้งหมด: " + summary.total + " ถัง",
    "ตรวจแล้ว: " + summary.checked + " ถัง",
    "ยังไม่ได้ตรวจ: " + summary.unchecked + " ถัง",
    "ความครบถ้วน: " + summary.completeness + "%",
    "",
    "🏢 แยกตามอาคาร",
    buildingLines.join("\n\n") || "ไม่มีข้อมูลอาคาร",
    "",
    "🔎 ดู Dashboard แบบ Real-time",
    "https://fireguard-dashboard.vercel.app"
  ].join("\n");
}

function getFireGuardDashboardRecords_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map(function (header) {
    return String(header).trim();
  });
  const records = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const record = {};
    let hasValue = false;

    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = row[c];
      if (String(row[c]).trim() !== "") {
        hasValue = true;
      }
    }

    if (hasValue) {
      records.push(record);
    }
  }

  return records;
}

function summarizeFireGuardDashboard_(rows, monthName) {
  const summary = {
    total: 0,
    checked: 0,
    unchecked: 0,
    completeness: 0,
    buildings: {}
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tankId = String(row["รหัสถังดับเพลิง"] || "").trim();
    if (!tankId) {
      continue;
    }

    const building = String(row["อาคาร"] || "ไม่ระบุอาคาร").trim();
    const status = getFireGuardDashboardStatus_(row, monthName);

    if (!summary.buildings[building]) {
      summary.buildings[building] = {
        total: 0,
        checked: 0,
        unchecked: 0
      };
    }

    summary.total++;
    summary.buildings[building].total++;

    if (status === "ตรวจแล้ว") {
      summary.checked++;
      summary.buildings[building].checked++;
    } else {
      summary.unchecked++;
      summary.buildings[building].unchecked++;
    }
  }

  summary.completeness = summary.total ? Math.round((summary.checked / summary.total) * 100) : 0;
  return summary;
}

function getFireGuardDashboardStatus_(row, monthName) {
  const monthStatus = normalizeFireGuardMonthlyStatus_(row[monthName]);
  if (monthStatus) {
    return monthStatus;
  }

  return normalizeFireGuardMonthlyStatus_(row["ตรวจล่าสุด"]) || "ยังไม่ได้ตรวจ";
}

function normalizeFireGuardMonthlyStatus_(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    return "";
  }

  if (raw === "ตรวจแล้ว" || raw === "ปกติ" || ["checked", "done", "ok", "yes", "y", "1"].indexOf(normalized) >= 0) {
    return "ตรวจแล้ว";
  }

  if (raw === "ยังไม่ได้ตรวจ" || raw === "ยังไม่ตรวจ" || ["unchecked", "pending", "no", "n", "0", "x"].indexOf(normalized) >= 0) {
    return "ยังไม่ได้ตรวจ";
  }

  return "";
}

function getFireGuardCurrentMonthName_() {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return months[new Date().getMonth()];
}
