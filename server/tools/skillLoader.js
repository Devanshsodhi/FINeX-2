import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', '..', 'SKILLS');

export const load_skill = async ({ skill_id }) => {
  const skillPath = path.join(SKILLS_DIR, skill_id, 'skill.md');
  try {
    const content = fs.readFileSync(skillPath, 'utf8');
    return { skill_id, content, status: 'loaded' };
  } catch {
    throw new Error(`Skill '${skill_id}' not found`);
  }
};
