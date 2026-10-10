const fs=require('fs');
module.exports=({config})=>{
  const projectId=process.env.EAS_PROJECT_ID;
  if(projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) throw new Error('EAS_PROJECT_ID must be the real UUID from eas init');
  const googleServicesFile=process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json')?'./google-services.json':undefined);
  if(process.env.EAS_BUILD_PROFILE==='production') {
    if(!/^https:\/\//.test(process.env.EXPO_PUBLIC_API_URL || '')) throw new Error('Production requires an HTTPS EXPO_PUBLIC_API_URL');
    if(!projectId || !googleServicesFile) throw new Error('Production requires EAS_PROJECT_ID and GOOGLE_SERVICES_JSON. See docs/DEPLOYMENT.md.');
  }
  return {...config,extra:{...config.extra,...(projectId?{eas:{projectId}}:{})},android:{...config.android,...(googleServicesFile?{googleServicesFile}:{})}};
};
