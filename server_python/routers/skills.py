import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from config import SKILLS_DIR

router = APIRouter()


@router.get("/api/skills")
async def list_skills():
    skills = []
    for d in SKILLS_DIR.iterdir():
        data_file = d / "_data.json"
        if d.is_dir() and data_file.exists():
            try:
                skills.append(json.loads(data_file.read_text()))
            except Exception:
                pass
    return skills


@router.get("/api/skills/{skill_id}/content", response_class=PlainTextResponse)
async def get_skill_content(skill_id: str):
    path = SKILLS_DIR / skill_id / "skill.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found")
    return path.read_text(encoding="utf-8")
