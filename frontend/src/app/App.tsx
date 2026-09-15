import { ChangeEvent, useState } from "react";

type WorkflowState = "idle" | "selected" | "processing" | "validated" | "error";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<WorkflowState>("idle");
  const [message, setMessage] = useState("Choose an image or PDF to inspect its upload requirements.");

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setState(nextFile ? "selected" : "idle");
    setMessage(nextFile ? `${nextFile.name} is ready to check.` : "Choose an image or PDF to inspect its upload requirements.");
  }

  async function checkFile() {
    if (!file) return;
    setState("processing");
    setMessage("Checking the file before processing...");

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`${apiUrl}/api/v1/check/file`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "The file could not be checked.");
      setState("validated");
      setMessage(`${result.filename} is valid as ${result.media_type}. Temporary upload data is removed after the check.`);
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
        <p className="lede">A clear, privacy-conscious workspace for compressing, resizing, converting, and validating the files that portals actually accept.</p>
        <div className="trust-line"><span className="status-dot" /> Temporary processing · no account required</div>
      </section>

      <section className="workspace" aria-label="File preparation workspace">
        <div className="workspace-header">
          <div><span className="eyebrow">START HERE</span><h2>Check a file</h2></div>
          <span className={`state-pill state-${state}`}>{state}</span>
        </div>
        <label className="drop-zone" htmlFor="file-input">
          <span className="drop-icon" aria-hidden="true">↑</span>
          <span className="drop-title">Drop a file here or browse</span>
          <span className="drop-detail">JPG, PNG, WebP, or PDF · up to 10 MB</span>
          <input id="file-input" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={selectFile} />
        </label>
        <div className="workflow-row">
          <div className="file-summary" aria-live="polite">
            <span className="summary-label">CURRENT FILE</span>
            <strong>{file?.name ?? "No file selected"}</strong>
            <span>{file ? `${Math.ceil(file.size / 1024)} KB · ${file.type || "unknown type"}` : "Your file stays local until you choose to check it."}</span>
          </div>
          <button className="primary-action" type="button" disabled={!file || state === "processing"} onClick={checkFile}>{state === "processing" ? "Checking..." : "Check file"}<span aria-hidden="true">→</span></button>
        </div>
        <div className={`message message-${state}`} role="status">{message}</div>
      </section>

      <footer><span>OneFile is built around measurable requirements.</span><span>Next: compress · resize · convert</span></footer>
    </main>
  );
}
