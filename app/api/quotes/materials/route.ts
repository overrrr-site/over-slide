import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthJson } from "@/lib/api/auth";
import { ApiError, withErrorHandling } from "@/lib/api/error";
import { parseJsonWithSchema } from "@/lib/api/validation";
import { extractText } from "@/lib/files/extractors";

const MATERIAL_FILE_TYPES = ["pdf", "docx"] as const;
const MATERIAL_SELECT =
  "id, file_type, created_at, storage_path, project:projects(title, client_name)";
const MATERIAL_LIST_LIMIT = 100;
const MATERIAL_MAX_CHARS = 30_000;

const extractRequestSchema = z.object({
  fileId: z.string().uuid("fileId is required"),
});

const materialProjectSchema = z.object({
  title: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
});

const materialRecordSchema = z.object({
  id: z.string().uuid(),
  file_type: z.enum(MATERIAL_FILE_TYPES),
  created_at: z.string(),
  storage_path: z.string(),
  project: z
    .union([materialProjectSchema, z.array(materialProjectSchema), z.null()])
    .optional()
    .default(null),
});

type MaterialRecord = z.infer<typeof materialRecordSchema>;

function parseMaterialRecord(value: unknown): MaterialRecord | null {
  const parsed = materialRecordSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function normalizeProject(
  value: MaterialRecord["project"]
): { title: string; clientName: string } {
  if (!value) {
    return { title: "無題プロジェクト", clientName: "" };
  }

  const row = Array.isArray(value) ? value[0] : value;
  return {
    title: row?.title?.trim() || "無題プロジェクト",
    clientName: row?.client_name?.trim() || "",
  };
}

function buildMaterialTitle(record: MaterialRecord): string {
  const project = normalizeProject(record.project);
  const dateLabel = new Date(record.created_at).toLocaleDateString("ja-JP");
  return `${project.title} / ${record.file_type.toUpperCase()} / ${dateLabel}`;
}

function truncateMaterialText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MATERIAL_MAX_CHARS) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, MATERIAL_MAX_CHARS)}\n...[省略]`,
    truncated: true,
  };
}

export async function GET() {
  return withErrorHandling(
    async () => {
      const auth = await requireAuthJson();
      if (auth instanceof Response) {
        return auth;
      }

      const { supabase } = auth;
      const { data, error } = await supabase
        .from("generated_files")
        .select(MATERIAL_SELECT)
        .in("file_type", MATERIAL_FILE_TYPES)
        .order("created_at", { ascending: false })
        .limit(MATERIAL_LIST_LIMIT);

      if (error) {
        throw new ApiError(error.message, 500);
      }

      const materials = (data || [])
        .map(parseMaterialRecord)
        .filter((row): row is MaterialRecord => row !== null)
        .map((row) => {
          const project = normalizeProject(row.project);
          return {
            id: row.id,
            fileType: row.file_type,
            createdAt: row.created_at,
            projectTitle: project.title,
            clientName: project.clientName,
            title: buildMaterialTitle(row),
          };
        });

      return NextResponse.json({ materials });
    },
    {
      context: "quotes-materials-list",
      fallbackMessage: "資料一覧の取得に失敗しました",
    }
  );
}

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuthJson();
      if (auth instanceof Response) {
        return auth;
      }

      const { supabase } = auth;
      const payload = await parseJsonWithSchema(request, extractRequestSchema);

      const { data, error } = await supabase
        .from("generated_files")
        .select(MATERIAL_SELECT)
        .eq("id", payload.fileId)
        .single();

      if (error || !data) {
        throw new ApiError("資料が見つかりません", 404);
      }

      const material = parseMaterialRecord(data);
      if (!material) {
        throw new ApiError("PDF/DOCX以外の資料は読み込めません", 400);
      }

      if (!material.storage_path) {
        throw new ApiError("資料の保存パスが不正です", 400);
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("generated")
        .download(material.storage_path);

      if (downloadError || !fileData) {
        throw new ApiError(
          downloadError?.message || "資料ダウンロードに失敗しました",
          500
        );
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      let extractedText = "";
      try {
        extractedText = await extractText(buffer, `material.${material.file_type}`);
      } catch (extractError) {
        const message =
          extractError instanceof Error
            ? extractError.message
            : "資料テキスト抽出に失敗しました";
        throw new ApiError(message, 500);
      }

      const normalizedText = extractedText.replace(/\r\n/g, "\n").trim();
      const truncated = truncateMaterialText(normalizedText);

      return NextResponse.json({
        id: material.id,
        fileType: material.file_type,
        title: buildMaterialTitle(material),
        text: truncated.text,
        originalChars: normalizedText.length,
        truncated: truncated.truncated,
      });
    },
    {
      context: "quotes-materials-extract",
      fallbackMessage: "資料読込に失敗しました",
    }
  );
}
