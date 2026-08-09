# SYSTEM ARCHITECTURE: ICM & TEST SHARING PLATFORM

```
                        ┌────────────────────────────────────────┐
                        │      AI AGENT (Claude / Copilot /      │
                        │      AntiGravity / Cursor / AGY)       │
                        └───────────────────┬────────────────────┘
                                            │ Single-line reference
                                            ▼
                        ┌────────────────────────────────────────┐
                        │  LAYER 1: GLOBAL ROUTER                │
                        │  .icm/START_HERE.md & PROGRESS.md      │
                        └───────────────────┬────────────────────┘
                                            │ Route to Domain
                                            ▼
                        ┌────────────────────────────────────────┐
                        │  LAYER 2: WORKSPACE CONTEXTS           │
                        │  .icm/workspaces/{admin,student,core}  │
                        └───────────────────┬────────────────────┘
                                            │ Execute & Edit
                                            ▼
                        ┌────────────────────────────────────────┐
                        │  LAYER 3: WORKING APPLICATION CODE     │
                        │  src/core/storage.js                   │
                        │  src/admin/adminModule.js              │
                        │  src/student/studentModule.js          │
                        │  src/index.html & src/styles.css       │
                        └────────────────────────────────────────┘
```

## APPLICATION DATA FLOW
1. **Admin Workflow**:
   - Upload Study Material Doc → Parsed & Stored.
   - Add/Manage Questions → Linked to Doc/Topic in Question Bank.
   - Build Test Suite → Select Questions & set timer → Publish Test.

2. **Student Workflow**:
   - View Available Tests → Click Start → Enter Timed Test Mode.
   - Select Answers & Submit → Auto-evaluation engine calculates score.
   - View Detailed Scorecard → Results recorded in local submission history.
