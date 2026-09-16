import { ChangeEvent, DragEvent, useEffect, useState } from "react";

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
      { id: "document-convert", title: "Convert a document", description: "Prepare common document formats for the destination portal.", formats: "DOCX · PDF", accent: "green", available: true },
      { id: "image-to-pdf", title: "Images to PDF", description: "Combine one or more images into a single upload-ready PDF.", formats: "JPG · PNG · WebP", accent: "yellow", available: true },
      { id: "validate", title: "Check requirements", description: "Confirm format, size, dimensions, and page count before upload.", formats: "All supported files", accent: "orange", available: true },
    ],
  },
];

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

function acceptsForTool(tool: Tool | undefined, pdfConvertMode: string): string {
  if (!tool) return ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx";
  if (tool.id.startsWith("image-")) return ".jpg,.jpeg,.png,.webp";
  if (tool.id.startsWith("pdf-") && tool.id !== "pdf-convert") return ".pdf";
  if (tool.id === "pdf-convert") return pdfConvertMode === "images-to-pdf" ? ".jpg,.jpeg,.png,.webp" : ".pdf";
  if (tool.id === "image-to-pdf") return ".jpg,.jpeg,.png,.webp";
  if (tool.id === "document-convert") return ".docx,.pdf";
  return ".jpg,.jpeg,.png,.webp,.pdf";
}

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [state, setState] = useState<WorkflowState>("idle");
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [view, setView] = useState<"directory" | "tool">("directory");
  const [message, setMessage] = useState("Choose a job above, then add a file to begin.");
  const [outputFormat, setOutputFormat] = useState("png");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [targetKb, setTargetKb] = useState(100);
  const [resizeMode, setResizeMode] = useState("crop");
  const [pdfOperation, setPdfOperation] = useState("rotate");
  const [pdfConvertMode, setPdfConvertMode] = useState("pdf-to-images");
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

  const activeTool = tools.flatMap((group) => group.items).find((tool) => tool.id === selectedTool);

  function chooseTool(tool: Tool) {
    setSelectedTool(tool.id);
    setView("tool");
    setFile(null);
    setSelectedFiles([]);
    setState("idle");
    setBatchMode(false);
    if (tool.id === "document-convert") setOutputFormat("pdf");
    if (tool.id === "image-convert") setOutputFormat("png");
    if (tool.id === "image-resize") setResizeMode("crop");
    if (tool.id === "pdf-organize") setPdfOperation("merge");
    if (tool.id === "pdf-convert") setPdfConvertMode("pdf-to-images");
    setMessage(`Add a file to ${tool.title.toLowerCase()}.`);
  }

  function goBackToTools() {
    setView("directory");
    setSelectedTool(null);
    setFile(null);
    setSelectedFiles([]);
    setState("idle");
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
    setMessage(nextFile ? `${nextFiles.length} file${nextFiles.length === 1 ? "" : "s"} ready to process.` : "Choose a job above, then add a file to begin.");
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
        if (maxSizeKb) body.append("max_size_kb", maxSizeKb);
        if (requiredFormat) body.append("required_format", requiredFormat);
        if (requiredWidth) body.append("width", requiredWidth);
        if (requiredHeight) body.append("height", requiredHeight);
        if (requiredResolution) body.append("resolution", requiredResolution);
        if (requiredPageCount) body.append("page_count", requiredPageCount);
        const response = await fetch(`${apiUrl}/api/v1/check/file`, { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "The file could not be checked.");
        setState("validated");
        setMessage(`${result.filename} is valid as ${result.media_type}. Temporary upload data is removed after the check.`);
        return;
      }

      let endpoint = "/api/v1/images/convert";
      if (batchMode && ["image-compress", "image-resize", "image-convert"].includes(activeTool.id)) {
        endpoint = "/api/v1/images/batch";
        body.delete("file");
        for (const selectedFile of selectedFiles) body.append("files", selectedFile);
        body.append("operation", activeTool.id.replace("image-", ""));
        if (activeTool.id === "image-compress") body.append("target_kb", String(targetKb));
        if (activeTool.id === "image-resize") {
          body.append("width", String(width));
          body.append("height", String(height));
        }
        if (activeTool.id === "image-convert") body.append("output_format", outputFormat);
      } else if (activeTool.id === "image-compress") {
        endpoint = "/api/v1/images/compress";
        body.append("target_kb", String(targetKb));
      } else if (activeTool.id === "image-resize") {
        endpoint = "/api/v1/images/resize";
        body.append("width", String(width));
        body.append("height", String(height));
        body.append("crop", String(resizeMode === "crop"));
      } else if (activeTool.id === "pdf-compress") {
        endpoint = "/api/v1/pdfs/compress";
      } else if (activeTool.id === "pdf-organize") {
        endpoint = `/api/v1/pdfs/${pdfOperation === "delete" ? "pages/delete" : pdfOperation === "reorder" ? "pages/reorder" : pdfOperation}`;
        if (pdfOperation === "merge") {
          body.delete("file");
          for (const selectedFile of selectedFiles) body.append("files", selectedFile);
        } else {
          body.append("pages", pages);
          if (pdfOperation === "rotate") body.append("angle", "90");
        }
      } else if (activeTool.id === "pdf-convert") {
        if (pdfConvertMode === "images-to-pdf") {
          endpoint = "/api/v1/images/to-pdf";
          body.delete("file");
          for (const selectedFile of selectedFiles) body.append("files", selectedFile);
        } else {
          endpoint = "/api/v1/pdfs/to-images";
        }
      } else if (activeTool.id === "image-to-pdf") {
        endpoint = "/api/v1/images/to-pdf";
        body.delete("file");
        for (const selectedFile of selectedFiles) body.append("files", selectedFile);
      } else if (activeTool.id === "document-convert") {
        endpoint = "/api/v1/documents/convert";
        body.append("output_format", outputFormat);
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
      const extension = batchMode || activeTool.id === "pdf-convert" && pdfConvertMode === "pdf-to-images" ? "zip" : activeTool.id === "image-to-pdf" || activeTool.id.startsWith("pdf") || activeTool.id === "pdf-convert" ? "pdf" : outputFormat;
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

  async function runAutoFix() {
    if (!file || !file.type.startsWith("image/")) return;
    setState("processing");
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
      setMessage("Requirement satisfied. The ready file has been downloaded.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The requirements could not be satisfied.");
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

      {view === "directory" ? (
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
      ) : activeTool ? (
        <section className="workspace" aria-label="File preparation workspace">
          <div className="workspace-header">
            <div>
              <button className="back-link" type="button" onClick={goBackToTools}>← Back to tools</button>
              <span className="eyebrow">{activeTool.title.toUpperCase()}</span>
              <h2>Configure your file</h2>
            </div>
            <span className={`state-pill state-${state}`}>{state}</span>
          </div>
          <div className="upload-section-label">Upload document or image</div>
          <label className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`} htmlFor="file-input" onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
            <span className="drop-icon" aria-hidden="true">↑</span>
            <span className="drop-title">Drop a file here or browse</span>
            <span className="drop-detail">{acceptsForTool(activeTool, pdfConvertMode)} · up to 10 MB</span>
            <input id="file-input" type="file" accept={acceptsForTool(activeTool, pdfConvertMode)} multiple={activeTool.id === "image-to-pdf" || (activeTool.id === "pdf-organize" && pdfOperation === "merge") || (activeTool.id === "pdf-convert" && pdfConvertMode === "images-to-pdf")} onChange={selectFile} />
          </label>
          {activeTool.id === "image-convert" && <div className="config-row"><label>Convert image to<select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label></div>}
          {activeTool.id === "image-resize" && <div className="config-row"><label>Resize mode<select value={resizeMode} onChange={(event) => setResizeMode(event.target.value)}><option value="crop">Crop to exact size</option><option value="fit">Fit inside dimensions</option></select></label><label>Width<input type="number" min="1" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Height<input type="number" min="1" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label></div>}
          {activeTool.id === "document-convert" && <div className="config-row"><label>Output format<select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}><option value="pdf">PDF</option><option value="docx">DOCX</option></select></label></div>}
          {activeTool.id === "image-compress" && <div className="config-row"><label>Target size (KB)<input type="number" min="1" max="10240" value={targetKb} onChange={(event) => setTargetKb(Math.max(1, Number(event.target.value) || 1))} /></label></div>}
          {activeTool.id.startsWith("image-") && activeTool.id !== "image-to-pdf" && <label className="batch-toggle"><input type="checkbox" checked={batchMode} onChange={(event) => setBatchMode(event.target.checked)} /> Process multiple files and download a ZIP</label>}
          {activeTool.id === "pdf-organize" && <div className="config-row"><label>Page operation<select value={pdfOperation} onChange={(event) => setPdfOperation(event.target.value)}><option value="merge">Merge PDFs</option><option value="rotate">Rotate</option><option value="delete">Delete pages</option><option value="reorder">Reorder pages</option><option value="split">Extract pages</option></select></label>{pdfOperation !== "merge" && <label>Pages, zero-based<input value={pages} onChange={(event) => setPages(event.target.value)} /></label>}</div>}
          {activeTool.id === "pdf-convert" && <div className="config-row"><label>Convert from<select value={pdfConvertMode} onChange={(event) => { setPdfConvertMode(event.target.value); setFile(null); setSelectedFiles([]); setState("idle"); }}><option value="pdf-to-images">PDF to images</option><option value="images-to-pdf">Images to PDF</option></select></label></div>}
          {activeTool.id === "validate" && <div className="config-row"><label>Required format<select value={requiredFormat} onChange={(event) => setRequiredFormat(event.target.value)}><option value="">Any supported format</option><option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="pdf">PDF</option></select></label><label>Maximum size (KB)<input type="number" min="1" value={maxSizeKb} onChange={(event) => setMaxSizeKb(event.target.value)} /></label><label>Required width<input type="number" min="1" value={requiredWidth} onChange={(event) => setRequiredWidth(event.target.value)} /></label><label>Required height<input type="number" min="1" value={requiredHeight} onChange={(event) => setRequiredHeight(event.target.value)} /></label><label>Minimum resolution<input type="number" min="1" value={requiredResolution} onChange={(event) => setRequiredResolution(event.target.value)} /></label><label>Required PDF pages<input type="number" min="1" value={requiredPageCount} onChange={(event) => setRequiredPageCount(event.target.value)} /></label></div>}
          {!activeTool.available && <div className="planned-note"><span>IN BUILD</span><strong>{activeTool.title} processing is the next backend slice.</strong><p>Your file and requirements will appear here when this operation is connected.</p></div>}
          <div className="workflow-row">
            <div className="file-summary" aria-live="polite">
              <span className="summary-label">CURRENT FILE</span>
              <strong>{file ? `${file.name}${selectedFiles.length > 1 ? ` + ${selectedFiles.length - 1} more` : ""}` : "No file selected"}</strong>
              <span>{file ? `${Math.ceil(file.size / 1024)} KB · ${file.type || "unknown type"}` : "Your file stays local until you choose to check it."}</span>
            </div>
            <button className="primary-action" type="button" disabled={!file || state === "processing"} onClick={runTool}>{state === "processing" ? "Working..." : activeTool.available ? "Run this job" : "Preview workflow"}<span aria-hidden="true">→</span></button>
          </div>
          {selectedFiles.length > 0 && <div className="file-list" aria-label="Selected files">{selectedFiles.map((selectedFile, index) => <div className="file-row" key={`${selectedFile.name}-${selectedFile.lastModified}`}><span>{index + 1}. {selectedFile.name}</span><span className="file-row-actions"><button type="button" onClick={() => moveFile(index, -1)} disabled={index === 0} aria-label={`Move ${selectedFile.name} up`}>↑</button><button type="button" onClick={() => moveFile(index, 1)} disabled={index === selectedFiles.length - 1} aria-label={`Move ${selectedFile.name} down`}>↓</button><button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${selectedFile.name}`}>×</button></span></div>)}</div>}
          {previewUrl && <div className="preview-panel"><span className="summary-label">BEFORE</span><img src={previewUrl} alt="Selected image preview" /></div>}
          {activeTool.id === "validate" && file?.type.startsWith("image/") && <button className="secondary-action" type="button" disabled={state === "processing"} onClick={runAutoFix}>Auto-fix and validate <span aria-hidden="true">→</span></button>}
          <div className={`message message-${state}`} role="status">{message}</div>
        </section>
      ) : null}

      {view === "directory" && !selectedTool && <div className="empty-hint">Start with the job that matches your portal requirement. You can change tools at any time.</div>}
      {view === "tool" && selectedTool && !activeTool?.available && <div className="empty-hint">{message} Select <strong>Check requirements</strong> to try the working flow today.</div>}

      <footer><span>OneFile is built around measurable requirements.</span><span>Private by default · no account required</span></footer>
    </main>
  );
}
