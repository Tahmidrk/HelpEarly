import { messagesAPI } from './api';

export async function notificationDestination(item, user, activeRole) {
  const audience = item.data?.audience;
  const role = user.role === 'both' && ['helper', 'household'].includes(audience) ? audience : activeRole;
  let path = role === 'helper' ? '/helper/dashboard' : role === 'admin' ? '/admin' : '/dashboard';
  if (item.type.startsWith('emergency_')) path = '/emergency';
  else if (item.type === 'message_new') {
    const conversations = await messagesAPI.getConversations();
    const conversation = conversations.find(row => Number(row.id) === Number(item.data?.conversation_id));
    if (!conversation) throw new Error('Conversation unavailable');
    path = `/chat?userId=${Number(conversation.other_id)}`;
  } else if (item.type.startsWith('proposal_') && Number.isInteger(Number(item.data?.job_id)) && Number(item.data.job_id) > 0) path = `/jobs/${Number(item.data.job_id)}`;
  else if (item.type === 'complaint_updated') path = '/complaints';
  else if (item.type === 'verification_updated') path = '/profile';
  return { role, path };
}
