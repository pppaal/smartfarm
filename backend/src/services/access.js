import { db } from '../db/index.js';

const ROLE_RANK = { owner: 3, member: 2, viewer: 1 };

/**
 * 하우스 접근 권한 체크.
 * - 오너이거나
 * - greenhouse_members 에 등록되어 있고 required 이상의 role 이면 true
 */
export function checkGreenhouseAccess(userId, greenhouseId, required = 'viewer') {
  const owner = db.prepare('SELECT id FROM greenhouses WHERE id = ? AND user_id = ?').get(greenhouseId, userId);
  if (owner) return 'owner';

  const member = db.prepare('SELECT role FROM greenhouse_members WHERE greenhouse_id = ? AND user_id = ?')
    .get(greenhouseId, userId);
  if (!member) return null;

  if (ROLE_RANK[member.role] >= ROLE_RANK[required]) return member.role;
  return null;
}
