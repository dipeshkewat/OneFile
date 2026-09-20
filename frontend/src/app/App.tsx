import { ChangeEvent, DragEvent, useEffect, useState } from "react";

type WorkflowState = "idle" | "selected" | "processing" | "validated" | "error";
type ToolId =
  | "image-compress"
  | "image-resize"
  | "image-convert"
  | "pdf-compress"
  | "pdf-organize"
  | "pdf-convert"
  | "pdf-enhance"
  | "pdf-review"
  | "pdf-intelligence"
  | "image-to-pdf"
  | "document-convert"
  | "validate";

export type CategoryId =
  | "all"
  | "workflows"
  | "organize"
  | "optimize"
  | "convert"
  | "edit"
  | "security"
  | "intelligence"
  | "images";

type DirectoryItem = {
  id: string;
  toolId: ToolId;
  title: string;
  description: string;
  category: CategoryId;
  categoryLabel: string;
  formats: string;
  accent: "red" | "orange" | "green" | "purple" | "blue" | "yellow" | "indigo" | "teal";
  icon: string;
  initial?: {
    pdfOperation?: string;
    pdfConvertMode?: string;
    pdfEnhanceOperation?: string;
    pdfReviewOperation?: string;
    intelligenceOperation?: string;
    outputFormat?: string;
    resizeMode?: string;
    batchMode?: boolean;
  };
};

type Preset = { id: string; name: string; tool: string; configuration: Record<string, unknown> };
type HistoryEntry = { id: string; tool: string; input_name: string; output_name: string; status: string; created_at: string };

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "workflows", label: "Workflows" },
  { id: "organize", label: "Organize PDF" },
  { id: "optimize", label: "Optimize PDF" },
  { id: "convert", label: "Convert PDF" },
  { id: "edit", label: "Edit PDF" },
  { id: "security", label: "PDF Security" },
  { id: "intelligence", label: "PDF Intelligence" },
  { id: "images", label: "Images" },
];

const DIRECTORY_ITEMS: DirectoryItem[] = [
  // Organize PDF
  {
    id: "merge-pdf",
    toolId: "pdf-organize",
    title: "Merge PDF",
    description: "Combine multiple PDF documents into one single file in any custom order.",
    category: "organize",
    categoryLabel: "Organize",
    formats: "2+ PDF files",
    accent: "red",
    icon: "merge",
    initial: { pdfOperation: "merge" },
  },
  {
    id: "split-pdf",
    toolId: "pdf-organize",
    title: "Split PDF",
    description: "Extract specific pages or page ranges into a separate PDF file.",
    category: "organize",
    categoryLabel: "Organize",
    formats: "PDF · Pages",
    accent: "red",
    icon: "split",
    initial: { pdfOperation: "split" },
  },
  {
    id: "delete-pdf-pages",
    toolId: "pdf-organize",
    title: "Remove PDF pages",
    description: "Delete unwanted pages from your PDF with a simple list of page numbers.",
    category: "organize",
    categoryLabel: "Organize",
    formats: "PDF · Delete",
    accent: "red",
    icon: "delete",
    initial: { pdfOperation: "delete" },
  },
  {
    id: "rotate-pdf",
    toolId: "pdf-organize",
    title: "Rotate PDF",
    description: "Rotate all or specific pages in 90-degree increments to fix orientations.",
    category: "organize",
    categoryLabel: "Organize",
    formats: "PDF · 90°",
    accent: "red",
    icon: "rotate",
    initial: { pdfOperation: "rotate" },
  },
  {
    id: "reorder-pdf",
    toolId: "pdf-organize",
    title: "Reorder PDF pages",
    description: "Rearrange the exact sequence of pages in your PDF document.",
    category: "organize",
    categoryLabel: "Organize",
    formats: "PDF · Reorder",
    accent: "red",
    icon: "reorder",
    initial: { pdfOperation: "reorder" },
  },

  // Optimize PDF
  {
    id: "compress-pdf",
    toolId: "pdf-compress",
    title: "Compress PDF",
    description: "Reduce PDF file size for portal upload while maintaining readability.",
    category: "optimize",
    categoryLabel: "Optimize",
    formats: "PDF · Target MB",
    accent: "orange",
    icon: "compress",
  },
  {
    id: "repair-pdf",
    toolId: "pdf-enhance",
    title: "Repair PDF",
    description: "Fix damaged, corrupt, or unreadable PDF files and rebuild structure.",
    category: "optimize",
    categoryLabel: "Optimize",
    formats: "PDF",
    accent: "orange",
    icon: "repair",
    initial: { pdfEnhanceOperation: "repair" },
  },

  // Convert PDF
  {
    id: "pdf-to-word",
    toolId: "document-convert",
    title: "PDF to Word",
    description: "Convert PDF documents into editable Word DOCX documents.",
    category: "convert",
    categoryLabel: "Convert",
    formats: "PDF → DOCX",
    accent: "green",
    icon: "convert-doc",
    initial: { outputFormat: "docx" },
  },
  {
    id: "word-to-pdf",
    toolId: "document-convert",
    title: "Word to PDF",
    description: "Convert Word DOCX files into standard, upload-ready PDF documents.",
    category: "convert",
    categoryLabel: "Convert",
    formats: "DOCX → PDF",
    accent: "green",
    icon: "convert-doc",
    initial: { outputFormat: "pdf" },
  },
  {
    id: "pdf-to-images",
    toolId: "pdf-convert",
    title: "PDF to Images",
    description: "Extract every page of your PDF into crisp PNG image files in a ZIP.",
    category: "convert",
    categoryLabel: "Convert",
    formats: "PDF → PNG ZIP",
    accent: "green",
    icon: "pdf-to-images",
    initial: { pdfConvertMode: "pdf-to-images" },
  },
  {
    id: "images-to-pdf",
    toolId: "image-to-pdf",
    title: "Images to PDF",
    description: "Combine one or more JPG, PNG, or WebP images into a single clean PDF.",
    category: "convert",
    categoryLabel: "Convert",
    formats: "JPG · PNG · WebP",
    accent: "green",
    icon: "images-to-pdf",
  },

  // Edit PDF
  {
    id: "watermark-pdf",
    toolId: "pdf-enhance",
    title: "Watermark PDF",
    description: "Add a custom diagonal text watermark across all pages of your PDF.",
    category: "edit",
    categoryLabel: "Edit",
    formats: "PDF · Watermark",
    accent: "purple",
    icon: "watermark",
    initial: { pdfEnhanceOperation: "watermark" },
  },
  {
    id: "page-numbers",
    toolId: "pdf-enhance",
    title: "Add Page Numbers",
    description: "Insert clean, numbered pagination at the bottom of every page.",
    category: "edit",
    categoryLabel: "Edit",
    formats: "PDF · Pagination",
    accent: "purple",
    icon: "page-numbers",
    initial: { pdfEnhanceOperation: "page-numbers" },
  },
  {
    id: "crop-pdf",
    toolId: "pdf-enhance",
    title: "Crop PDF",
    description: "Trim page margins, remove headers or footers, or adjust print areas.",
    category: "edit",
    categoryLabel: "Edit",
    formats: "PDF · Margins",
    accent: "purple",
    icon: "crop",
    initial: { pdfEnhanceOperation: "crop" },
  },

  // PDF Security
  {
    id: "protect-pdf",
    toolId: "pdf-enhance",
    title: "Protect PDF",
    description: "Encrypt and lock your PDF document with AES-256 password protection.",
    category: "security",
    categoryLabel: "Security",
    formats: "PDF · AES-256",
    accent: "blue",
    icon: "protect",
    initial: { pdfEnhanceOperation: "protect" },
  },
  {
    id: "unlock-pdf",
    toolId: "pdf-enhance",
    title: "Unlock PDF",
    description: "Remove passwords and security restrictions from an encrypted PDF.",
    category: "security",
    categoryLabel: "Security",
    formats: "PDF · Unlock",
    accent: "blue",
    icon: "unlock",
    initial: { pdfEnhanceOperation: "unlock" },
  },
  {
    id: "redact-pdf",
    toolId: "pdf-review",
    title: "Redact PDF",
    description: "Permanently black out sensitive terms, names, and account numbers.",
    category: "security",
    categoryLabel: "Security",
    formats: "PDF · Redact",
    accent: "blue",
    icon: "redact",
    initial: { pdfReviewOperation: "redact" },
  },

  // PDF Intelligence
  {
    id: "pdf-to-markdown",
    toolId: "pdf-intelligence",
    title: "PDF to Markdown",
    description: "Turn PDF text and heading hierarchy into clean, structured Markdown (.md).",
    category: "intelligence",
    categoryLabel: "Intelligence",
    formats: "PDF → Markdown",
    accent: "yellow",
    icon: "markdown",
    initial: { intelligenceOperation: "pdf-to-markdown" },
  },
  {
    id: "smart-split",
    toolId: "pdf-intelligence",
    title: "Smart Split",
    description: "Automatically split long documents into chapters based on section headings.",
    category: "intelligence",
    categoryLabel: "Intelligence",
    formats: "PDF → Chapters ZIP",
    accent: "yellow",
    icon: "smart-split",
    initial: { intelligenceOperation: "smart-split" },
  },
  {
    id: "compare-pdfs",
    toolId: "pdf-review",
    title: "Compare PDFs",
    description: "Compare two PDF versions side-by-side to highlight page differences.",
    category: "intelligence",
    categoryLabel: "Intelligence",
    formats: "2 PDF files",
    accent: "yellow",
    icon: "compare",
    initial: { pdfReviewOperation: "compare" },
  },

  // Images
  {
    id: "image-compress",
    toolId: "image-compress",
    title: "Compress Image",
    description: "Hit an exact target file size in KB without losing more quality than needed.",
    category: "images",
    categoryLabel: "Images",
    formats: "JPG · PNG · WebP",
    accent: "teal",
    icon: "image-compress",
  },
  {
    id: "image-resize",
    toolId: "image-resize",
    title: "Resize & Crop Image",
    description: "Set exact pixel dimensions or crop to a specific aspect ratio for upload.",
    category: "images",
    categoryLabel: "Images",
    formats: "Exact dimensions",
    accent: "teal",
    icon: "image-resize",
    initial: { resizeMode: "crop" },
  },
  {
    id: "image-convert",
    toolId: "image-convert",
    title: "Convert Image",
    description: "Convert between JPG, PNG, and WebP formats in one clean step.",
    category: "images",
    categoryLabel: "Images",
    formats: "JPG · PNG · WebP",
    accent: "teal",
    icon: "image-convert",
  },

  // Workflows
  {
    id: "validate",
    toolId: "validate",
    title: "Check Requirements",
    description: "Verify format, size, dimensions, resolution, and page count before upload.",
    category: "workflows",
    categoryLabel: "Workflows",
    formats: "All supported files",
    accent: "indigo",
    icon: "validate",
  },
  {
    id: "auto-fix",
    toolId: "validate",
    title: "Auto-Fix & Validate",
    description: "One-click engine: automatically crops, resizes, and compresses to fit.",
    category: "workflows",
    categoryLabel: "Workflows",
    formats: "JPG · PNG · WebP",
    accent: "indigo",
    icon: "auto-fix",
  },
  {
    id: "batch",
    toolId: "image-compress",
    title: "Batch Image Workflow",
    description: "Process multiple images in bulk and download everything in a single ZIP.",
    category: "workflows",
    categoryLabel: "Workflows",
    formats: "Multiple images",
    accent: "indigo",
    icon: "workflows",
    initial: { batchMode: true },
  },
];

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

function acceptsForTool(toolId: ToolId | null, pdfConvertMode: string): string {
  if (!toolId) return ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx";
  if (toolId.startsWith("image-")) return ".jpg,.jpeg,.png,.webp";
  if (toolId.startsWith("pdf-") && toolId !== "pdf-convert") return ".pdf";
  if (toolId === "pdf-convert") return pdfConvertMode === "images-to-pdf" ? ".jpg,.jpeg,.png,.webp" : ".pdf";
  if (toolId === "image-to-pdf") return ".jpg,.jpeg,.png,.webp";
  if (toolId === "document-convert") return ".docx,.pdf";
  return ".jpg,.jpeg,.png,.webp,.pdf";
}

function ToolIcon({ name }: { name: string }) {
  const props = {
    viewBox: "0 0 24 24",
    width: "22",
    height: "22",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "merge":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M12 18v-6" />
          <path d="M9 15l3 3 3-3" />
        </svg>
      );
    case "split":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="2 2" />
          <polyline points="6 9 3 12 6 15" />
          <polyline points="18 9 21 12 18 15" />
        </svg>
      );
    case "delete":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <circle cx="12" cy="14" r="4" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>
      );
    case "rotate":
      return (
        <svg {...props}>
          <path d="M21.5 2v6h-6" />
          <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
        </svg>
      );
    case "reorder":
      return (
        <svg {...props}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="14" y2="12" />
          <line x1="4" y1="18" x2="18" y2="18" />
          <path d="M18 9l3 3-3 3" />
        </svg>
      );
    case "compress":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <polyline points="4 14 8 14 8 18" />
          <polyline points="20 10 16 10 16 6" />
          <line x1="16" y1="10" x2="21" y2="5" />
          <line x1="3" y1="19" x2="8" y2="14" />
        </svg>
      );
    case "repair":
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "convert-doc":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13h8" />
          <path d="M13 10l3 3-3 3" />
        </svg>
      );
    case "pdf-to-images":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "images-to-pdf":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <circle cx="9" cy="13" r="1.5" />
          <path d="M15 17l-3-3-3 3" />
        </svg>
      );
    case "watermark":
      return (
        <svg {...props}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case "page-numbers":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <line x1="8" y1="16" x2="8" y2="18" />
          <line x1="12" y1="14" x2="12" y2="18" />
          <line x1="16" y1="12" x2="16" y2="18" />
        </svg>
      );
    case "crop":
      return (
        <svg {...props}>
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      );
    case "protect":
      return (
        <svg {...props}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "unlock":
      return (
        <svg {...props}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      );
    case "redact":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <line x1="7" y1="12" x2="17" y2="12" strokeWidth="3" stroke="currentColor" />
          <line x1="7" y1="16" x2="14" y2="16" strokeWidth="3" stroke="currentColor" />
        </svg>
      );
    case "compare":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="8" height="16" rx="1" />
          <rect x="14" y="4" width="8" height="16" rx="1" />
          <path d="M10 10l4 4" />
          <path d="M14 10l-4 4" />
        </svg>
      );
    case "markdown":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 15v-6l2.5 3L11 9v6" />
          <path d="M15 12l2 3 2-3" />
        </svg>
      );
    case "smart-split":
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="12" r="3" />
          <path d="M6 9v6" />
          <path d="M8.5 7.5L15.5 10.5" />
          <path d="M8.5 16.5L15.5 13.5" />
        </svg>
      );
    case "image-compress":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      );
    case "image-resize":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
      );
    case "image-convert":
      return (
        <svg {...props}>
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "validate":
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "auto-fix":
      return (
        <svg {...props}>
          <path d="M15 4V2m0 16v-2m8-6h-2M4 12H2m15.5-6.5l-1.5 1.5M6 18l-1.5 1.5M17.5 17.5l1.5 1.5M6 6L4.5 4.5" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "workflows":
    default:
      return (
        <svg {...props}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
  }
}

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [state, setState] = useState<WorkflowState>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [activeItem, setActiveItem] = useState<DirectoryItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [view, setView] = useState<"directory" | "tool">("directory");
  const [message, setMessage] = useState("Choose a job above, then add a file to begin.");
  const [outputFormat, setOutputFormat] = useState("png");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [targetKb, setTargetKb] = useState(100);
  const [resizeMode, setResizeMode] = useState("crop");
  const [pdfOperation, setPdfOperation] = useState("rotate");
  const [pdfConvertMode, setPdfConvertMode] = useState("pdf-to-images");
  const [pdfEnhanceOperation, setPdfEnhanceOperation] = useState("watermark");
  const [watermarkText, setWatermarkText] = useState("OneFile");
  const [pageStart, setPageStart] = useState(1);
  const [pdfPassword, setPdfPassword] = useState("");
  const [cropMargins, setCropMargins] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const [pdfReviewOperation, setPdfReviewOperation] = useState("compare");
  const [redactionTerms, setRedactionTerms] = useState("");
  const [intelligenceOperation, setIntelligenceOperation] = useState("pdf-to-markdown");
  const [pages, setPages] = useState("0");
  const [maxSizeKb, setMaxSizeKb] = useState("");
  const [requiredFormat, setRequiredFormat] = useState("");
  const [requiredWidth, setRequiredWidth] = useState("");
  const [requiredHeight, setRequiredHeight] = useState("");
  const [requiredResolution, setRequiredResolution] = useState("");
  const [requiredPageCount, setRequiredPageCount] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetTool, setPresetTool] = useState<ToolId>("image-compress");

  function chooseItem(item: DirectoryItem) {
    setActiveItem(item);
    setSelectedTool(item.toolId);
    setView("tool");
    setFile(null);
    setSelectedFiles([]);
    setState("idle");
    setProgress(0);
    setBatchMode(item.initial?.batchMode ?? false);

    if (item.initial?.outputFormat) setOutputFormat(item.initial.outputFormat);
    else if (item.toolId === "document-convert") setOutputFormat("pdf");
    else if (item.toolId === "image-convert") setOutputFormat("png");

    if (item.initial?.resizeMode) setResizeMode(item.initial.resizeMode);
    else if (item.toolId === "image-resize") setResizeMode("crop");

    if (item.initial?.pdfOperation) setPdfOperation(item.initial.pdfOperation);
    else if (item.toolId === "pdf-organize") setPdfOperation("merge");

    if (item.initial?.pdfConvertMode) setPdfConvertMode(item.initial.pdfConvertMode);
    else if (item.toolId === "pdf-convert") setPdfConvertMode("pdf-to-images");

    if (item.initial?.pdfEnhanceOperation) setPdfEnhanceOperation(item.initial.pdfEnhanceOperation);
    else if (item.toolId === "pdf-enhance") setPdfEnhanceOperation("watermark");

    if (item.initial?.pdfReviewOperation) setPdfReviewOperation(item.initial.pdfReviewOperation);
    else if (item.toolId === "pdf-review") setPdfReviewOperation("compare");

    if (item.initial?.intelligenceOperation) setIntelligenceOperation(item.initial.intelligenceOperation);
    else if (item.toolId === "pdf-intelligence") setIntelligenceOperation("pdf-to-markdown");

    setMessage(`Add a file to ${item.title.toLowerCase()}.`);
  }

  function goBackToTools() {
    setView("directory");
    setSelectedTool(null);
    setActiveItem(null);
    setFile(null);
    setSelectedFiles([]);
    setState("idle");
    setProgress(0);
    setMessage("Choose a job above, then add a file to begin.");
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    updateFiles(nextFiles);
  }

  function updateFiles(nextFiles: File[]) {
    const nextFile = nextFiles[0] ?? null;
    setFile(nextFile);
    setSelectedFiles(nextFiles);
    setState(nextFile ? "selected" : "idle");
    setProgress(0);
    setMessage(
      nextFile
        ? `${nextFiles.length} file${nextFiles.length === 1 ? "" : "s"} ready to process.`
        : "Choose a job above, then add a file to begin."
    );
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    updateFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(index: number) {
    updateFiles(selectedFiles.filter((_, fileIndex) => fileIndex !== index));
  }

  function moveFile(index: number, direction: -1 | 1) {
    const nextFiles = [...selectedFiles];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= nextFiles.length) return;
    [nextFiles[index], nextFiles[targetIndex]] = [nextFiles[targetIndex], nextFiles[index]];
    updateFiles(nextFiles);
  }

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (view !== "directory") return;
    Promise.all([
      fetch(`${apiUrl}/api/v1/platform/presets`).then((response) => response.json()),
      fetch(`${apiUrl}/api/v1/platform/history`).then((response) => response.json()),
    ])
      .then(([nextPresets, nextHistory]) => {
        setPresets(nextPresets);
        setHistory(nextHistory);
      })
      .catch(() => undefined);
  }, [view]);

  async function savePreset() {
    if (!presetName.trim()) return;
    const response = await fetch(`${apiUrl}/api/v1/platform/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: presetName.trim(), tool: presetTool, configuration: {} }),
    });
    if (response.ok) {
      setPresets([await response.json(), ...presets]);
      setPresetName("");
    }
  }

  function recordHistory(inputName: string, outputName: string, tool: string) {
    void fetch(`${apiUrl}/api/v1/platform/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, input_name: inputName, output_name: outputName, status: "completed" }),
    });
  }

  async function runTool() {
    if (!file || !selectedTool) return;
    if (selectedTool === "pdf-review" && pdfReviewOperation === "compare" && selectedFiles.length < 2) {
      setState("error");
      setMessage("Select two PDF files to compare.");
      return;
    }
    setState("processing");
    setProgress(15);
    setMessage(
      selectedTool === "validate"
        ? "Checking the file before processing..."
        : `Preparing your file with ${activeItem?.title.toLowerCase() ?? selectedTool}...`
    );

    const body = new FormData();
    body.append("file", file);

    try {
      if (selectedTool === "validate") {
        if (maxSizeKb) body.append("max_size_kb", maxSizeKb);
        if (requiredFormat) body.append("required_format", requiredFormat);
        if (requiredWidth) body.append("width", requiredWidth);
        if (requiredHeight) body.append("height", requiredHeight);
        if (requiredResolution) body.append("resolution", requiredResolution);
        if (requiredPageCount) body.append("page_count", requiredPageCount);
        const response = await fetch(`${apiUrl}/api/v1/check/file`, { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "The file could not be checked.");
        setProgress(100);
        setState("validated");
        setMessage(`${result.filename} is valid as ${result.media_type}. Temporary upload data is removed after the check.`);
        recordHistory(file.name, file.name, selectedTool);
        return;
      }

      let endpoint = "/api/v1/images/convert";
      if (batchMode && ["image-compress", "image-resize", "image-convert"].includes(selectedTool)) {
        endpoint = "/api/v1/images/batch";
        body.delete("file");
        for (const selectedFile of selectedFiles) body.append("files", selectedFile);
        body.append("operation", selectedTool.replace("image-", ""));
        if (selectedTool === "image-compress") body.append("target_kb", String(targetKb));
        if (selectedTool === "image-resize") {
          body.append("width", String(width));
          body.append("height", String(height));
        }
        if (selectedTool === "image-convert") body.append("output_format", outputFormat);
      } else if (selectedTool === "image-compress") {
        endpoint = "/api/v1/images/compress";
        body.append("target_kb", String(targetKb));
      } else if (selectedTool === "image-resize") {
        endpoint = "/api/v1/images/resize";
        body.append("width", String(width));
        body.append("height", String(height));
        body.append("crop", String(resizeMode === "crop"));
      } else if (selectedTool === "pdf-compress") {
        endpoint = "/api/v1/pdfs/compress";
      } else if (selectedTool === "pdf-organize") {
        endpoint = `/api/v1/pdfs/${pdfOperation === "delete" ? "pages/delete" : pdfOperation === "reorder" ? "pages/reorder" : pdfOperation}`;
        if (pdfOperation === "merge") {
          body.delete("file");
          for (const selectedFile of selectedFiles) body.append("files", selectedFile);
        } else {
          body.append("pages", pages);
          if (pdfOperation === "rotate") body.append("angle", "90");
        }
      } else if (selectedTool === "pdf-convert") {
        if (pdfConvertMode === "images-to-pdf") {
          endpoint = "/api/v1/images/to-pdf";
          body.delete("file");
          for (const selectedFile of selectedFiles) body.append("files", selectedFile);
        } else {
          endpoint = "/api/v1/pdfs/to-images";
        }
      } else if (selectedTool === "pdf-enhance") {
        endpoint = "/api/v1/pdfs/enhance";
        body.append("operation", pdfEnhanceOperation);
        if (pdfEnhanceOperation === "watermark") body.append("text", watermarkText);
        if (pdfEnhanceOperation === "page-numbers") body.append("start", String(pageStart));
        if (pdfEnhanceOperation === "crop") {
          body.append("left", String(cropMargins.left));
          body.append("top", String(cropMargins.top));
          body.append("right", String(cropMargins.right));
          body.append("bottom", String(cropMargins.bottom));
        }
        if (["protect", "unlock"].includes(pdfEnhanceOperation)) body.append("password", pdfPassword);
      } else if (selectedTool === "pdf-review") {
        if (pdfReviewOperation === "compare") {
          endpoint = "/api/v1/pdfs/compare";
          body.delete("file");
          body.append("first", selectedFiles[0]);
          body.append("second", selectedFiles[1]);
        } else {
          endpoint = "/api/v1/pdfs/redact";
          body.append("terms", redactionTerms);
        }
      } else if (selectedTool === "pdf-intelligence") {
        endpoint = `/api/v1/ai/${intelligenceOperation}`;
      } else if (selectedTool === "image-to-pdf") {
        endpoint = "/api/v1/images/to-pdf";
        body.delete("file");
        for (const selectedFile of selectedFiles) body.append("files", selectedFile);
      } else if (selectedTool === "document-convert") {
        endpoint = "/api/v1/documents/convert";
        body.append("output_format", outputFormat);
      } else {
        body.append("output_format", outputFormat);
        body.append("width", String(width));
        body.append("height", String(height));
      }

      const response = await fetch(`${apiUrl}${endpoint}`, { method: "POST", body });
      setProgress(75);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.detail ?? "The file could not be converted.");
      }

      if (selectedTool === "pdf-review" && pdfReviewOperation === "compare") {
        const result = await response.json();
        setProgress(100);
        setState("validated");
        setMessage(
          result.identical
            ? "The PDF versions are identical."
            : `${result.changed_pages.length} page(s) differ between the PDF versions.`
        );
        return;
      }

      const downloadUrl = URL.createObjectURL(await response.blob());
      const download = document.createElement("a");
      download.href = downloadUrl;
      const extension =
        batchMode ||
        (selectedTool === "pdf-convert" && pdfConvertMode === "pdf-to-images") ||
        (selectedTool === "pdf-intelligence" && intelligenceOperation === "smart-split")
          ? "zip"
          : selectedTool === "pdf-intelligence" && intelligenceOperation === "pdf-to-markdown"
          ? "md"
          : selectedTool === "image-to-pdf" || selectedTool.startsWith("pdf") || selectedTool === "pdf-convert"
          ? "pdf"
          : outputFormat;
      const outputName = `onefile-${file.name.split(".")[0]}.${extension}`;
      download.download = outputName;
      download.click();
      URL.revokeObjectURL(downloadUrl);
      setState("validated");
      setProgress(100);
      setMessage("Your converted file is ready and the download has started.");
      recordHistory(file.name, outputName, selectedTool);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The file could not be processed.");
    }
  }

  async function runAutoFix() {
    if (!file || !file.type.startsWith("image/")) return;
    setState("processing");
    setProgress(15);
    setMessage("Applying crop, resize, conversion, and compression requirements...");
    const body = new FormData();
    body.append("file", file);
    body.append("output_format", requiredFormat || "jpg");
    if (requiredWidth) body.append("width", requiredWidth);
    if (requiredHeight) body.append("height", requiredHeight);
    if (maxSizeKb) body.append("target_kb", maxSizeKb);
    try {
      const response = await fetch(`${apiUrl}/api/v1/images/auto-fix`, { method: "POST", body });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.detail ?? "The requirements could not be satisfied.");
      }
      const url = URL.createObjectURL(await response.blob());
      const download = document.createElement("a");
      download.href = url;
      download.download = `onefile-ready.${requiredFormat || "jpg"}`;
      download.click();
      URL.revokeObjectURL(url);
      setState("validated");
      setProgress(100);
      setMessage("Requirement satisfied. The ready file has been downloaded.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The requirements could not be satisfied.");
    }
  }

  const filteredItems =
    activeCategory === "all"
      ? DIRECTORY_ITEMS
      : DIRECTORY_ITEMS.filter((item) => item.category === activeCategory);

  return (
    <main className="page-shell">
      {/* Intro Header */}
      <section className="intro-panel" aria-labelledby="page-title">
        <p className="kicker">ONEFILE / DOCUMENT & IMAGE WORKSPACE</p>
        <h1 id="page-title">Make your files fit the requirements.</h1>
        <p className="lede">
          Choose the file job you need, set a measurable requirement, and leave with something a portal will accept.
        </p>
        <div className="trust-line">
          <span className="status-dot" /> Temporary processing · no account required
        </div>
      </section>

      {/* Categorized Filter Navigation (matching reference image) */}
      {view === "directory" && (
        <section className="category-filter-section" aria-label="Tool Categories">
          <p className="category-subtitle">
            ...split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
          </p>
          <div className="category-pills" role="tablist">
            {CATEGORIES.map((category) => {
              const count =
                category.id === "all"
                  ? DIRECTORY_ITEMS.length
                  : DIRECTORY_ITEMS.filter((item) => item.category === category.id).length;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`category-pill ${isActive ? "active" : ""}`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <span>{category.label}</span>
                  <span className="category-pill-count">{count}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Directory View */}
      {view === "directory" ? (
        <section className="tool-directory" aria-labelledby="tool-directory-title">
          <div className="directory-heading">
            <div>
              <span className="eyebrow">CHOOSE A FUNCTIONALITY</span>
              <h2 id="tool-directory-title">
                {CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "All"} Tools
              </h2>
            </div>
            <span className="directory-count">
              Showing {filteredItems.length} of {DIRECTORY_ITEMS.length} tools
            </span>
          </div>

          <div className="tool-grid">
            {filteredItems.map((item) => (
              <button
                className={`tool-card tool-${item.accent}`}
                key={item.id}
                type="button"
                onClick={() => chooseItem(item)}
              >
                <span className="tool-topline">
                  <span className="tool-mark" aria-hidden="true">
                    <ToolIcon name={item.icon} />
                  </span>
                  <span className="tool-cat-badge">{item.categoryLabel}</span>
                </span>
                <strong>{item.title}</strong>
                <span className="tool-description">{item.description}</span>
                <span className="tool-format">{item.formats}</span>
                <span className="tool-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </section>
      ) : selectedTool ? (
        /* Workspace Tool View */
        <section className="workspace" aria-label="File preparation workspace">
          <div className="workspace-header">
            <div>
              <button className="back-link" type="button" onClick={goBackToTools}>
                ← Back to tools
              </button>
              <span className="eyebrow">{activeItem?.categoryLabel.toUpperCase() ?? "TOOL"}</span>
              <h2>{activeItem?.title ?? "Configure your file"}</h2>
            </div>
            <span className={`state-pill state-${state}`}>{state}</span>
          </div>

          <div className="upload-section-label">Upload document or image</div>
          <label
            className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
            htmlFor="file-input"
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className="drop-icon" aria-hidden="true">↑</span>
            <span className="drop-title">Drop a file here or browse</span>
            <span className="drop-detail">
              {acceptsForTool(selectedTool, pdfConvertMode)} · up to 10 MB
            </span>
            <input
              id="file-input"
              type="file"
              accept={acceptsForTool(selectedTool, pdfConvertMode)}
              multiple={
                batchMode ||
                selectedTool === "image-to-pdf" ||
                (selectedTool === "pdf-organize" && pdfOperation === "merge") ||
                (selectedTool === "pdf-convert" && pdfConvertMode === "images-to-pdf") ||
                (selectedTool === "pdf-review" && pdfReviewOperation === "compare")
              }
              onChange={selectFile}
            />
          </label>

          {/* Config Controls */}
          {selectedTool === "image-convert" && (
            <div className="config-row">
              <label>
                Convert image to
                <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
            </div>
          )}

          {selectedTool === "image-resize" && (
            <div className="config-row">
              <label>
                Resize mode
                <select value={resizeMode} onChange={(event) => setResizeMode(event.target.value)}>
                  <option value="crop">Crop to exact size</option>
                  <option value="fit">Fit inside dimensions</option>
                </select>
              </label>
              <label>
                Width
                <input
                  type="number"
                  min="1"
                  value={width}
                  onChange={(event) => setWidth(Number(event.target.value))}
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  min="1"
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                />
              </label>
            </div>
          )}

          {selectedTool === "document-convert" && (
            <div className="config-row">
              <label>
                Output format
                <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}>
                  <option value="pdf">PDF</option>
                  <option value="docx">DOCX</option>
                </select>
              </label>
            </div>
          )}

          {selectedTool === "image-compress" && (
            <div className="config-row">
              <label>
                Target size (KB)
                <input
                  type="number"
                  min="1"
                  max="10240"
                  value={targetKb}
                  onChange={(event) => setTargetKb(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
            </div>
          )}

          {selectedTool.startsWith("image-") && selectedTool !== "image-to-pdf" && (
            <label className="batch-toggle">
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(event) => setBatchMode(event.target.checked)}
              />
              Process multiple files and download a ZIP
            </label>
          )}

          {selectedTool === "pdf-organize" && (
            <div className="config-row">
              <label>
                Page operation
                <select value={pdfOperation} onChange={(event) => setPdfOperation(event.target.value)}>
                  <option value="merge">Merge PDFs</option>
                  <option value="rotate">Rotate</option>
                  <option value="delete">Delete pages</option>
                  <option value="reorder">Reorder pages</option>
                  <option value="split">Extract pages</option>
                </select>
              </label>
              {pdfOperation !== "merge" && (
                <label>
                  Pages, zero-based (e.g. 0, 2)
                  <input value={pages} onChange={(event) => setPages(event.target.value)} />
                </label>
              )}
            </div>
          )}

          {selectedTool === "pdf-convert" && (
            <div className="config-row">
              <label>
                Convert from
                <select
                  value={pdfConvertMode}
                  onChange={(event) => {
                    setPdfConvertMode(event.target.value);
                    setFile(null);
                    setSelectedFiles([]);
                    setState("idle");
                  }}
                >
                  <option value="pdf-to-images">PDF to images</option>
                  <option value="images-to-pdf">Images to PDF</option>
                </select>
              </label>
            </div>
          )}

          {selectedTool === "pdf-enhance" && (
            <div className="config-row">
              <label>
                PDF enhancement
                <select
                  value={pdfEnhanceOperation}
                  onChange={(event) => setPdfEnhanceOperation(event.target.value)}
                >
                  <option value="watermark">Watermark</option>
                  <option value="page-numbers">Add page numbers</option>
                  <option value="crop">Crop PDF</option>
                  <option value="protect">Protect PDF</option>
                  <option value="unlock">Unlock PDF</option>
                  <option value="repair">Repair PDF</option>
                </select>
              </label>
              {pdfEnhanceOperation === "watermark" && (
                <label>
                  Watermark text
                  <input value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} />
                </label>
              )}
              {pdfEnhanceOperation === "page-numbers" && (
                <label>
                  Starting number
                  <input
                    type="number"
                    min="1"
                    value={pageStart}
                    onChange={(event) => setPageStart(Number(event.target.value))}
                  />
                </label>
              )}
              {["protect", "unlock"].includes(pdfEnhanceOperation) && (
                <label>
                  Password
                  <input
                    type="password"
                    value={pdfPassword}
                    onChange={(event) => setPdfPassword(event.target.value)}
                  />
                </label>
              )}
              {pdfEnhanceOperation === "crop" && (
                <>
                  <label>
                    Left
                    <input
                      type="number"
                      min="0"
                      value={cropMargins.left}
                      onChange={(event) => setCropMargins({ ...cropMargins, left: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    Top
                    <input
                      type="number"
                      min="0"
                      value={cropMargins.top}
                      onChange={(event) => setCropMargins({ ...cropMargins, top: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    Right
                    <input
                      type="number"
                      min="0"
                      value={cropMargins.right}
                      onChange={(event) => setCropMargins({ ...cropMargins, right: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    Bottom
                    <input
                      type="number"
                      min="0"
                      value={cropMargins.bottom}
                      onChange={(event) => setCropMargins({ ...cropMargins, bottom: Number(event.target.value) })}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {selectedTool === "pdf-review" && (
            <div className="config-row">
              <label>
                Review action
                <select
                  value={pdfReviewOperation}
                  onChange={(event) => {
                    setPdfReviewOperation(event.target.value);
                    setFile(null);
                    setSelectedFiles([]);
                    setState("idle");
                  }}
                >
                  <option value="compare">Compare two PDFs</option>
                  <option value="redact">Redact terms</option>
                </select>
              </label>
              {pdfReviewOperation === "redact" && (
                <label>
                  Terms to redact (comma-separated)
                  <input
                    placeholder="name, address, account"
                    value={redactionTerms}
                    onChange={(event) => setRedactionTerms(event.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          {selectedTool === "pdf-intelligence" && (
            <div className="config-row">
              <label>
                Document intelligence
                <select
                  value={intelligenceOperation}
                  onChange={(event) => setIntelligenceOperation(event.target.value)}
                >
                  <option value="pdf-to-markdown">PDF to Markdown</option>
                  <option value="smart-split">Smart Split</option>
                </select>
              </label>
            </div>
          )}

          {selectedTool === "validate" && (
            <div className="config-row">
              <label>
                Required format
                <select value={requiredFormat} onChange={(event) => setRequiredFormat(event.target.value)}>
                  <option value="">Any supported format</option>
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
              <label>
                Maximum size (KB)
                <input
                  type="number"
                  min="1"
                  value={maxSizeKb}
                  onChange={(event) => setMaxSizeKb(event.target.value)}
                />
              </label>
              <label>
                Required width
                <input
                  type="number"
                  min="1"
                  value={requiredWidth}
                  onChange={(event) => setRequiredWidth(event.target.value)}
                />
              </label>
              <label>
                Required height
                <input
                  type="number"
                  min="1"
                  value={requiredHeight}
                  onChange={(event) => setRequiredHeight(event.target.value)}
                />
              </label>
              <label>
                Minimum resolution
                <input
                  type="number"
                  min="1"
                  value={requiredResolution}
                  onChange={(event) => setRequiredResolution(event.target.value)}
                />
              </label>
              <label>
                Required PDF pages
                <input
                  type="number"
                  min="1"
                  value={requiredPageCount}
                  onChange={(event) => setRequiredPageCount(event.target.value)}
                />
              </label>
            </div>
          )}

          <div className="workflow-row">
            <div className="file-summary" aria-live="polite">
              <span className="summary-label">CURRENT FILE</span>
              <strong>
                {file
                  ? `${file.name}${selectedFiles.length > 1 ? ` + ${selectedFiles.length - 1} more` : ""}`
                  : "No file selected"}
              </strong>
              <span>
                {file
                  ? `${Math.ceil(file.size / 1024)} KB · ${file.type || "unknown type"}`
                  : "Your file stays local until you choose to process it."}
              </span>
            </div>
            <button
              className="primary-action"
              type="button"
              disabled={!file || state === "processing"}
              onClick={runTool}
            >
              {state === "processing" ? "Working..." : "Run this job"}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {state === "processing" && (
            <div className="progress-track" aria-label={`Processing ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="file-list" aria-label="Selected files">
              {selectedFiles.map((selectedFile, index) => (
                <div className="file-row" key={`${selectedFile.name}-${selectedFile.lastModified}`}>
                  <span>
                    {index + 1}. {selectedFile.name}
                  </span>
                  <span className="file-row-actions">
                    <button
                      type="button"
                      onClick={() => moveFile(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${selectedFile.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFile(index, 1)}
                      disabled={index === selectedFiles.length - 1}
                      aria-label={`Move ${selectedFile.name} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${selectedFile.name}`}
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {previewUrl && (
            <div className="preview-panel">
              <span className="summary-label">BEFORE</span>
              <img src={previewUrl} alt="Selected image preview" />
            </div>
          )}

          {selectedTool === "validate" && file?.type.startsWith("image/") && (
            <button
              className="secondary-action"
              type="button"
              disabled={state === "processing"}
              onClick={runAutoFix}
            >
              Auto-fix and validate <span aria-hidden="true">→</span>
            </button>
          )}

          <div className={`message message-${state}`} role="status">
            {message}
          </div>
        </section>
      ) : null}

      {view === "directory" && (
        <section className="platform-panel" aria-label="OneFile workspace">
          <div>
            <span className="eyebrow">WORKSPACE</span>
            <h2>Saved workflows</h2>
            <p className="platform-note">
              Presets and history store metadata only. Uploaded files are never saved here.
            </p>
          </div>
          <div className="preset-form">
            <input
              aria-label="Preset name"
              placeholder="Preset name"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
            />
            <select
              aria-label="Preset tool"
              value={presetTool}
              onChange={(event) => setPresetTool(event.target.value as ToolId)}
            >
              <option value="image-compress">Compress image</option>
              <option value="image-resize">Resize image</option>
              <option value="validate">Check requirements</option>
            </select>
            <button type="button" className="secondary-action" onClick={savePreset}>
              Save preset
            </button>
          </div>
          <div className="platform-columns">
            <div>
              <strong>Saved presets</strong>
              {presets.length ? (
                presets.map((preset) => (
                  <div className="platform-row" key={preset.id}>
                    <span>{preset.name}</span>
                    <small>{preset.tool}</small>
                  </div>
                ))
              ) : (
                <p className="platform-empty">No saved presets yet.</p>
              )}
            </div>
            <div>
              <strong>Recent processing</strong>
              {history.length ? (
                history.slice(0, 5).map((entry) => (
                  <div className="platform-row" key={entry.id}>
                    <span>{entry.input_name}</span>
                    <small>{entry.tool}</small>
                  </div>
                ))
              ) : (
                <p className="platform-empty">No processing history yet.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <footer>
        <span>OneFile is built around measurable requirements.</span>
        <span>Private by default · no account required</span>
      </footer>
    </main>
  );
}
