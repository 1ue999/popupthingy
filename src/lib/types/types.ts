import type * as vscode from "vscode";

export type VsCodeStorageShape = vscode.Memento & {
  setKeysForSync(keys: readonly string[]): void;
};

export interface PrevSessionShape {
  sessionEndDate: number;
  sessionStartTime: number;
}
