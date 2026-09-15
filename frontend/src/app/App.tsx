import { ChangeEvent, useState } from "react";

type WorkflowState = "idle" | "selected" | "processing" | "validated" | "error";
type ToolId = "image-compress" | "image-resize" | "image-convert" | "pdf-compress" | "pdf-organize" | "pdf-convert" | "image-to-pdf" | "document-convert" | "validate";

type Tool = {
  id: ToolId;
  title: string;
  description: string;
  formats: string;
  accent: string;
  available: boolean;
};

const tools: { label: string; note: string; items: Tool[] }[] = [
  {
    label: "Images",
    note: "Prepare photos, signatures, and scans",
    items: [
      { id: "image-compress", title: "Compress image", description: "Hit a target file size without losing more quality than necessary.", formats: "JPG · PNG · WebP", accent: "orange", available: true },
      { id: "image-resize", title: "Resize & crop", description: "Set exact pixel dimensions or shape an image for a portal.", formats: "Exact dimensions", accent: "green", available: true },
      { id: "image-convert", title: "Convert image", description: "Move between the most useful image formats in one step.", formats: "JPG · PNG · WebP", accent: "yellow", available: true },
    ],
  },
  {
    label: "PDFs",
    note: "Organize pages and reduce document weight",
    items: [
      { id: "pdf-compress", title: "Compress PDF", description: "Reduce a PDF for upload while keeping its pages readable.", formats: "PDF · Target MB", accent: "orange", available: true },
      { id: "pdf-organize", title: "Organize pages", description: "Merge, split, rotate, delete, or reorder PDF pages.", formats: "Merge · Split · Rotate", accent: "green", available: true },
      { id: "pdf-convert", title: "PDF conversion", description: "Turn images into a PDF or render PDF pages as images.", formats: "Image ↔ PDF", accent: "yellow", available: true },
    ],
  },
  {
    label: "Conversions & checks",
    note: "Make the final file ready to submit",
    items: [
      { id: "document-convert", title: "Convert a document", description: "Prepare common document formats for the destination portal.", formats: "DOCX · PDF", accent: "green", available: false },
      { id: "image-to-pdf", title: "Images to PDF", description: "Combine one or more images into a single upload-ready PDF.", formats: "JPG · PNG · WebP", accent: "yellow", available: true },
      { id: "validate", title: "Check requirements", description: "Confirm format, size, dimensions, and page count before upload.", formats: "All supported files", accent: "orange", available: true },
    ],
  },
];

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function acceptsForTool(tool: Tool | undefined): string {
  if (!tool) return ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx";
  if (tool.id.startsWith("image-")) return ".jpg,.jpeg,.png,.webp";
  if (tool.id.startsWith("pdf-") && tool.id !== "pdf-convert") return ".pdf";
  if (tool.id === "pdf-convert") return ".pdf";
  if (tool.id === "image-to-pdf") return ".jpg,.jpeg,.png,.webp";
  if (tool.id === "document-convert") return ".doc,.docx,.pdf";
  return ".jpg,.jpeg,.png,.webp,.pdf";
}

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [state, setState] = useState<WorkflowState>("idle");
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [message, setMessage] = useState("Choose a job above, then add a file to begin.");
  const [outputFormat, setOutputFormat] = useState("png");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [targetKb, setTargetKb] = useState(100);
  const [pdfOperation, setPdfOperation] = useState("rotate");
  const [pages, setPages] = useState("0");

  const activeTool = tools.flatMap((group) => group.items).find((tool) => tool.id === selectedTool);

  function chooseTool(tool: Tool) {
    setSelectedTool(tool.id);
    setFile(null);
    setSelectedFiles([]);
    setState("idle");
    setMessage(`Add a file to ${tool.title.toLowerCase()}.`);
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    const nextFile = nextFiles[0] ?? null;
    setFile(nextFile);
    setSelectedFiles(nextFiles);
    setState(nextFile ? "selected" : "idle");
    setMessage(nextFile ? `${nextFile.name} is ready to check.` : "Choose a job above, then add a file to begin.");
  }

  async function runTool() {
    if (!file) return;
    setState("processing");
    setMessage(activeTool?.id === "validate" ? "Checking the file before processing..." : `Preparing your file with ${activeTool?.title.toLowerCase()}...`);

    if (!activeTool?.available) {
      setState("error");
      setMessage(`${activeTool?.title} is not connected to a processing service yet. The workflow panel is ready for implementation.`);
      return;
    }

    const body = new FormData();
    body.append("file", file);

    try {
      if (activeTool.id === "validate") {
        const response = await fetch(`${apiUrl}/api/v1/check/file`, { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "The file could not be checked.");
        setState("validated");
        setMessage(`${result.filename} is valid as ${result.media_type}. Temporary upload data is removed after the check.`);
        return;
      }

      let endpoint = "/api/v1/images/convert";
      if (activeTool.id === "image-compress") {
        endpoint = "/api/v1/images/compress";
        body.append("target_kb", String(targetKb));
      } else if (activeTool.id === "image-resize") {
        endpoint = "/api/v1/images/resize";
        body.append("width", String(width));
        body.append("height", String(height));
        body.append("crop", "true");
      } else if (activeTool.id === "pdf-compress") {
        endpoint = "/api/v1/pdfs/compress";
      } else if (activeTool.id === "pdf-organize") {
        endpoint = `/api/v1/pdfs/${pdfOperation === "delete" ? "pages/delete" : pdfOperation === "reorder" ? "pages/reorder" : pdfOperation}`;
        body.append("pages", pages);
        if (pdfOperation === "rotate") body.append("angle", "90");
      } else if (activeTool.id === "pdf-convert") {
        endpoint = "/api/v1/pdfs/to-images";
      } else if (activeTool.id === "image-to-pdf") {
        endpoint = "/api/v1/images/to-pdf";
        body.delete("file");
        for (const selectedFile of selectedFiles) body.append("files", selectedFile);
      } else {
        body.append("output_format", outputFormat);
        body.append("width", String(width));
        body.append("height", String(height));
      }
      const response = await fetch(`${apiUrl}${endpoint}`, { method: "POST", body });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.detail ?? "The image could not be converted.");
      }
      const downloadUrl = URL.createObjectURL(await response.blob());
      const download = document.createElement("a");
      download.href = downloadUrl;
      const extension = activeTool.id === "pdf-convert" ? "zip" : activeTool.id === "image-to-pdf" || activeTool.id.startsWith("pdf") ? "pdf" : outputFormat;
      download.download = `onefile-${file.name.split(".")[0]}.${extension}`;
      download.click();
      URL.revokeObjectURL(downloadUrl);
      setState("validated");
      setMessage("Your converted file is ready and the download has started.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The file could not be checked.");
    }
  }

  return (
    <main className="page-shell">
      <section className="intro-panel" aria-labelledby="page-title">
        <p className="kicker">ONEFILE / FILE PREPARATION</p>
        <h1 id="page-title">Make your files fit the requirements.</h1>
        <p className="lede">Choose the file job you need, set a measurable requirement, and leave with something a portal will accept.</p>
        <div className="trust-line"><span className="status-dot" /> Temporary processing · no account required</div>
      </section>

      <section className="tool-directory" aria-labelledby="tool-directory-title">
        <div className="directory-heading"><div><span className="eyebrow">CHOOSE A JOB</span><h2 id="tool-directory-title">What do you need to do?</h2></div><span className="directory-count">{tools.flatMap((group) => group.items).length} tools</span></div>
        {tools.map((group) => (
          <div className="tool-group" key={group.label}>
            <div className="group-heading"><strong>{group.label}</strong><span>{group.note}</span></div>
            <div className="tool-grid">
              {group.items.map((tool) => (
                <button className={`tool-card tool-${tool.accent} ${selectedTool === tool.id ? "tool-active" : ""}`} key={tool.id} type="button" onClick={() => chooseTool(tool)}>
                  <span className="tool-topline"><span className="tool-mark" aria-hidden="true">{tool.id === "validate" ? "✓" : tool.id.includes("pdf") ? "▤" : "◈"}</span><span className={tool.available ? "tool-status ready" : "tool-status"}>{tool.available ? "Ready" : "Coming next"}</span></span>
                  <strong>{tool.title}</strong><span className="tool-description">{tool.description}</span><span className="tool-format">{tool.formats}</span><span className="tool-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {activeTool && (
      <section className="workspace" aria-label="File preparation workspace">
        <div className="workspace-header">
          <div><span className="eyebrow">{activeTool.title.toUpperCase()}</span><h2>Configure your file</h2></div>
          <span className={`state-pill state-${state}`}>{state}</span>
        </div>
        <label className="drop-zone" htmlFor="file-input">
          <span className="drop-icon" aria-hidden="true">↑</span>
          <span className="drop-title">Drop a file here or browse</span>
          <span className="drop-detail">{acceptsForTool(activeTool)} · up to 10 MB</span>
          <input id="file-input" type="file" accept={acceptsForTool(activeTool)} multiple={activeTool.id === "image-to-pdf"} onChange={selectFile} />
        </label>
        {(activeTool.id === "image-convert" || activeTool.id === "image-resize") && <div className="config-row"><label>{activeTool.id === "image-convert" ? "Output format" : "Mode"}<select value={activeTool.id === "image-convert" ? outputFormat : "crop"} onChange={(event) => activeTool.id === "image-convert" && setOutputFormat(event.target.value)}>{activeTool.id === "image-convert" ? <><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></> : <option value="crop">Resize and crop</option>}</select></label><label>Width<input type="number" min="1" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Height<input type="number" min="1" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label></div>}
        {activeTool.id === "image-compress" && <div className="config-row"><label>Maximum size (KB)<input type="number" min="1" value={targetKb} onChange={(event) => setTargetKb(Number(event.target.value))} /></label></div>}
        {activeTool.id === "pdf-organize" && <div className="config-row"><label>Page operation<select value={pdfOperation} onChange={(event) => setPdfOperation(event.target.value)}><option value="rotate">Rotate</option><option value="delete">Delete pages</option><option value="reorder">Reorder pages</option><option value="split">Extract pages</option></select></label><label>Pages, zero-based<input value={pages} onChange={(event) => setPages(event.target.value)} /></label></div>}
        {!activeTool.available && <div className="planned-note"><span>IN BUILD</span><strong>{activeTool.title} processing is the next backend slice.</strong><p>Your file and requirements will appear here when this operation is connected.</p></div>}
        <div className="workflow-row">
          <div className="file-summary" aria-live="polite">
            <span className="summary-label">CURRENT FILE</span>
            <strong>{file ? `${file.name}${selectedFiles.length > 1 ? ` + ${selectedFiles.length - 1} more` : ""}` : "No file selected"}</strong>
            <span>{file ? `${Math.ceil(file.size / 1024)} KB · ${file.type || "unknown type"}` : "Your file stays local until you choose to check it."}</span>
          </div>
          <button className="primary-action" type="button" disabled={!file || state === "processing"} onClick={runTool}>{state === "processing" ? "Working..." : activeTool.available ? "Run this job" : "Preview workflow"}<span aria-hidden="true">→</span></button>
        </div>
        <div className={`message message-${state}`} role="status">{message}</div>
      </section>
      )}

      {!selectedTool && <div className="empty-hint">Start with the job that matches your portal requirement. You can change tools at any time.</div>}
      {selectedTool && !activeTool?.available && <div className="empty-hint">{message} Select <strong>Check requirements</strong> to try the working flow today.</div>}

      <footer><span>OneFile is built around measurable requirements.</span><span>Private by default · no account required</span></footer>
    </main>
  );
}
