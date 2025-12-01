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
from bs4 import BeautifulSoup
from .auth_router import verify_token

load_dotenv()

router = APIRouter()

def get_db():
    return firestore.client()

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

def add_html_to_docx(paragraph, html_content):
    """Parses simple HTML (b, ul, li, p) into Docx runs."""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # If no tags found, just add text
    if not soup.find():
        paragraph.add_run(html_content)
        return

    for child in soup.descendants:
        if child.name in ['strong', 'b']:
             run = paragraph.add_run(child.get_text())
             run.bold = True
        elif child.name == 'li':
             run = paragraph.add_run(f"\n• {child.get_text()}")
        elif child.name is None: # NavigableString
             # Check if parent was already handled
             if child.parent.name not in ['strong', 'b', 'li']:
                 paragraph.add_run(child)

def generate_content_with_gemini(topic: str, section_title: str, document_type: str, context: Optional[str] = None) -> str:
    if not gemini_api_key:
        return f"<p>Placeholder content for <b>{section_title}</b>. (API Key Missing)</p>"
    
    # Priority list - prefers Flash for speed/cost, Pro for quality fallback
    models_to_try = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro']
    
    last_error = ""
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            
            if document_type == "docx":
                # TUNED PROMPT FOR WORD DOCS
                prompt = f"""
                Act as a Subject Matter Expert. Write a detailed, professional section titled "{section_title}" for a document about "{topic}".
                
                Context: {context if context else "Start of document"}
                
                STRICT OUTPUT RULES:
                1. Format using HTML tags: <p> for paragraphs, <ul>/<li> for lists, <b> for emphasis.
                2. content Depth: Write 300-400 words. Be specific, avoid fluff, and use technical terminology where appropriate.
                3. Structure: Use multiple paragraphs to break up text.
                4. Do NOT include the section title as a header (it is added automatically).
                5. Do NOT use Markdown (no ## or **).
                """
            else:
                # TUNED PROMPT FOR PRESENTATIONS
                prompt = f"""
                Act as a Presentation Expert. Create the slide content for a slide titled "{section_title}" for a deck about "{topic}".
                
                Context: {context if context else "Start of deck"}
                
                STRICT OUTPUT RULES:
                1. Format using HTML tags: <ul>, <li>, <b>.
                2. Content: 4-6 concise, high-impact bullet points.
                3. Style: Professional, punchy, and direct. Max 15 words per bullet.
                4. Do NOT include the slide title.
                5. Do NOT use Markdown.
                """
            
            response = model.generate_content(prompt)
            # Cleanup common AI artifacts
            clean_text = response.text.replace("```html", "").replace("```", "").strip()
            return clean_text
        except Exception as e:
            last_error = str(e)
            continue
            
    return f"<p>Error generating content. Last error: {last_error}</p>"

def generate_template_with_gemini(topic: str, document_type: str) -> List[Dict[str, Any]]:
    if not gemini_api_key: return []
    
    models_to_try = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro']
    
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            
            # TUNED PROMPT FOR EXACT COUNTS
            prompt = f"""
            Act as a Document Architect. Create a structured outline for a {'document' if document_type == 'docx' else 'presentation'} about "{topic}".

            CRITICAL INSTRUCTIONS:
            1. Analyze the topic text for quantity requests (e.g., "10 slides", "5 chapters", "outline in 7 parts").
            2. IF A NUMBER IS FOUND: You MUST generate EXACTLY that many titles.
            3. IF NO NUMBER IS FOUND: Generate {'6-9' if document_type == 'docx' else '8-12'} items.
            4. Format: Return ONLY the titles, one per line. No numbers (1., 2.) and no hyphens (-). Just the text.
            """
            
            response = model.generate_content(prompt)
            titles = [line.strip().replace('*', '').replace('-', '').strip() for line in response.text.split('\n') if line.strip()]
            
            # Assign order
            return [{"title": t, "order": i} for i, t in enumerate(titles)]
        except Exception as e:
            print(f"Template error ({model_name}): {e}")
            continue
            
    return []

@router.post("/{project_id}/generate-template")
async def generate_template(project_id: str, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict()["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    template = generate_template_with_gemini(project_data["topic"], project_data["document_type"])
    return {"template": template}

@router.post("/{project_id}/generate-content")
async def generate_content(project_id: str, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict()["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    items = project_data.get("outline", []) if project_data["document_type"] == "docx" else project_data.get("slides", [])
    content_map = project_data.get("content", {})
    context = ""
    updated_items = []
    has_changes = False

    # Sort items to ensure logical flow
    sorted_items = sorted(items, key=lambda x: x.get("order", 0))

    for item in sorted_items:
        # Ensure stable ID
        if not item.get("id") or item.get("id").startswith("temp"):
            item["id"] = f"item_{int(datetime.now().timestamp()*1000)}_{item.get('order')}"
            has_changes = True
        
        # Generate content if missing
        if item["id"] not in content_map or not content_map[item["id"]].get("content"):
            gen_text = generate_content_with_gemini(project_data["topic"], item["title"], project_data["document_type"], context)
            content_map[item["id"]] = {
                "title": item["title"], 
                "content": gen_text, 
                "order": item["order"]
            }
        
        # Extract text for context (strip HTML tags broadly for context window)
        raw_text = BeautifulSoup(content_map[item["id"]]["content"], "html.parser").get_text()
        context += f"\n{item['title']}: {raw_text[:200]}..."
        updated_items.append(item)

    update_payload = {"content": content_map, "updated_at": datetime.utcnow().isoformat()}
    
    # Sync structure back if IDs changed
    if has_changes:
        key = "outline" if project_data["document_type"] == "docx" else "slides"
        update_payload[key] = updated_items
        
    doc_ref.update(update_payload)
    return {"content": content_map}

@router.post("/{project_id}/refine")
async def refine_content(project_id: str, refinement: RefinementRequest, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict()["user_id"] != user_id: 
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    content = project_data.get("content", {})
    
    if refinement.section_id not in content: 
        raise HTTPException(status_code=404, detail="Section not found")
    
    current_content = content[refinement.section_id]["content"]
    
    models_to_try = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro']
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            prompt = f"""
            Refine the following content.
            Original Content (HTML): {current_content}
            
            Refinement Instruction: {refinement.prompt}
            
            OUTPUT RULE: Return valid HTML (<b>, <ul>, <li>, <p>). Keep it clean.
            """
            response = model.generate_content(prompt)
            refined_text = response.text.replace("```html", "").replace("```", "").strip()
            content[refinement.section_id]["content"] = refined_text
            break
        except: continue
    
    doc_ref.update({
        "content": content,
        "refinement_history": firestore.ArrayUnion([{
            "section_id": refinement.section_id,
            "type": "refinement",
            "prompt": refinement.prompt,
            "timestamp": datetime.utcnow().isoformat()
        }])
    })
    return {"refined_content": content[refinement.section_id]["content"]}

@router.get("/{project_id}/export")
async def export_document(project_id: str, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict()["user_id"] != user_id: 
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = doc.to_dict()
    content_map = project_data.get("content", {})
    items = project_data.get("outline", []) if project_data["document_type"] == "docx" else project_data.get("slides", [])
    sorted_items = sorted(items, key=lambda x: x.get("order", 0))

    file_stream = io.BytesIO()

    def get_html(item):
        # Look up by ID, fallback to order
        if item.get("id") in content_map: 
            return content_map[item["id"]].get("content", "")
        for v in content_map.values():
            if v.get("order") == item.get("order"): return v.get("content", "")
        return ""

    if project_data["document_type"] == "docx":
        doc = Document()
        doc.add_heading(project_data.get("topic", "Document"), 0)
        
        for item in sorted_items:
            doc.add_heading(item.get("title", "Untitled"), level=1)
            html_content = get_html(item)
            
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Paragraphs
            paragraphs = soup.find_all('p')
            if not paragraphs:
                # Handle raw text or lists without p wrapper
                p = doc.add_paragraph()
                add_html_to_docx(p, html_content)
            else:
                for para_tag in paragraphs:
                    p = doc.add_paragraph()
                    add_html_to_docx(p, str(para_tag))
            
            # Lists
            ul_tags = soup.find_all('ul')
            for ul in ul_tags:
                for li in ul.find_all('li'):
                    p = doc.add_paragraph(style='List Bullet')
                    add_html_to_docx(p, str(li.decode_contents()))

        doc.save(file_stream)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"{project_data.get('name')}.docx"
    else:
        prs = Presentation()
        # Title Slide
        slide = prs.slides.add_slide(prs.slide_layouts[0])
        slide.shapes.title.text = project_data.get("name")
        slide.placeholders[1].text = project_data.get("topic")
        
        for item in sorted_items:
            slide = prs.slides.add_slide(prs.slide_layouts[1])
            slide.shapes.title.text = item.get("title")
            
            html_content = get_html(item)
            soup = BeautifulSoup(html_content, 'html.parser')
            text_frame = slide.placeholders[1].text_frame
            text_frame.clear() 
            
            # Simple HTML text extraction for PPT
            # (Note: Full rich text in PPT requires complex run handling, 
            # for now we extract clean text and bullets)
            clean_text = soup.get_text('\n')
            p = text_frame.paragraphs[0]
            p.text = clean_text

        prs.save(file_stream)
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        filename = f"{project_data.get('name')}.pptx"

    file_stream.seek(0)
    return StreamingResponse(
        file_stream, 
        media_type=media_type, 
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/{project_id}/feedback")
async def add_feedback(project_id: str, feedback: FeedbackRequest, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc_ref.update({"refinement_history": firestore.ArrayUnion([{
        "section_id": feedback.section_id, "type": "feedback", "value": feedback.feedback_type, "timestamp": datetime.utcnow().isoformat()
    }])})
    return {"message": "ok"}

@router.post("/{project_id}/comment")
async def add_comment(project_id: str, comment: CommentRequest, decoded_token: dict = Depends(verify_token)):
    user_id = decoded_token["uid"]
    doc_ref = get_db().collection("projects").document(project_id)
    doc_ref.update({"refinement_history": firestore.ArrayUnion([{
        "section_id": comment.section_id, "type": "comment", "value": comment.comment, "timestamp": datetime.utcnow().isoformat()
    }])})
    return {"message": "ok"}