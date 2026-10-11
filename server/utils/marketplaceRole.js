const roleFor = user => user.role === 'both' ? 'household' : user.role;
const activeRole = req => ['helper','household','admin'].includes(req.activeRole) ? req.activeRole : roleFor(req.user);
const conversationScope = (alias = 'c', id = '$1', role = '$2') => `(${alias}.user1_id=${id} AND ${alias}.user1_role=${role} OR ${alias}.user2_id=${id} AND ${alias}.user2_role=${role})`;
module.exports = { activeRole, conversationScope };
