import { useEffect, useState } from 'react';
import {Alert} from '../components/Feedback';
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
  const { revision }=useNotifications('categories');
  const [categories,setCategories]=useState([]);
  useEffect(()=>{
    let current=true;
    const load=()=>apiRequest('/categories').then(rows=>{if(current)setCategories(orderCategories(rows));}).catch(error=>{if(current && error.name!=='AbortError')Alert.alert('Service categories unavailable',error.message);});
    load();
    return ()=>{current=false;};
  },[revision]);
  return categories.map(category=>category.name);
}
