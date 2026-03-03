"use client";

import { useState } from "react";
import type { BriefSheetData } from "../types";

interface ExportItem {
  id: string;
  file_type: "md" | "docx";
  created_at: string;
  downloadUrl: string;
}

interface HandoffProject {
  id: string;
  title: string;
  output_type: "slide" | "document";
  created_at: string;
}

interface BriefEditorPanelProps {
  briefSheet: BriefSheetData | null;
  briefError: string | null;
  saving: boolean;
  exportingMd: boolean;
  exportingDocx: boolean;
  handingOff: boolean;
  exports: ExportItem[];
  projects: HandoffProject[];
  onChangeField: (field: keyof BriefSheetData, value: string) => void;
  onSave: () => void;
  onExport: (fileType: "md" | "docx") => void;
  onHandoff: (outputType: "slide" | "document") => void;
}

const FIELDS: Array<{ key: keyof BriefSheetData; label: string; rows: number }> = [
  { key: "client_info", label: "クライアント", rows: 2 },
  { key: "background", label: "背景・課題", rows: 3 },
  { key: "hypothesis", label: "提案の方向性", rows: 3 },
  { key: "goal", label: "ゴール", rows: 2 },
  { key: "constraints", label: "制約条件", rows: 2 },
  { key: "research_topics", label: "リサーチで確認すべきこと", rows: 3 },
  { key: "structure_draft", label: "構成の骨格案", rows: 4 },
];

export function BriefEditorPanel({
  briefSheet,
  briefError,
  saving,
  exportingMd,
  exportingDocx,
  handingOff,
  exports,
  projects,
  onChangeField,
  onSave,
  onExport,
  onHandoff,
}: BriefEditorPanelProps) {
  const [handoffType, setHandoffType] = useState<"slide" | "document">("slide");

  return (
    <div className="w-[420px] border-l border-beige bg-white">
      <div className="border-b border-beige p-3">
        <h2 className="text-sm font-bold text-navy">ブリーフシート</h2>
        <p className="mt-0.5 text-xs text-text-secondary">フォーム編集後に保存できます</p>
      </div>

      <div className="h-[calc(100%-56px)] overflow-auto p-3">
        {briefError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {briefError}
          </div>
        )}

        {!briefSheet ? (
          <p className="text-xs text-text-secondary">
            まず会話を進めてブリーフシートを生成してください。
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {field.label}
                  </label>
                  <textarea
                    rows={field.rows}
                    value={briefSheet[field.key] || ""}
                    onChange={(e) => onChangeField(field.key, e.target.value)}
                    className="w-full rounded-md border border-beige bg-off-white px-2.5 py-1.5 text-xs focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={onSave}
              disabled={saving}
              className="mt-3 w-full rounded-md bg-navy px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {saving ? "保存中..." : "ブリーフを保存"}
            </button>
          </>
        )}

        <div className="mt-4 border-t border-beige pt-3">
          <p className="text-xs font-semibold text-navy">出力</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onExport("md")}
              disabled={!briefSheet || exportingMd}
              className="rounded-md border border-beige bg-white px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-off-white disabled:opacity-50"
            >
              {exportingMd ? "md生成中..." : "md出力"}
            </button>
            <button
              onClick={() => onExport("docx")}
              disabled={!briefSheet || exportingDocx}
              className="rounded-md border border-beige bg-white px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-off-white disabled:opacity-50"
            >
              {exportingDocx ? "docx生成中..." : "docx出力"}
            </button>
          </div>

          {exports.length > 0 && (
            <div className="mt-2 space-y-1">
              {exports.map((item) => (
                <a
                  key={item.id}
                  href={item.downloadUrl}
                  className="flex items-center justify-between rounded border border-beige/70 bg-off-white/40 px-2 py-1 text-[11px] text-text-primary hover:bg-off-white"
                >
                  <span>{item.file_type.toUpperCase()}</span>
                  <span>{new Date(item.created_at).toLocaleString("ja-JP")}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-beige pt-3">
          <p className="text-xs font-semibold text-navy">企画書へ昇格</p>
          <div className="mt-2 flex gap-2">
            <select
              value={handoffType}
              onChange={(e) => setHandoffType(e.target.value as "slide" | "document")}
              className="flex-1 rounded-md border border-beige bg-off-white px-2 py-1.5 text-xs text-text-primary focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
            >
              <option value="slide">スライド（PDF）</option>
              <option value="document">ドキュメント（docx）</option>
            </select>
            <button
              onClick={() => onHandoff(handoffType)}
              disabled={!briefSheet || handingOff}
              className="rounded-md bg-green px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
            >
              {handingOff ? "作成中..." : "昇格する"}
            </button>
          </div>

          {projects.length > 0 && (
            <div className="mt-2 space-y-1">
              {projects.map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}/research`}
                  className="flex items-center justify-between rounded border border-beige/70 bg-off-white/40 px-2 py-1 text-[11px] text-text-primary hover:bg-off-white"
                >
                  <span className="truncate pr-2">{project.title}</span>
                  <span>{project.output_type === "document" ? "doc" : "slide"}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
