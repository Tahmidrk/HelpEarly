import { messagesAPI } from '../api/client';
export async function openNotification(navigation,item,activeRole,user,switchMode) {
  const targetRole=item.data?.audience;
  if(user?.role==='both' && ['helper','household'].includes(targetRole) && targetRole!==activeRole) {
    await switchMode(targetRole);
    activeRole=targetRole;
  }
  if(item.type.startsWith('emergency_')) return navigation.navigate('Emergency');
  if(item.type==='message_new') {
    const rows=await messagesAPI.conversations(),conversation=rows.find(row=>row.id===item.data.conversation_id);
    if(!conversation) throw new Error('Conversation unavailable');
    return navigation.navigate('Main',{screen:'Inbox',params:{conversationId:conversation.id,helperUserId:conversation.other_id,helperName:conversation.other_name}});
  }
  if(item.type.startsWith('proposal_')) return navigation.navigate('Main',{screen:'Jobs',params:{jobId:item.data.job_id}});
  if(item.type==='complaint_updated') return navigation.navigate('Complaints');
  if(item.type==='verification_updated') return navigation.navigate('Main',{screen:'Profile'});
  return navigation.navigate('Main',activeRole==='helper'?{screen:'Home'}:{screen:'Explore',params:{openSubTab:'bookings'}});
}
