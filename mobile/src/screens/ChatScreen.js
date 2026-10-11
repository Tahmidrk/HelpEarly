import { Alert } from '../components/Feedback';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  BackHandler,
  } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { helpersAPI, messagesAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useFocusEffect } from '@react-navigation/native';

export default function ChatScreen({ route, navigation }) {
  const { user, activeRole } = useAuth();
  const { revision } = useNotifications();
  const isWorker = activeRole === 'helper';
  const { helperName, helperId, helperUserId, helperProfileId, conversationId } = route.params || {};

  const generation=useRef(0),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  const [contacts,setContacts]=useState([]);
  const closeChat=()=>{generation.current++;setActiveChat(null);setInput('');navigation.setParams({helperName:null,helperId:null,helperUserId:null,helperProfileId:null,conversationId:null});};
  const [helpers, setHelpers] = useState([]);
  const [loadingHelpers, setLoadingHelpers] = useState(true);
  const [activeChat, setActiveChat] = useState(null);
  const [messagesMap, setMessagesMap] = useState({});
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatError, setChatError] = useState('');
  useFocusEffect(React.useCallback(()=>{
    let disposed=false;
    const refresh=async()=>{
      try {
        const rows=await messagesAPI.conversations();
        if(!disposed) setHelpers(rows.map(c=>({...c,name:c.other_name,user_id:c.other_id,helper_profile_id:c.other_helper_profile_id,primary_category:['helper','both'].includes(c.other_role)?'Service Worker':'Household Client'})));
        if(activeChat) {
          const messages=await messagesAPI.messages(activeChat.id);
          if(!disposed) setMessagesMap(prev=>({...prev,[activeChat.id]:messages.map(formatMessage)}));
        }
        if(!disposed) setChatError('');
      } catch(error) { if(!disposed) setChatError(error.message); }
    };
    refresh(); const timer=setInterval(refresh,5000);
    return ()=>{disposed=true;clearInterval(timer);};
  },[activeChat?.id,user?.id,activeRole,revision]));

  const formatMessage = (message) => ({
    ...message,
    sender: Number(message.sender_id) === Number(user?.id) ? 'user' : 'partner',
    text: message.content,
    status: message.is_read ? 'seen' : 'sent',
    time: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const openChat = async (chat) => {
    const request=++generation.current;
    try {
      setActiveChat(chat);
      const rows = await messagesAPI.messages(chat.id);
      if(mounted.current && request===generation.current) setMessagesMap((prev) => ({ ...prev, [chat.id]: rows.map(formatMessage) }));
    } catch (error) {
      if(mounted.current && request===generation.current){setChatError(error.message);setActiveChat(null);}
    }
  };

  useFocusEffect(React.useCallback(() => {
    const onBackPress = () => {
      if (activeChat) {
        closeChat();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [activeChat,navigation]));

  useEffect(() => {
    fetchConversations();
  }, [isWorker]);

  const fetchConversations = async () => {
    try {
      setLoadingHelpers(true);
      const rows = await messagesAPI.conversations();
      setHelpers(rows.map((conversation) => ({
        ...conversation,
        name: conversation.other_name,
        user_id: conversation.other_id,
        helper_profile_id: conversation.other_helper_profile_id,
        primary_category: conversation.other_role === 'helper' || conversation.other_role === 'both' ? 'Service Worker' : 'Household Client',
      })));
    } catch (e) {
      setChatError(e.message);
    } finally {
      setLoadingHelpers(false);
    }
  };

  useEffect(() => {
    const profile=helperProfileId || (!isWorker ? helperId : null),targetUser=helperUserId || (isWorker ? helperId : null);
    if(!conversationId && !profile && !targetUser) return;
    navigation.setParams({helperName:null,helperId:null,helperUserId:null,helperProfileId:null,conversationId:null});
    const request=++generation.current;
    (async()=>{
      try {
        let conversation;
        if(conversationId) {
          const rows=await messagesAPI.conversations();
          conversation=rows.find(row=>Number(row.id)===Number(conversationId));
          if(!conversation) throw new Error('Conversation unavailable for this role');
        }else{
          const target=targetUser ? {user_id:targetUser} : await helpersAPI.getById(profile);
          conversation=await messagesAPI.getOrCreate(target.user_id);
        }
        if(!mounted.current || request!==generation.current)return;
        await openChat({...conversation,name:conversation.other_name,user_id:conversation.other_id,helper_profile_id:conversation.other_helper_profile_id});
        await fetchConversations();
      }catch(error){if(mounted.current && request===generation.current)setChatError(error.message);}
    })();
  }, [conversationId,helperId,helperUserId,helperProfileId,activeRole]);
  useFocusEffect(React.useCallback(()=>{
    let disposed=false;
    if(isWorker) messagesAPI.contacts(searchQuery).then(rows=>{if(!disposed)setContacts(rows);}).catch(error=>{if(!disposed)setChatError(error.message);});
    return()=>{disposed=true;};
  },[isWorker,searchQuery,revision]));

  const handleSendMessage = async () => {
    if (!input.trim() || !activeChat) return;
    const userText = input;
    setInput('');
    try {
      const result = await messagesAPI.send(activeChat.user_id || activeChat.other_id, userText.trim());
      setMessagesMap((prev) => (prev[activeChat.id] || []).some(message=>message.id===result.message.id) ? prev : ({ ...prev, [activeChat.id]: [...(prev[activeChat.id] || []), formatMessage(result.message)] }));
      fetchConversations();
    } catch (error) {
      setInput(userText);
      Alert.alert('Message Not Sent', error.message);
    }
  };

  const activeConversations = helpers.filter((h) => {
    const msgs = messagesMap[h.id] || [];
    const isSearchMatch =
      h.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.primary_category || h.category || '').toLowerCase().includes(searchQuery.toLowerCase());

    return isSearchMatch;
  });

  const inboxRows=[...activeConversations,...(isWorker?contacts.filter(c=>!helpers.some(h=>Number(h.user_id)===Number(c.id))).map(c=>({...c,id:'contact-'+c.id,user_id:c.id,isContact:true,primary_category:'Eligible household'})):[])];
  // ACTIVE CHAT VIEW
  if (activeChat) {
    const activeMsgs = messagesMap[activeChat.id] || [];
    const activeCat = activeChat.primary_category || activeChat.category || activeChat.services?.[0]?.category_name || 'Service Worker';

    return (
      <View style={styles.container}>
        {chatError ? <Text style={{color:'#b91c1c',padding:12}}>{chatError}</Text> : null}
        {/* Top Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={closeChat}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.avatarHeader}>
            <Text style={styles.avatarHeaderText}>{activeChat.name?.charAt(0) || 'H'}</Text>
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.chatHeaderName}>{activeChat.name}</Text>
            <Text style={styles.chatHeaderStatus}>📍 {activeChat.location || 'Location not shared'} · {activeCat}</Text>
          </View>

          {!isWorker && <TouchableOpacity
            style={styles.profileDetailIcon}
            onPress={() => navigation.navigate('HelperDetail', { helperId: activeChat.helper_profile_id, helperData: activeChat })}
          >
            <Ionicons name="information-circle-outline" size={24} color="#ffffff" />
          </TouchableOpacity>}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          enabled={Platform.OS === 'ios'} behavior="padding"
          keyboardVerticalOffset={0}
        >
          {/* Messages List */}
          <FlatList
            data={activeMsgs}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.partnerBubble]}>
                <View style={styles.bubbleInnerRow}>
                  <Text style={[styles.bubbleText, item.sender === 'user' ? styles.userText : styles.partnerText]}>
                    {item.text}
                  </Text>
                  <View style={styles.bubbleMeta}>
                    <Text style={[styles.timeText, item.sender === 'user' ? styles.userTime : styles.partnerTime]}>
                      {item.time}
                    </Text>
                    {item.sender === 'user' && (
                      <Ionicons
                        name={item.status === 'seen' ? 'checkmark-done' : 'checkmark'}
                        size={13}
                        color={item.status === 'seen' ? '#38bdf8' : '#ccfbf1'}
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </View>
              </View>
            )}
          />

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={`Message ${activeChat.name}...`}
              placeholderTextColor="#94a3b8"
              value={input}
              onChangeText={setInput}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <Ionicons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // INBOX CONVERSATIONS LIST (Clean interface without extra headers)
  return (
    <View style={styles.container}>
      {chatError ? <Text accessibilityRole="alert" style={{color:'#b91c1c',padding:12}} onPress={fetchConversations}>{chatError} — Tap to retry</Text> : null}
      {/* Search Bar starting cleanly */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loadingHelpers ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      ) : inboxRows.length === 0 ? (
        <View style={styles.emptyInbox}>
          <Ionicons name="chatbubbles-outline" size={54} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Active Messages</Text>
          <Text style={styles.emptySub}>
            {isWorker
              ? 'When clients message you regarding bookings or job offers, your conversations will appear here.'
              : 'Click "Chat" on any helper in the Available Helpers list to start messaging.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={inboxRows}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const primaryCat = item.primary_category || item.category || item.services?.[0]?.category_name || 'Service Worker';
            const msgs = messagesMap[item.id] || [];
            const lastMsg = msgs[msgs.length - 1];

            return (
              <TouchableOpacity
                style={styles.chatRow}
                activeOpacity={0.7}
                onPress={async()=>{if(!item.isContact)return openChat(item);try{const c=await messagesAPI.getOrCreate(item.user_id);await openChat({...c,name:c.other_name,user_id:c.other_id});fetchConversations();}catch(error){setChatError(error.message);}}}
              >
                <View style={styles.listAvatar}>
                  <Text style={styles.listAvatarText}>{item.name?.charAt(0) || 'H'}</Text>
                  {item.nid_verified && <View style={styles.verifiedDot} />}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.partnerName}>{item.name}</Text>
                    <Text style={styles.msgTime}>{lastMsg?.time || 'Now'}</Text>
                  </View>

                  <View style={styles.rowBottom}>
                    <Text style={styles.catBadge}>{primaryCat}</Text>
                    <Text style={styles.lastMsgText} numberOfLines={1}>
                      {lastMsg?.text || 'Tap to continue conversation'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyInbox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 14 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 6, lineHeight: 18 },

  // Chat Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4, marginRight: 6 },
  avatarHeader: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHeaderText: { color: '#0d9488', fontSize: 17, fontWeight: '800' },
  chatHeaderName: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  chatHeaderStatus: { color: '#ccfbf1', fontSize: 11.5, marginTop: 1 },
  profileDetailIcon: { padding: 4 },

  // Chat Bubbles
  bubble: {
    maxWidth: '82%',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  partnerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopLeftRadius: 2,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0d9488',
    borderTopRightRadius: 2,
  },
  bubbleInnerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
  },
  bubbleText: { fontSize: 13.5, lineHeight: 18, flexShrink: 1 },
  partnerText: { color: '#0f172a' },
  userText: { color: '#ffffff', fontWeight: '400' },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingLeft: 4,
    paddingBottom: 1,
  },
  timeText: { fontSize: 9.5 },
  partnerTime: { color: '#94a3b8' },
  userTime: { color: '#ccfbf1' },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search Container
  searchContainer: { backgroundColor: '#ffffff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  listAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  listAvatarText: { color: '#0f766e', fontSize: 18, fontWeight: '800' },
  verifiedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0d9488',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  partnerName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  msgTime: { fontSize: 11, color: '#94a3b8' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: {
    backgroundColor: '#f0fdfa',
    color: '#0d9488',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lastMsgText: { fontSize: 13, color: '#64748b', flex: 1 },
});
