import React, { forwardRef, useEffect, useRef } from 'react';
import { ScrollView as NativeScrollView, Modal as NativeModal, Keyboard, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Android window resize owns keyboard space. Only iOS needs keyboard avoidance.
export const FormScrollView = forwardRef(function FormScrollView({onFocus,onScroll,...props}, forwarded) {
  const scroll=useRef(null),offset=useRef(0),keyboardTop=useRef(Infinity);
  const reveal=()=>requestAnimationFrame(()=>{
    const input=TextInput.State.currentlyFocusedInput();
    if(!input?.measureInWindow || !scroll.current?.measureInWindow) return;
    scroll.current.measureInWindow((x,y,w,h)=>input.measureInWindow((ix,iy,iw,ih)=>{
      const hidden=iy+ih-Math.min(y+h,keyboardTop.current)+8;
      if(hidden>0) scroll.current.scrollTo({y:Math.max(0,offset.current+hidden),animated:true});
    }));
  });
  useEffect(()=>{
    const show=Keyboard.addListener('keyboardDidShow',e=>{keyboardTop.current=e.endCoordinates.screenY;reveal();});
    const hide=Keyboard.addListener('keyboardDidHide',()=>{keyboardTop.current=Infinity;});
    return()=>{show.remove();hide.remove();};
  },[]);
  return <NativeScrollView {...props} ref={node=>{scroll.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}}
    keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'}
    scrollEventThrottle={16} onScroll={e=>{offset.current=e.nativeEvent.contentOffset.y;onScroll?.(e);}}
    onLayout={e=>{props.onLayout?.(e);reveal();}} onFocus={e=>{onFocus?.(e);reveal();}} />;
});
export function FormModal({children,...props}) {
  return <NativeModal {...props} statusBarTranslucent={false}>
    <KeyboardAvoidingView style={{flex:1}} enabled={Platform.OS==='ios'} behavior="padding">
      <SafeAreaView style={{flex:1}} edges={['top','bottom','left','right']}>
        <FormScrollView style={{flex:1}} contentContainerStyle={{flexGrow:1}}>{children}</FormScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </NativeModal>;
}
