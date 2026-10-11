import React from 'react';
import {Text} from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import JobsScreen from './src/screens/JobsScreen';
import ChatScreen from './src/screens/ChatScreen';
import AiAssistantScreen from './src/screens/AiAssistantScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WorkerDashboardScreen from './src/screens/WorkerDashboardScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HelperDetailScreen from './src/screens/HelperDetailScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import ComplaintsScreen from './src/screens/ComplaintsScreen';
import { Ionicons } from '@expo/vector-icons';
import {HouseholdPostsScreen,WorkerHomeScreen} from './src/screens/RoleSections';

import { FeedbackProvider } from './src/components/Feedback';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();
const tabLabel=label=>({color})=><Text accessibilityLabel={label} adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={{fontSize:10,fontWeight:'700',color,maxWidth:'100%',marginBottom:2}}>{label}</Text>;

function MainTabs() {
  const { user, activeRole } = useAuth();
  const insets = useSafeAreaInsets();
  const isWorker = activeRole === 'helper';

  // Ensure bottom tab bar floats above Android system navigation buttons
  const bottomInset = insets.bottom;
  const { unreadCount } = useNotifications();

  return (
    <Tab.Navigator key={activeRole}
      screenOptions={{
        headerStyle: { backgroundColor: '#0d9488', elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerTintColor: '#ffffff',
        tabBarActiveTintColor: '#0d9488',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
        tabBarStyle: {
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          elevation: 8,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={isWorker ? WorkerHomeScreen : HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: tabLabel('Home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={isWorker ? 'construct' : 'home'} color={color} size={22} />
          ),
        }}
      />

      {!isWorker ? (
        <Tab.Screen
          name="Explore"
          component={ExploreScreen}
          options={{
            headerTitle: 'Book Helpers',
            headerStyle: { backgroundColor: '#0d9488', elevation: 0, shadowOpacity: 0 },
            tabBarLabel: tabLabel('Helpers'),
            tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={22} />,
          }}
        />
      ) : null}
      {<Tab.Screen
        name="Jobs"
        component={isWorker ? JobsScreen : HouseholdPostsScreen}
        options={{
          headerTitle: isWorker ? 'Job Feed' : 'Post Requests',
          headerStyle: { backgroundColor: '#0d9488', elevation: 0, shadowOpacity: 0 },
          tabBarLabel: tabLabel(isWorker ? 'Job Feed' : 'Posts'),
          tabBarIcon: ({ color, size }) => <Ionicons name={isWorker ? 'briefcase' : 'document-text'} color={color} size={22} />,
        }}
      />}

      {isWorker && <Tab.Screen name="Inbox" component={ChatScreen} options={{headerTitle:'Client Messages',headerStyle:{backgroundColor:'#0d9488',elevation:0,shadowOpacity:0},tabBarLabel:tabLabel('Inbox'),tabBarIcon:({color})=><Ionicons name="chatbubbles" color={color} size={22}/>}}/>}

      {(
        <Tab.Screen
          name="AiAssistant"
          component={AiAssistantScreen}
          options={{
            headerTitle: 'Platform AI',
            headerStyle: { backgroundColor: '#0d9488', elevation: 0, shadowOpacity: 0 },
            tabBarLabel: tabLabel('AI Assistant'),
            tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={22} />,
          }}
        />
      )}

      <Tab.Screen name="NotificationTab" component={NotificationsScreen} options={{headerTitle:'Notifications',tabBarLabel:tabLabel('Notifications'),tabBarBadge:unreadCount || undefined,tabBarIcon:({color})=><Ionicons name="notifications" color={color} size={22}/>}} />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'User Profile',
          headerStyle: { backgroundColor: '#0d9488', elevation: 0, shadowOpacity: 0 },
          tabBarLabel: tabLabel('Profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={22} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FeedbackProvider><AuthProvider>
        <NotificationProvider navigationRef={navigationRef}>
        <AppNavigator />
        </NotificationProvider>
      </AuthProvider></FeedbackProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();
  const { navigationReady } = useNotifications();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={navigationReady}>
      <Stack.Navigator screenOptions={{ headerShown: false }} screenLayout={({children,route})=><SafeAreaView style={{flex:1}} edges={['Main','Register','HelperDetail'].includes(route.name)?['left','right']:['left','right','bottom']}>{children}</SafeAreaView>}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="HelperDetail" component={HelperDetailScreen} />
            <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ headerShown: true, title: 'Emergency requests' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications' }} />
            <Stack.Screen name="Complaints" component={ComplaintsScreen} options={{headerShown:true,title:'My complaints'}} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
