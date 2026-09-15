# OneFile

OneFile is a browser-based file preparation workspace for people who need an image or PDF to meet a real-world upload requirement. It is designed for situations such as application portals, forms, and document submissions that reject files because of their type, size, dimensions, or page rules.

## What the website does

OneFile guides a user through preparing a file for submission:

1. Select an image or PDF from the browser.
2. Check that the file is supported, within the configured size limits, and consistent with its actual file signature.
3. Review a clear success or error message before continuing.
4. Use the planned compression, resizing, conversion, and PDF tools to meet specific requirements.

The current Phase 0 experience focuses on secure file checking for JPG, PNG, WebP, and PDF uploads. The broader product is being built around measurable requirements, so future processing tools will report whether the resulting file actually satisfies the requested format, size, dimensions, or page count.

## Privacy and safety

OneFile does not require an account for the current workflow. Uploaded files are handled in an isolated temporary workspace, validated before parsing, and removed after the check completes. Configurable upload and processing limits help prevent oversized or unsupported files from reaching the processing layer.

## Local development

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

The Phase 0 shell checks supported image and PDF uploads through `POST /api/v1/check/file`. Processing limits and allowed frontend origins are configured with the variables in `backend/.env.example`.

## MVP operations

The current MVP supports image conversion, image resizing/cropping, target-size image compression, PDF compression, PDF page rotation/deletion/reordering/extraction, PDF-to-images, images-to-PDF, and file requirement checks. DOCX conversion, OCR, accounts, batch ZIP workflows, and persistent storage remain post-MVP items from the implementation plan.

For a shared deployment, deploy `backend/` as the Render service described in `render.yaml`, set `ONEFILE_ALLOWED_ORIGINS` to the deployed Vercel URL, and set `VITE_API_URL` in the frontend environment to the Render API URL before building.
