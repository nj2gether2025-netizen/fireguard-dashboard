var FIREGUARD_DASHBOARD_SHEET = "DashboardData";
var FIREGUARD_DASHBOARD_URL = "https://fireguard-dashboard.vercel.app";
var FIREGUARD_MONTH_COLUMNS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function monthlyFireGuardAlert() {
  var rows = getFireGuardDashboardRows_();
  var currentMonth = FIREGUARD_MONTH_COLUMNS[new Date().getMonth()];
  var summary = summarizeFireGuardRows_(rows, currentMonth);
  var message = buildFireGuardLineMessage_(summary, currentMonth);

  pushFireGuardLineMessage_(message);
}

function installMonthlyFireGuardAlertTrigger() {
  var triggers = ScriptApp.getProjectTriggers();

  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === "monthlyFireGuardAlert") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("monthlyFireGuardAlert")
    .timeBased()
    .onMonthDay(25)
    .atHour(9)
    .create();
}

function previewMonthlyFireGuardAlert() {
  var rows = getFireGuardDashboardRows_();
  var currentMonth = FIREGUARD_MONTH_COLUMNS[new Date().getMonth()];
  var summary = summarizeFireGuardRows_(rows, currentMonth);
  var message = buildFireGuardLineMessage_(summary, currentMonth);

  Logger.log(message);
  return message;
}

function getFireGuardDashboardRows_() {
  var sheet = getFireGuardSpreadsheet_().getSheetByName(FIREGUARD_DASHBOARD_SHEET);
  if (!sheet) {
    throw new Error("ไม่พบชีต " + FIREGUARD_DASHBOARD_SHEET);
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headers = [];
  for (var h = 0; h < values[0].length; h += 1) {
    headers.push(String(values[0][h]).trim());
  }

  var records = [];
  for (var r = 1; r < values.length; r += 1) {
    var row = values[r];
    var hasValue = false;
    var record = {};

    for (var c = 0; c < row.length; c += 1) {
      if (String(row[c]).trim() !== "") {
        hasValue = true;
      }
      record[headers[c]] = row[c];
    }

    if (hasValue) {
      records.push(record);
    }
  }

  return records;
}

function getFireGuardSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty("FIREGUARD_SPREADSHEET_ID");
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("ไม่พบ Active Spreadsheet และยังไม่ได้ตั้งค่า FIREGUARD_SPREADSHEET_ID");
  }

  return active;
}

function summarizeFireGuardRows_(rows, currentMonth) {
  var buildings = {};
  var summary = {
    total: 0,
    checked: 0,
    unchecked: 0,
    completeness: 0,
    buildings: buildings
  };

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var building = String(row["อาคาร"] || "ไม่ระบุอาคาร").trim();
    var tankId = String(row["รหัสถังดับเพลิง"] || "").trim();

    if (!tankId) {
      continue;
    }

    var status = getFireGuardStatus_(row, currentMonth);
    if (!buildings[building]) {
      buildings[building] = { total: 0, checked: 0, unchecked: 0 };
    }

    summary.total += 1;
    buildings[building].total += 1;

    if (status === "ตรวจแล้ว") {
      summary.checked += 1;
      buildings[building].checked += 1;
    } else {
      summary.unchecked += 1;
      buildings[building].unchecked += 1;
    }
  }

  summary.completeness = summary.total ? Math.round((summary.checked / summary.total) * 100) : 0;
  return summary;
}

function getFireGuardStatus_(row, currentMonth) {
  var monthStatus = normalizeFireGuardStatus_(row[currentMonth]);
  if (monthStatus) {
    return monthStatus;
  }

  var latest = row["ตรวจล่าสุด"];
  var latestStatus = normalizeFireGuardStatus_(latest);
  if (latestStatus) {
    return latestStatus;
  }

  if (latest instanceof Date) {
    return isSameFireGuardMonth_(latest, new Date()) ? "ตรวจแล้ว" : "ยังไม่ได้ตรวจ";
  }

  var parsedLatest = parseFireGuardDate_(latest);
  if (parsedLatest) {
    return isSameFireGuardMonth_(parsedLatest, new Date()) ? "ตรวจแล้ว" : "ยังไม่ได้ตรวจ";
  }

  return "ยังไม่ได้ตรวจ";
}

function normalizeFireGuardStatus_(value) {
  var raw = String(value || "").trim();
  var normalized = raw.toLowerCase();

  if (!raw) {
    return "";
  }
  if (raw === "ตรวจแล้ว" || raw === "ปกติ" || inList_(normalized, ["checked", "done", "ok", "yes", "y", "1"])) {
    return "ตรวจแล้ว";
  }
  if (raw === "ยังไม่ได้ตรวจ" || raw === "ยังไม่ตรวจ" || inList_(normalized, ["unchecked", "pending", "no", "n", "0", "x"])) {
    return "ยังไม่ได้ตรวจ";
  }

  return "";
}

function inList_(value, list) {
  for (var i = 0; i < list.length; i += 1) {
    if (list[i] === value) {
      return true;
    }
  }

  return false;
}

function parseFireGuardDate_(value) {
  if (!value) {
    return null;
  }

  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isSameFireGuardMonth_(dateA, dateB) {
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth();
}

function buildFireGuardLineMessage_(summary, currentMonth) {
  var buildingNames = Object.keys(summary.buildings).sort(function (a, b) {
    return a.localeCompare(b, "th");
  });
  var buildingLines = [];

  for (var i = 0; i < buildingNames.length; i += 1) {
    var building = buildingNames[i];
    var item = summary.buildings[building];
    buildingLines.push(
      "🏥 อาคาร" + building + "\n" +
      "ทั้งหมด " + item.total + " | ตรวจแล้ว " + item.checked + " | ยังไม่ได้ตรวจ " + item.unchecked
    );
  }

  return [
    "🧯 FireGuard Alert",
    "สรุปสถานะการตรวจถังดับเพลิง ประจำเดือนนี้",
    "",
    "📅 เดือน: " + currentMonth,
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
    FIREGUARD_DASHBOARD_URL
  ].join("\n");
}

function pushFireGuardLineMessage_(message) {
  var properties = PropertiesService.getScriptProperties();
  var channelAccessToken = properties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  var groupId = properties.getProperty("LINE_GROUP_ID") || properties.getProperty("GROUP_ID");

  if (!channelAccessToken) {
    throw new Error("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน Script Properties");
  }
  if (!groupId) {
    throw new Error("ยังไม่ได้ตั้งค่า LINE_GROUP_ID หรือ GROUP_ID เดิมใน Script Properties");
  }

  var response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + channelAccessToken
    },
    payload: JSON.stringify({
      to: groupId,
      messages: [
        {
          type: "text",
          text: message
        }
      ]
    }),
    muteHttpExceptions: true
  });

  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("ส่ง LINE ไม่สำเร็จ (" + statusCode + "): " + response.getContentText());
  }
}
