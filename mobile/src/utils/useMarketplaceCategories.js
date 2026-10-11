import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { apiRequest } from '../api/client';
import { useNotifications } from '../context/NotificationContext';
export const originalCategoryOrder = ['Cleaning','Plumbing','Electrical','Gardening','Babysitting','Moving','Cooking'];
export function orderCategories(rows) {
  return [...rows].sort((a,b)=>{
    const x=originalCategoryOrder.indexOf(a.name),y=originalCategoryOrder.indexOf(b.name);
    return (x<0?100:x)-(y<0?100:y)||a.name.localeCompare(b.name);
  });
}
export default function useMarketplaceCategories() {
  const { revision }=useNotifications();
  const [categories,setCategories]=useState([]);
  useEffect(()=>{
    let current=true;
    const load=()=>apiRequest('/categories').then(rows=>{if(current)setCategories(orderCategories(rows));}).catch(()=>{});
    load();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')load();});
    const timer=setInterval(()=>{if(AppState.currentState==='active')load();},30000);
    return ()=>{current=false;subscription.remove();clearInterval(timer);};
  },[revision]);
  return categories.map(category=>category.name);
}
