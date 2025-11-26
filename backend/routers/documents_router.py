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
    """Return a Firestore client. This is obtained lazily so Firebase Admin can be initialized first."""
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
    feedback_type: str  # "like" or "dislike"
    comment: Optional[str] = None

class CommentRequest(BaseModel):
    section_id: str
    comment: str

def generate_content_with_gemini(topic: str, section_title: str, document_type: str, context: Optional[str] = None) -> str:
    """Generate content using Gemini API"""
    if not gemini_api_key:
        return f"This is placeholder content for {section_title}. Please configure GEMINI_API_KEY in your environment variables."
    
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        if document_type == "docx":
            prompt = f"""You are a professional document writer. Generate comprehensive content for a section titled "{section_title}" in a document about "{topic}".
            
            {f"Context from previous sections: {context}" if context else ""}
            
            Write detailed, well-structured content (approximately 300-500 words) that:
            - Is informative and professional
            - Flows naturally from the topic
            - Uses proper grammar and formatting
            - Includes relevant details and examples where appropriate
            
            Do not include the section title in your response, only the content."""
        else:  # pptx
            prompt = f"""You are a professional presentation writer. Generate concise content for a slide titled "{section_title}" in a presentation about "{topic}".
            
            {f"Context from previous slides: {context}" if context else ""}
            
            Write clear, concise content (approximately 100-200 words) suitable for a presentation slide that:
            - Is easy to read and understand
            - Uses bullet points or short paragraphs
            - Highlights key points
            - Is engaging and informative
            
            Format your response with clear structure, using bullet points where appropriate."""
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error generating content: {str(e)}. Please check your Gemini API configuration."

def generate_template_with_gemini(topic: str, document_type: str) -> List[Dict[str, Any]]:
    """Generate document template using Gemini API"""
    if not gemini_api_key:
        return []
    
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        if document_type == "docx":
            prompt = f"""Generate a comprehensive outline for a document about "{topic}". 
            Provide 5-8 section titles that would make a complete, well-structured document.
            Return only the section titles, one per line, without numbering or bullets."""
        else:  # pptx
            prompt = f"""Generate a presentation outline for a topic about "{topic}".
            Provide 8-12 slide titles that would make a complete, engaging presentation.
            Return only the slide titles, one per line, without numbering or bullets."""
        
        response = model.generate_content(prompt)
        titles = [line.strip() for line in response.text.split('\n') if line.strip()]
        
        result = []
        for i, title in enumerate(titles):
            if document_type == "docx":
                result.append({"title": title, "order": i})
            else:
                result.append({"title": title, "order": i})
        
        return result
    except Exception as e:
        return []

@router.post("/{project_id}/generate-template")
async def generate_template(
    project_id: str,
    decoded_token: dict = Depends(verify_token)
):
    """Generate AI template for a project"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    template = generate_template_with_gemini(project_data["topic"], project_data["document_type"])
    
    return {"template": template}

@router.post("/{project_id}/generate-content")
async def generate_content(
    project_id: str,
    decoded_token: dict = Depends(verify_token)
):
    """Generate content for all sections/slides in a project"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    document_type = project_data["document_type"]
    topic = project_data["topic"]
    content = {}
    context = ""
    
    if document_type == "docx":
        outline = project_data.get("outline", [])
        sorted_outline = sorted(outline, key=lambda x: x.get("order", 0))
        
        for section in sorted_outline:
            section_id = section.get("id", f"section_{section.get('order', 0)}")
            section_title = section.get("title", "Untitled Section")
            
            generated_text = generate_content_with_gemini(topic, section_title, document_type, context)
            content[section_id] = {
                "title": section_title,
                "content": generated_text,
                "order": section.get("order", 0)
            }
            context += f"\n{section_title}: {generated_text[:200]}..."
    else:  # pptx
        slides = project_data.get("slides", [])
        sorted_slides = sorted(slides, key=lambda x: x.get("order", 0))
        
        for slide in sorted_slides:
            slide_id = slide.get("id", f"slide_{slide.get('order', 0)}")
            slide_title = slide.get("title", "Untitled Slide")
            
            generated_text = generate_content_with_gemini(topic, slide_title, document_type, context)
            content[slide_id] = {
                "title": slide_title,
                "content": generated_text,
                "order": slide.get("order", 0)
            }
            context += f"\n{slide_title}: {generated_text[:200]}..."
    
    # Update project with generated content
    doc_ref.update({
        "content": content,
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return {"content": content, "message": "Content generated successfully"}

@router.post("/{project_id}/refine")
async def refine_content(
    project_id: str,
    refinement: RefinementRequest,
    decoded_token: dict = Depends(verify_token)
):
    """Refine a specific section/slide using AI"""
    user_id = decoded_token["uid"]
    
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    content = project_data.get("content", {})
    section_data = content.get(refinement.section_id)
    
    if not section_data:
        raise HTTPException(status_code=404, detail="Section not found")
    
    document_type = project_data["document_type"]
    topic = project_data["topic"]
    original_content = section_data.get("content", "")
    section_title = section_data.get("title", "")
    
    # Generate refined content
    if gemini_api_key:
        try:
            model = genai.GenerativeModel('gemini-pro')
            prompt = f"""Refine the following content based on this instruction: "{refinement.prompt}"
            
            Original content for section "{section_title}" in a document about "{topic}":
            {original_content}
            
            Please refine the content according to the instruction while maintaining its relevance to the topic."""
            
            response = model.generate_content(prompt)
            refined_content = response.text
        except Exception as e:
            refined_content = f"Error refining content: {str(e)}"
    else:
        refined_content = original_content + f"\n\n[Refined based on: {refinement.prompt}]"
    
    # Update content
    content[refinement.section_id]["content"] = refined_content
    
    # Add to refinement history
    refinement_history = project_data.get("refinement_history", [])
    refinement_history.append({
        "section_id": refinement.section_id,
        "prompt": refinement.prompt,
        "timestamp": datetime.utcnow().isoformat(),
        "type": "refinement"
    })
    
    doc_ref.update({
        "content": content,
        "refinement_history": refinement_history,
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return {
        "section_id": refinement.section_id,
        "refined_content": refined_content,
        "message": "Content refined successfully"
    }

@router.post("/{project_id}/feedback")
async def add_feedback(
    project_id: str,
    feedback: FeedbackRequest,
    decoded_token: dict = Depends(verify_token)
):
    """Add feedback (like/dislike) to a section"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    refinement_history = project_data.get("refinement_history", [])
    refinement_history.append({
        "section_id": feedback.section_id,
        "feedback_type": feedback.feedback_type,
        "comment": feedback.comment,
        "timestamp": datetime.utcnow().isoformat(),
        "type": "feedback"
    })
    
    doc_ref.update({
        "refinement_history": refinement_history,
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return {"message": "Feedback added successfully"}

@router.post("/{project_id}/comment")
async def add_comment(
    project_id: str,
    comment: CommentRequest,
    decoded_token: dict = Depends(verify_token)
):
    """Add a comment to a section"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    refinement_history = project_data.get("refinement_history", [])
    refinement_history.append({
        "section_id": comment.section_id,
        "comment": comment.comment,
        "timestamp": datetime.utcnow().isoformat(),
        "type": "comment"
    })
    
    doc_ref.update({
        "refinement_history": refinement_history,
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return {"message": "Comment added successfully"}

@router.get("/{project_id}/export")
async def export_document(
    project_id: str,
    decoded_token: dict = Depends(verify_token)
):
    """Export project as .docx or .pptx file"""
    user_id = decoded_token["uid"]
    
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    
    if project_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    document_type = project_data["document_type"]
    content = project_data.get("content", {})
    project_name = project_data.get("name", "document")
    
    if document_type == "docx":
        # Create Word document
        doc = Document()
        doc.add_heading(project_data.get("topic", "Document"), 0)
        
        # Sort content by order
        sorted_content = sorted(content.items(), key=lambda x: x[1].get("order", 0))
        
        for section_id, section_data in sorted_content:
            doc.add_heading(section_data.get("title", "Untitled"), level=1)
            doc.add_paragraph(section_data.get("content", ""))
        
        # Save to bytes
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)
        
        return StreamingResponse(
            io.BytesIO(file_stream.read()),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{project_name}.docx"'}
        )
    
    else:  # pptx
        # Create PowerPoint presentation
        prs = Presentation()
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(7.5)
        
        # Sort content by order
        sorted_content = sorted(content.items(), key=lambda x: x[1].get("order", 0))
        
        for slide_id, slide_data in sorted_content:
            slide = prs.slides.add_slide(prs.slide_layouts[0])
            title = slide.shapes.title
            content_shape = slide.placeholders[1]
            
            title.text = slide_data.get("title", "Untitled")
            
            text_frame = content_shape.text_frame
            text_frame.word_wrap = True
            
            # Add content with proper formatting
            content_text = slide_data.get("content", "")
            p = text_frame.paragraphs[0]
            p.text = content_text
            p.font.size = Pt(14)
        
        # Save to bytes
        file_stream = io.BytesIO()
        prs.save(file_stream)
        file_stream.seek(0)
        
        return StreamingResponse(
            io.BytesIO(file_stream.read()),
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{project_name}.pptx"'}
        )

