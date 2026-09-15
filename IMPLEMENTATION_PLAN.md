# OneFile Implementation Plan

## 1. Source of Truth

This plan reconciles:

- `OneFile_PRD.docx`: product behavior, priorities, acceptance criteria, privacy promises, and release boundaries.
- `OneFile_Technical_Stack_Document.docx`: implementation stack, architecture, deployment, and engineering constraints.

There is currently no application implementation in the repository. The first implementation should therefore establish the repository structure and the smallest end-to-end workflow before adding more tools.

## 2. Product Outcome

OneFile should help a user turn an existing image or PDF into a file that satisfies explicit requirements:

`upload -> configure requirement -> process -> validate -> download -> cleanup`

The requirement is the primary input. Compression, resizing, conversion, and page operations are means to satisfy it.

## 3. MVP Boundary

### P0: release-critical

- Image compression for JPG, PNG, and WebP.
- Target maximum image size in KB.
- Image resize and crop, including exact dimensions.
- Image format conversion.
- PDF compression with representative fixture coverage.
- PDF merge, split, rotate, delete-page, and reorder-page operations.
- Image to PDF and PDF to image conversion.
- Validation of file signature/type, output size, image dimensions, and PDF page count.
- Result status that clearly reports satisfied and unsatisfied constraints.
- Secure temporary-file lifecycle with cleanup on success, failure, expiry, and cancellation where applicable.
- Responsive, keyboard-usable UI for the core flows.

### P1: late MVP, only after the core loop is reliable

- Custom requirement form combining format, maximum size, dimensions, and page count.
- Data-driven presets with source, verification date, and editable values.
- Privacy copy that matches the actual temporary-storage behavior.

### Post-MVP

- Batch processing and ZIP output.
- DOCX to PDF and PDF to DOCX.
- OCR.
- Saved presets, accounts, processing history, and persistent job records.
- Object storage and asynchronous workers.
- Public API and usage plans.

Do not add microservices, Kubernetes, Kafka, a database, permanent file storage, or authentication before a concrete product need exists.

## 4. Architecture

Use a modular monolith:

`React browser -> FastAPI API -> input validation -> capability service -> output validation -> download -> cleanup`

The API should orchestrate work, while processing logic remains isolated by capability. Each operation should accept an input file plus typed parameters and return a common processing result containing the output artifact and validation report.

### Proposed repository structure

```text
frontend/
  src/
    app/
    components/
    features/
      image/
      pdf/
      validation/
    lib/
    types/
  public/
  package.json
  vite.config.ts
backend/
  app/
    main.py
    config.py
    routes/
      images.py
      pdfs.py
      validation.py
      presets.py
    schemas/
      common.py
      images.py
      pdfs.py
      validation.py
    services/
      image_service.py
      pdf_service.py
      validation_service.py
      preset_service.py
      processing_service.py
    core/
      errors.py
      security.py
      limits.py
      logging.py
    utils/
      temp_files.py
      file_signatures.py
      filenames.py
  tests/
    unit/
    api/
    fixtures/
  requirements.txt
  pyproject.toml
docs/
  PRD.md
  TECH_STACK.md
.github/
  workflows/
.gitignore
README.md
```

Keep route handlers thin. Do not create a generic converter abstraction until at least two operations have a genuinely shared contract.

## 5. Implementation Sequence

### Phase 0: foundation and secure file lifecycle

1. Initialize frontend and backend projects with pinned runtime versions.
2. Add environment-based configuration for allowed origins, upload limits, temp directory, and processing timeouts.
3. Add FastAPI health route and OpenAPI metadata.
4. Implement multipart upload validation:
   - extension allowlist;
   - declared MIME check;
   - file-signature check;
   - per-file and request-size limits;
   - randomized server-side names;
   - isolated per-request temporary directory.
5. Add cleanup utilities that run on normal completion and exceptions.
6. Add structured logs containing operation, status, duration, and coarse size category only.
7. Add frontend shell with tool navigation, upload state, configuration state, processing state, result state, and error state.

Exit criteria: a valid sample upload is accepted, an invalid or oversized file is rejected before parsing, temporary files are removed on both success and failure, and the UI can display the operation lifecycle.

### Phase 1: image workflow

1. Implement Pillow-based image inspection.
2. Implement resize, crop, and format conversion.
3. Implement adaptive target-size compression:
   - begin with a safe quality and resolution configuration;
   - encode and measure actual output bytes;
   - search quality and, only when configured, dimensions within bounded limits;
   - stop when the target is met;
   - return an explicit quality-floor failure when it cannot be met acceptably.
4. Validate every output against requested format, dimensions, and maximum size.
5. Return a downloadable output plus a machine-readable validation report.
6. Build one focused image tool experience that supports presets and custom requirements without hiding advanced controls.

Exit criteria: representative JPG, PNG, and WebP inputs complete the full upload-to-download flow; boundary and impossible targets produce understandable outcomes; output validation is visible before download.

### Phase 2: PDF workflow

1. Implement PDF inspection with PyMuPDF and pypdf.
2. Implement merge, split, rotate, page delete, and page reorder.
3. Implement image-to-PDF and PDF-to-image conversion.
4. Implement PDF compression as a bounded pipeline and document its quality limitations.
5. Validate output page count, file type/signature, and maximum size where requested.
6. Add representative PDFs with text, raster images, multiple pages, rotated pages, malformed input, and encrypted/unsupported cases.

Exit criteria: core PDF operations are stable against fixtures and the result screen describes page-level changes and validation status.

### Phase 3: trust, requirement engine, and production readiness

1. Add a shared custom requirement schema for format, size, dimensions, page count, and operation-specific constraints.
2. Add data-driven presets. Each preset must include a name, editable constraints, source, verification date, and an explicit verified/unverified status.
3. Never label a preset as official without a verified source.
4. Add privacy and cleanup copy that matches the deployment behavior.
5. Add rate limiting for expensive operations and configure CORS to the deployed frontend origin.
6. Add accessibility review for keyboard navigation, labels, focus order, status announcements, and error recovery.
7. Add coarse, optional analytics for processing outcome, duration, and size category. Never collect file contents or extracted text.
8. Add deployment smoke tests and configuration checks.

Exit criteria: all release gates in Section 10 pass and the core workflow is usable on desktop and mobile widths.

### Phase 4: expansion

Add DOCX conversion, OCR, batch processing, accounts, saved presets, object storage, and workers one capability at a time. Each addition requires new performance, security, privacy, and fixture gates.

## 6. API Contract

Use versioned REST routes and multipart form data for file operations.

### Core routes

```text
POST /api/v1/images/compress
POST /api/v1/images/resize
POST /api/v1/images/crop
POST /api/v1/images/convert
POST /api/v1/images/to-pdf

POST /api/v1/pdfs/compress
POST /api/v1/pdfs/merge
POST /api/v1/pdfs/split
POST /api/v1/pdfs/rotate
POST /api/v1/pdfs/pages/delete
POST /api/v1/pdfs/pages/reorder
POST /api/v1/pdfs/to-images

POST /api/v1/check/file
POST /api/v1/check/image
POST /api/v1/check/pdf
GET  /api/v1/presets
```

Each processing response should expose:

- operation identifier;
- output filename and media type;
- output size in bytes;
- validation checks with `passed`, `actual`, `expected`, and a user-facing message;
- warnings, such as quality reduction or best-effort PDF compression;
- download URL or a streaming download response;
- cleanup/expiry behavior without exposing filesystem paths.

Use consistent error codes for unsupported type, invalid input, limit exceeded, processing failure, target impossible, and temporary service failure. Do not return stack traces or parser details to clients.

## 7. Processing and Validation Rules

- Validate before parsing with a library.
- Treat the filename as display metadata only; never use it to construct a filesystem path.
- Keep input and output inside a randomized isolated temporary directory.
- Enforce configurable file count, file size, pixel count, page count, and processing-time limits.
- Never execute uploaded files.
- Validate the output independently of the operation that produced it.
- Do not claim success when a requested constraint is not satisfied.
- Keep quality floors and bounded iteration explicit for target-size compression.
- Reject or clearly report encrypted, malformed, unsupported, and resource-intensive files.
- Delete temporary artifacts in `finally` paths and through an expiry cleanup mechanism.

## 8. Frontend Workflow

The first UI should be a usable tool surface, not a marketing page.

1. Select or drop a file.
2. Show safe client-side preview only where supported.
3. Choose an operation.
4. Enter a custom requirement or select an editable preset.
5. Show processing progress and a cancel/error state where the backend supports it.
6. Present output facts and validation checks before download.
7. Provide a clear retry or start-another-file action.

Use typed API clients generated or derived from the FastAPI OpenAPI contract where practical. Keep server validation authoritative; client validation is only for immediate feedback.

## 9. Testing Strategy

### Backend unit tests

- File signature and MIME validation.
- Filename/path safety.
- Temporary-directory cleanup on success and exceptions.
- Image dimension, format, and target-size algorithms.
- Quality-floor and impossible-target behavior.
- PDF page operations and output validation.
- Preset schema and verified-source rules.

### API tests with HTTPX/FastAPI test client

- Successful multipart operations.
- Missing fields, invalid values, unsupported types, oversized files, too many files, and malformed content.
- Validation report shape and error-code consistency.
- Download behavior and cleanup.
- CORS and rate-limit behavior where configured.

### Frontend end-to-end tests with Playwright

- Image upload, configure, process, validate, and download.
- PDF merge/split/page operation flow.
- Failed processing and retry.
- Requirement-not-met result state.
- Keyboard navigation and mobile viewport smoke coverage.

### Fixtures and regression

Maintain curated valid, invalid, boundary, large-dimension, multi-page, rotated, encrypted, and malformed fixtures. Tests must assert both the result and the absence of retained temporary files.

## 10. Release Gates

Before the first production-oriented MVP:

- No known critical or high-severity issue in the supported upload path.
- Core processing tests pass for valid, invalid, and boundary fixtures.
- Cleanup is proven for success and failure paths.
- Every core output has a visible validation result.
- UI works at desktop and mobile widths and is keyboard usable.
- Upload, processing, and download limits are configured and tested.
- CORS, HTTPS, secrets, and environment configuration are correct in deployment.
- Logs do not contain file contents, extracted text, or unnecessary personal data.
- Documentation explains supported formats, limits, privacy behavior, and known conversion limitations.

## 11. Deployment and Operations

- Frontend: Vercel.
- Backend: Render initially, with a compute tier appropriate for image/PDF processing.
- Source control and CI: GitHub and GitHub Actions.
- Runtime configuration: environment variables for allowed origins, limits, temp path, and operational settings.
- Monitoring: structured logs and basic latency, volume, failure, and cleanup metrics.
- Database: defer PostgreSQL until accounts, saved presets, job records, or usage controls are actually required.
- Workers/object storage: introduce only after measured processing duration, concurrency, or instance-storage limits justify them.

## 12. Decisions to Make Before Public Launch

1. Exact maximum upload size and per-operation limits.
2. Maximum pixel count, page count, request file count, and processing timeout.
3. Whether anonymous users can use all operations or whether expensive operations are restricted.
4. Download URL/stream behavior and exact temporary-file expiry window.
5. Whether initial presets use verified external sources or begin as custom-only requirements.
6. Whether the deployment environment's local temporary storage is reliable enough for the selected backend tier.
7. Which PDF compression quality trade-offs are acceptable and how they are communicated.
8. Whether browser-side image processing is appropriate for selected operations to reduce server exposure.

## 13. Immediate Next Actions

1. Create the frontend/backend repository skeleton and CI checks.
2. Decide and document initial limits and supported MIME/signature matrix.
3. Implement the temporary-file and upload-validation foundation first.
4. Add one vertical image flow through API, processing, validation, download, and cleanup.
5. Run focused tests and add regression fixtures before implementing additional tools.
6. Reconcile the PRD and technical-stack documents into `docs/PRD.md` and `docs/TECH_STACK.md` once implementation starts.

The success criterion for the first milestone is not the number of converters. It is a trustworthy, measurable, and well-tested requirement-satisfaction loop for one image workflow.
