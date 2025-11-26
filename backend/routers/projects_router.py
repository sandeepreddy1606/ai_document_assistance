from fastapi import APIRouter, HTTPException, Depends, status
from firebase_admin import firestore
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from .auth_router import verify_token

router = APIRouter()

def get_db():
    """Return a Firestore client. This is obtained lazily so Firebase Admin can be initialized first."""
    return firestore.client()

class ProjectCreate(BaseModel):
    name: str
    document_type: str  # "docx" or "pptx"
    topic: str
    outline: Optional[List[Dict[str, Any]]] = None  # For docx: [{"title": "Section 1", "order": 0}]
    slides: Optional[List[Dict[str, Any]]] = None  # For pptx: [{"title": "Slide 1", "order": 0}]

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    topic: Optional[str] = None
    outline: Optional[List[Dict[str, Any]]] = None
    slides: Optional[List[Dict[str, Any]]] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    document_type: str
    topic: str
    outline: Optional[List[Dict[str, Any]]] = None
    slides: Optional[List[Dict[str, Any]]] = None
    created_at: str
    updated_at: str
    user_id: str

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    decoded_token: dict = Depends(verify_token)
):
    """Create a new project"""
    user_id = decoded_token["uid"]
    
    project_data = {
        "name": project.name,
        "document_type": project.document_type,
        "topic": project.topic,
        "outline": project.outline or [],
        "slides": project.slides or [],
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "content": {},
        "refinement_history": []
    }
    
    doc_ref = get_db().collection("projects").add(project_data)
    project_id = doc_ref[1].id
    
    return {"id": project_id, **project_data}

@router.get("/", response_model=List[ProjectResponse])
async def get_projects(decoded_token: dict = Depends(verify_token)):
    """Get all projects for the current user"""
    user_id = decoded_token["uid"]
    
    projects_ref = get_db().collection("projects").where("user_id", "==", user_id)
    docs = projects_ref.stream()
    
    projects = []
    for doc in docs:
        project_data = doc.to_dict()
        projects.append({
            "id": doc.id,
            **project_data
        })
    
    return sorted(projects, key=lambda x: x["updated_at"], reverse=True)

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    decoded_token: dict = Depends(verify_token)
):
    """Get a specific project"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {"id": doc.id, **project_data}

@router.put("/{project_id}")
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    decoded_token: dict = Depends(verify_token)
):
    """Update a project"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if project_update.name is not None:
        update_data["name"] = project_update.name
    if project_update.topic is not None:
        update_data["topic"] = project_update.topic
    if project_update.outline is not None:
        update_data["outline"] = project_update.outline
    if project_update.slides is not None:
        update_data["slides"] = project_update.slides
    
    doc_ref.update(update_data)
    
    updated_doc = doc_ref.get()
    return {"id": doc.id, **updated_doc.to_dict()}

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    decoded_token: dict = Depends(verify_token)
):
    """Delete a project"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    doc_ref.delete()
    
    return {"message": "Project deleted successfully"}

