import * as vscode from "vscode";
import type { PrevSessionShape, VsCodeStorageShape } from "./lib/types/types";

// Process
let bgProcess: NodeJS.Timer;
let elapsedTimeStatusBar: vscode.StatusBarItem;
let storage: VsCodeStorageShape;
// User settings
let hourlyNotif = true;
let elapsedTimeEnabled = true;
let refreshTime = 60_000;
// Extension variables
let startTime = 0;
let hoursCount = 0;

export async function activate({
  subscriptions,
  globalState,
}: vscode.ExtensionContext) {
  storage = globalState;
  startTime = Date.now();

  fetchUserSetting();
  await handleLastSubmit(); // check if last session

  // StartApp
  if (hourlyNotif || elapsedTimeEnabled) startBgProcess();
  if (elapsedTimeEnabled) {
    elapsedTimeStatusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    elapsedTimeStatusBar.command = "standup-extension.refresh-elapsedTime";
    updateElapsedTimeStatusBar();
  }

  // Commands
  subscriptions.push(
    vscode.commands.registerCommand(
      "standup-extension.refresh-elapsedTime",
      updateElapsedTimeStatusBar
    )
  );
}

/* EXTENSIONS FUNCS */
function startBgProcess() {
  let ticksCount = 0;

  saveSession();
  bgProcess = setInterval(() => {
    ticksCount++;
    saveSession();
    // Check change in settings
    fetchUserSetting();
    if (!hourlyNotif && !elapsedTimeEnabled) {
      elapsedTimeStatusBar.hide();
      return clearInterval(bgProcess);
    }
    // Featues
    const ratioInterval = 3600000 / refreshTime;
    if (hourlyNotif && ticksCount % ratioInterval === 0) popUpNotifyStandUp();
    if (elapsedTimeEnabled) updateElapsedTimeStatusBar();
  }, refreshTime);
}

function updateElapsedTimeStatusBar() {
  const elapsedTime = Math.round((Date.now() - startTime) / 1000 / 60);

  const elapsedHours = Math.floor(elapsedTime / 60);
  const elapsedMinutes = elapsedTime % 60;

  {
    const headerText =
      elapsedHours >= 5 ? "$(extensions-warning-message)" : "⌛";
    const hoursText =
      elapsedHours >= 1
        ? ` ${elapsedHours} hour${elapsedHours > 1 ? "s" : ""}`
        : "";
    const minutesText = ` ${elapsedMinutes} min`;
    const footerText = " Elapsed";

    elapsedTimeStatusBar.text = `${headerText}${hoursText}${minutesText}${footerText}`;
  }

  elapsedTimeStatusBar.show();
  elapsedTimeStatusBar.color = "#ffffff";
  elapsedTimeStatusBar.backgroundColor =
    elapsedHours >= 5
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
}
function popUpNotifyStandUp() {
  hoursCount++;
  vscode.window.showInformationMessage(
    `⏰⏰ Take a Break! 🧍 StandUp! It's been ${hoursCount}`
  );
}

function saveSession() {
  const prevSessionPayload: PrevSessionShape = {
    sessionEndDate: Date.now(),
    sessionStartTime: startTime,
  };
  storage.update("standup-extension.prevSession", prevSessionPayload);
}

function resetPrevSession() {
  storage.update("standup-extension.prevSession", undefined);
}

async function handleLastSubmit() {
  const rawPrevSession = storage.get("standup-extension.prevSession");
  if (typeof rawPrevSession !== "object" || !rawPrevSession)
    return resetPrevSession();
  const { sessionEndDate, sessionStartTime } =
    rawPrevSession as PrevSessionShape;

  const elapsedTimeSincePrevSession =
    (Date.now() - sessionEndDate) / 1000 / 60 / 60;
  if (elapsedTimeSincePrevSession >= 1.5) return resetPrevSession();

  const userChoice = await vscode.window.showWarningMessage(
    `Would you like to resume your previous session? (${new Date(
      sessionEndDate
    ).toLocaleTimeString()})`,
    "✅ Yes",
    "❌ No"
  );

  if (userChoice === "✅ Yes") startTime = sessionStartTime;
  resetPrevSession();
}

function fetchUserSetting() {
  const configs = vscode.workspace.getConfiguration("standup-extension");

  hourlyNotif = configs.get("enableHourlyNotification") || true;
  elapsedTimeEnabled = configs.get("enableElapsedTime") || true;
  refreshTime = configs.get("refreshTime") || 60_000;
}
