from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse, StreamingResponse
from firebase_admin import firestore
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import io
import google.generativeai as genai
import os
from dotenv import load_dotenv
from docx import Document
from pptx import Presentation
from pptx.util import Inches, Pt
from .auth_router import verify_token

load_dotenv()

router = APIRouter()

def get_db():
    return firestore.client()

# Initialize Gemini
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

class RefinementRequest(BaseModel):
    section_id: str
    prompt: str

class FeedbackRequest(BaseModel):
    section_id: str
    feedback_type: str
    comment: Optional[str] = None

class CommentRequest(BaseModel):
    section_id: str
    comment: str

def generate_content_with_gemini(topic: str, section_title: str, document_type: str, context: Optional[str] = None) -> str:
    if not gemini_api_key:
        return f"Placeholder content for '{section_title}'. (Gemini API Key missing)"
    
    # Priority list based on your available models
    models_to_try = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro']
    
    last_error = ""
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            if document_type == "docx":
                prompt = f"""You are a professional document writer. Generate detailed content for the section "{section_title}" for a document about "{topic}".
                Context: {context if context else "None"}
                Requirements: Professional tone, 300-500 words, use paragraphs. Do NOT include the section title."""
            else:
                prompt = f"""You are a professional presentation designer. Generate content for a slide titled "{section_title}" for a presentation about "{topic}".
                Context: {context if context else "None"}
                Requirements: Bullet points (3-5 key points), 50-100 words total. Do NOT include the slide title."""
            
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            last_error = str(e)
            print(f"Failed with {model_name}: {last_error}")
            continue
            
    return f"Error generating content. Last error: {last_error}"

def generate_template_with_gemini(topic: str, document_type: str) -> List[Dict[str, Any]]:
    if not gemini_api_key: return []
    models_to_try = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro']
    
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            prompt = f"Generate a {'5-8 section' if document_type == 'docx' else '8-10 slide'} outline for a {'document' if document_type == 'docx' else 'presentation'} about '{topic}'. Return ONLY the titles, one per line."
            response = model.generate_content(prompt)
            titles = [line.strip().replace('*', '').replace('-', '').strip() for line in response.text.split('\n') if line.strip()]
            return [{"title": t, "order": i} for i, t in enumerate(titles)]
        except Exception as e:
            continue
    return []

@router.post("/{project_id}/generate-template")
async def generate_template(project_id: str, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict()["user_id"] != user_id: raise HTTPException(status_code=404)
    return {"template": generate_template_with_gemini(doc.to_dict()["topic"], doc.to_dict()["document_type"])}

@router.post("/{project_id}/generate-content")
async def generate_content(project_id: str, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict()["user_id"] != user_id: raise HTTPException(status_code=404)
    
    project_data = doc.to_dict()
    document_type = project_data["document_type"]
    
    # Get the outline/slides
    items_key = "outline" if document_type == "docx" else "slides"
    items = project_data.get(items_key, [])
    
    # Get existing content
    content_map = project_data.get("content", {})
    context = ""
    updated_items = []
    has_structure_changes = False

    # Sort items to ensure logical context flow
    sorted_items = sorted(items, key=lambda x: x.get("order", 0))

    for item in sorted_items:
        # 1. ENSURE ID: If item has no ID, or has a temporary ID, create a stable one
        item_id = item.get("id")
        if not item_id or item_id.startswith("temp_"):
            item_id = f"item_{int(datetime.now().timestamp() * 1000)}_{item.get('order', 0)}"
            item["id"] = item_id
            has_structure_changes = True # Mark that we need to save the outline back to DB
        
        # 2. GENERATE: Only generate if content is missing or empty
        if item_id not in content_map or not content_map[item_id].get("content"):
            generated_text = generate_content_with_gemini(project_data["topic"], item.get("title", ""), document_type, context)
            content_map[item_id] = {
                "title": item.get("title"),
                "content": generated_text,
                "order": item.get("order", 0)
            }
        
        # Add to context for next section
        current_text = content_map[item_id].get("content", "")
        context += f"\n{item.get('title')}: {current_text[:200]}..."
        
        updated_items.append(item)

    # 3. SAVE: Update Content Map AND the Structure (if IDs changed)
    update_data = {
        "content": content_map,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if has_structure_changes:
        # This fixes the "Disconnect" issue by saving the new IDs back to the outline
        update_data[items_key] = updated_items

    doc_ref.update(update_data)
    
    return {"content": content_map, "message": "Content generated and linked successfully"}

@router.post("/{project_id}/refine")
async def refine_content(project_id: str, refinement: RefinementRequest, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict()["user_id"] != user_id: raise HTTPException(status_code=404)
    
    project_data = doc.to_dict()
    content = project_data.get("content", {})
    
    # Fallback lookup if ID is missing (try to find by order)
    target_id = refinement.section_id
    if target_id not in content:
        # Try to find a content item with matching ID from the outline, or just fail
        raise HTTPException(status_code=404, detail="Section content not found. Try regenerating first.")

    section = content[target_id]
    refined_text = section.get('content', '')
    
    models_to_try = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro']
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(f"Refine this: {section['content']}\nInstruction: {refinement.prompt}")
            refined_text = response.text
            break
        except: continue
        
    content[target_id]["content"] = refined_text
    
    doc_ref.update({
        "content": content,
        "refinement_history": firestore.ArrayUnion([{
            "section_id": target_id, "type": "refinement", "prompt": refinement.prompt, "timestamp": datetime.utcnow().isoformat()
        }])
    })
    return {"refined_content": refined_text}

@router.post("/{project_id}/feedback")
async def add_feedback(project_id: str, feedback: FeedbackRequest, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict()["user_id"] != user_id: raise HTTPException(status_code=404)
    doc_ref.update({"refinement_history": firestore.ArrayUnion([{
        "section_id": feedback.section_id, "type": "feedback", "value": feedback.feedback_type, "timestamp": datetime.utcnow().isoformat()
    }])})
    return {"message": "Recorded"}

@router.post("/{project_id}/comment")
async def add_comment(project_id: str, comment: CommentRequest, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict()["user_id"] != user_id: raise HTTPException(status_code=404)
    doc_ref.update({"refinement_history": firestore.ArrayUnion([{
        "section_id": comment.section_id, "type": "comment", "value": comment.comment, "timestamp": datetime.utcnow().isoformat()
    }])})
    return {"message": "Recorded"}

@router.get("/{project_id}/export")
async def export_document(project_id: str, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict()["user_id"] != user_id: raise HTTPException(status_code=404)
    
    project_data = doc.to_dict()
    content_map = project_data.get("content", {})
    items = project_data.get("outline", []) if project_data["document_type"] == "docx" else project_data.get("slides", [])
    sorted_items = sorted(items, key=lambda x: x.get("order", 0))
    
    file_stream = io.BytesIO()

    # Helper to safely get content
    def get_content_text(item):
        # 1. Try ID match
        if item.get("id") in content_map:
            return content_map[item["id"]].get("content", "")
        # 2. Try Order match (Fallback)
        for k, v in content_map.items():
            if v.get("order") == item.get("order"):
                return v.get("content", "")
        return ""

    if project_data["document_type"] == "docx":
        doc = Document()
        doc.add_heading(project_data.get("topic", "Document"), 0)
        for item in sorted_items:
            doc.add_heading(item.get("title", "Untitled"), level=1)
            text = get_content_text(item)
            if not text: text = "[Content not generated]"
            doc.add_paragraph(text)
        doc.save(file_stream)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"
    else:
        prs = Presentation()
        slide = prs.slides.add_slide(prs.slide_layouts[0])
        slide.shapes.title.text = project_data.get("name", "Presentation")
        slide.placeholders[1].text = project_data.get("topic", "")
        
        for item in sorted_items:
            slide = prs.slides.add_slide(prs.slide_layouts[1])
            slide.shapes.title.text = item.get("title", "Untitled")
            text = get_content_text(item)
            if not text: text = "[Content not generated]"
            slide.placeholders[1].text_frame.text = text
        prs.save(file_stream)
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ext = "pptx"

    file_stream.seek(0)
    return StreamingResponse(file_stream, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{project_data.get("name", "doc")}.{ext}"'})