from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import projects, workers, materials, ledger, dashboard, timesheets, sub_projects
import os

load_dotenv()

app = FastAPI(
    title="RanahMerenah API",
    description="Aplikasi manajemen proyek arsitektur",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(workers.router)
app.include_router(materials.router)
app.include_router(ledger.router)
app.include_router(dashboard.router)
app.include_router(timesheets.router)
app.include_router(sub_projects.router)
@app.get("/")
def root():
    return {"app": os.getenv("APP_NAME"), "status": "running", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}