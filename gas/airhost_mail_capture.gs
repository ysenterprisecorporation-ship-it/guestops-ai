const AIRHOST_CAPTURE = {
  rawEmailSheet: 'RAW_EMAILS',
  processedLabel: 'GTOS_PROCESSED',
  errorSheet: 'ERROR_LOG',
};

function captureAirHostReservationEmails() {
  const spreadsheetId =
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID is not configured');

  const query =
    PropertiesService.getScriptProperties().getProperty('AIRHOST_GMAIL_QUERY') ||
    'newer_than:2d -label:GTOS_PROCESSED';

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet =
    ss.getSheetByName(AIRHOST_CAPTURE.rawEmailSheet) ||
    ss.insertSheet(AIRHOST_CAPTURE.rawEmailSheet);
  const errorSheet =
    ss.getSheetByName(AIRHOST_CAPTURE.errorSheet) ||
    ss.insertSheet(AIRHOST_CAPTURE.errorSheet);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'received_at',
      'gmail_message_id',
      'subject',
      'from',
      'raw_plain_body',
    ]);
  }
  if (errorSheet.getLastRow() === 0) {
    errorSheet.appendRow(['occurred_at', 'source', 'reference', 'error']);
  }

  let processedLabel = GmailApp.getUserLabelByName(AIRHOST_CAPTURE.processedLabel);
  if (!processedLabel) {
    processedLabel = GmailApp.createLabel(AIRHOST_CAPTURE.processedLabel);
  }

  const threads = GmailApp.search(query, 0, 50);

  threads.forEach((thread) => {
    let allMessagesPersisted = true;

    thread.getMessages().forEach((message) => {
      try {
        const messageId = message.getId();

        if (messageIdExists_(sheet, messageId)) return;

        sheet.appendRow([
          message.getDate(),
          messageId,
          message.getSubject(),
          message.getFrom(),
          message.getPlainBody(),
        ]);
      } catch (err) {
        allMessagesPersisted = false;
        errorSheet.appendRow([
          new Date(),
          'airhost_email_capture',
          thread.getId(),
          String(err),
        ]);
      }
    });

    if (allMessagesPersisted) {
      thread.addLabel(processedLabel);
    }
  });
}

function messageIdExists_(sheet, messageId) {
  if (sheet.getLastRow() < 2) return false;
  const values = sheet
    .getRange(2, 2, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat();
  return values.includes(messageId);
}

/**
 * Intentionally NOT implemented until a sanitized real AirHost notification
 * email sample is supplied. Do not infer a parser from documentation.
 */
function parseAirHostMail_(plainBody) {
  throw new Error('TODO: implement from a sanitized real AirHost email fixture');
}
