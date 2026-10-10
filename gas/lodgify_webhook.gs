const GTOS_CONFIG = {
  spreadsheetId: 'SET_IN_SCRIPT_PROPERTIES_IN_PRODUCTION',
  rawEventsSheet: 'RAW_EVENTS',
};

function doPost(e) {
  try {
    const spreadsheetId =
      PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') ||
      GTOS_CONFIG.spreadsheetId;

    if (!spreadsheetId || spreadsheetId === 'SET_IN_SCRIPT_PROPERTIES_IN_PRODUCTION') {
      throw new Error('SPREADSHEET_ID is not configured');
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet =
      ss.getSheetByName(GTOS_CONFIG.rawEventsSheet) ||
      ss.insertSheet(GTOS_CONFIG.rawEventsSheet);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['received_at', 'source', 'raw_json']);
    }

    const raw = e && e.postData ? e.postData.contents : '';

    sheet.appendRow([
      new Date(),
      'lodgify',
      raw,
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error(err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
