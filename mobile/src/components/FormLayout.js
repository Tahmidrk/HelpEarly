import React, { createContext, useContext, forwardRef, useEffect, useRef, useState } from 'react';
import { View, ScrollView as NativeScrollView, Modal as NativeModal, Keyboard, KeyboardAvoidingView, Platform, TextInput, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FocusContext = createContext(() => {});
const KeyboardOwnedContext = createContext(false);
// RN 0.86 Android measureInWindow subtracts the visible window's status-bar origin,
// including edge-to-edge windows (which can report negative y). Keyboard metrics use screen y.
const screenY=y=>y+(Platform.OS==='android'?(StatusBar?.currentHeight || 0):0);
// Measure only the keyboard overlap left by Android window/inset handling.
// A resized window contributes zero; edge-to-edge/modal windows lose exactly their obstruction.
function useKeyboardOverlap(node, reveal = () => {}, enabled=true) {
  const [overlap,setOverlap]=useState(0),current=useRef(0),top=useRef(Infinity);
  const measure=()=>requestAnimationFrame(()=>node.current?.measureInWindow((x,y,w,h)=>{
    const next=enabled && Platform.OS==='android'?Math.max(0,screenY(y)+h+current.current-top.current):0;
    current.current=next;setOverlap(next);reveal();
  }));
  useEffect(()=>{
    const show=Keyboard.addListener('keyboardDidShow',e=>{top.current=e.endCoordinates.screenY;measure();});
    const hide=Keyboard.addListener('keyboardDidHide',()=>{top.current=Infinity;current.current=0;setOverlap(0);});
    if(Keyboard.metrics?.()){top.current=Keyboard.metrics().screenY;measure();}
    return()=>{show.remove();hide.remove();};
  },[]);
  return {overlap,measure,top};
}
export const FormTextInput=forwardRef(function FormTextInput({onFocus,...props},ref){
  const reveal=useContext(FocusContext);
  return <TextInput {...props} ref={ref} onFocus={event=>{onFocus?.(event);reveal();}}/>;
});
export function KeyboardViewport({children,style,...props}) {
  const owned=useContext(KeyboardOwnedContext),node=useRef(null),{overlap,measure}=useKeyboardOverlap(node,undefined,!owned);
  return <KeyboardOwnedContext.Provider value={true}><View {...props} ref={node} style={[style,{marginBottom:(StyleSheet.flatten(style)?.marginBottom || 0)+overlap}]} onLayout={measure}>{children}</View></KeyboardOwnedContext.Provider>;
}
export const FormScrollView = forwardRef(function FormScrollView({onFocus,onScroll,...props}, forwarded) {
  const scroll=useRef(null),offset=useRef(0);
  const reveal=()=>requestAnimationFrame(()=>{
    const input=TextInput.State.currentlyFocusedInput();
    if(!input?.measureInWindow || !scroll.current?.measureInWindow) return;
    scroll.current.measureInWindow((x,y,w,h)=>input.measureInWindow((ix,iy,iw,ih)=>{
      const hidden=screenY(iy)+ih-Math.min(screenY(y)+h,top.current)+8;
      if(hidden>0) scroll.current.scrollTo({y:Math.max(0,offset.current+hidden),animated:true});
    }));
  });
  const owned=useContext(KeyboardOwnedContext),{overlap,measure,top}=useKeyboardOverlap(scroll,reveal,!owned);
  return <KeyboardOwnedContext.Provider value={true}><FocusContext.Provider value={reveal}><NativeScrollView {...props} style={[props.style,{marginBottom:(StyleSheet.flatten(props.style)?.marginBottom || 0)+overlap}]} ref={node=>{scroll.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}}
    keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'none'}
    nestedScrollEnabled
    scrollEventThrottle={16} onScroll={e=>{offset.current=e.nativeEvent.contentOffset.y;onScroll?.(e);}}
    onLayout={e=>{props.onLayout?.(e);measure();reveal();}} onFocus={e=>{onFocus?.(e);reveal();}} /></FocusContext.Provider></KeyboardOwnedContext.Provider>;
});
export function FormModal({children,...props}) {
  return <NativeModal {...props} statusBarTranslucent={false}>
    <KeyboardOwnedContext.Provider value={false}>
    <KeyboardAvoidingView style={{flex:1}} enabled={Platform.OS==='ios'} behavior="padding">
      <SafeAreaView style={{flex:1}} edges={['top','bottom','left','right']}>
        <FormScrollView style={{flex:1}} contentContainerStyle={{flexGrow:1}}>{children}</FormScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
    </KeyboardOwnedContext.Provider>
  </NativeModal>;
}
