# OneFile

OneFile is a browser-based file preparation workspace for people who need an image or PDF to meet a real-world upload requirement. It is designed for situations such as application portals, forms, and document submissions that reject files because of their type, size, dimensions, or page rules.

## What the website does

OneFile guides a user through preparing a file for submission:

1. Select an image or PDF from the browser.
2. Check that the file is supported, within the configured size limits, and consistent with its actual file signature.
3. Review a clear success or error message before continuing.
4. Use the planned compression, resizing, conversion, and PDF tools to meet specific requirements.

The current MVP supports secure processing for JPG, PNG, WebP, PDF, and DOCX uploads. Processing tools return a downloadable result and remove temporary files after the response is complete.

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

The API checks supported uploads through `POST /api/v1/check/file`. Processing limits and allowed frontend origins are configured with the variables in `backend/.env.example`.

## MVP operations

The current MVP supports image conversion, image resizing/cropping, target-size image compression, PDF compression, PDF merge/split/rotation/deletion/reordering, PDF-to-images, images-to-PDF, DOCX-to-PDF, PDF-to-DOCX, and file requirement checks. PDF-to-DOCX preserves extracted text and does not promise exact original layout. OCR, accounts, batch ZIP workflows, and persistent storage remain post-MVP items from the implementation plan.

For a shared deployment:

1. Deploy `backend/` as the Render service described in `render.yaml`.
2. Set `ONEFILE_ALLOWED_ORIGINS` on Render to the exact deployed frontend origin, including `https://` and no trailing slash.
3. Deploy `frontend/` to Vercel or another static host.
4. Set `VITE_API_URL` on the frontend host to the Render API URL, for example `https://onefile-api.onrender.com`.
5. Trigger a frontend redeploy after setting `VITE_API_URL`, because Vite injects it at build time.

Before sharing the deployed URL, check the API health endpoint at `<API_URL>/health` and run one image and one PDF operation from the deployed frontend. The service is intentionally stateless; files are temporary and are not retained between requests.
