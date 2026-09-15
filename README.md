# OneFile

OneFile helps people prepare images and PDFs for real-world upload requirements.

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
