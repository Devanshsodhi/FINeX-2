from agents import function_tool
from config import SKILLS_DIR


@function_tool
async def load_skill(skill_id: str) -> str:
    """Load the instruction set for a named skill into the conversation."""
    path = SKILLS_DIR / skill_id / "skill.md"
    if not path.exists():
        return f"Skill '{skill_id}' not found."
    return path.read_text(encoding="utf-8")
